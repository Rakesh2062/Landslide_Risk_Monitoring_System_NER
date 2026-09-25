"""
Risk & prediction router.
"""
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.schemas import RiskZoneOut, PredictRiskIn, PredictRiskOut, RiskHistoryOut
from app.services import risk_service
from app.services.risk_model import ModelUnavailableError, predict_risk as ml_predict
from app.services import weather_service
from app.models.models import Zone
from app.core.config import settings

router = APIRouter()


@router.get("/risk-zones", response_model=List[RiskZoneOut])
def list_risk_zones(
    district: Optional[str] = None,
    min_severity: Optional[str] = None,
    db: Session = Depends(get_db),
):
    return risk_service.get_all_zones(db, district=district, min_severity=min_severity)


@router.post("/predict-risk", response_model=PredictRiskOut)
def predict_risk(payload: PredictRiskIn):
    """
    Run the trained landslide risk model and return a probability score + severity label.
    Used by the Risk Predictor Simulation workbench (manual feature input).
    """
    try:
        result = ml_predict(
            payload.model_dump(),
            allow_empirical_fallback=settings.allow_empirical_fallback,
            model_version=settings.model_version,
        )
    except ModelUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    return result


@router.post("/risk-zones/{zone_id}/live-predict", response_model=PredictRiskOut)
def live_predict_zone(zone_id: str, db: Session = Depends(get_db)):
    """
    For the GIS Hazard Map side panel.
    Fetches the zone's stored terrain features from the DB, pulls live rainfall
    data and live soil moisture from Open-Meteo, assembles all 12 model features,
    then runs the ML model to return a real-time prediction.
    """
    zone = db.query(Zone).filter(Zone.zone_id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail=f"Zone {zone_id} not found")

    # --- Parse zone coordinates from geometry ----------------------------
    lat, lng = 0.0, 0.0
    if zone.geometry and "POINT(" in str(zone.geometry):
        try:
            coords = str(zone.geometry).replace("POINT(", "").replace(")", "").strip().split()
            lng, lat = float(coords[0]), float(coords[1])
        except Exception:
            pass

    # --- Live weather (rainfall, ARI) from Open-Meteo --------------------
    weather = weather_service._get_live_weather(lat, lng)
    if not weather:
        raise HTTPException(
            status_code=503,
            detail="Live weather data unavailable. Check Open-Meteo connectivity.",
        )

    # --- Live soil moisture from Open-Meteo (falls back to 0.5 if down) --
    soil = weather_service.get_live_soil_moisture(lat, lng)
    soil_moisture = soil["moisture"] if soil else 0.5

    # --- Assemble all 12 features (terrain from DB + live hydrology) ------
    features = {
        "slope":                     float(zone.slope or 25.0),
        "aspect":                    float(zone.aspect or 180.0),
        "curvature":                 float(zone.curvature or 0.0),
        "dist_to_drainage":          float(zone.dist_to_drainage or 200.0),
        "rainfall_24h":              weather["rainfall_24h"],
        "rainfall_72h":              weather["rainfall_72h"],
        "rainfall_7d":               weather["rainfall_7d"],
        "rainfall_intensity_peak":   weather["rainfall_intensity_peak"],
        "antecedent_rainfall_index": weather["antecedent_rainfall_index"],
        "soil_moisture":             soil_moisture,
        "dist_to_history":           float(zone.dist_to_history or 5.0),
        "landslide_density_5km":     float(zone.landslide_freq_district or 2.0),
    }

    try:
        result = ml_predict(
            features,
            allow_empirical_fallback=settings.allow_empirical_fallback,
            model_version=settings.model_version,
        )
    except ModelUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    return result


@router.get("/risk-zones/{zone_id}/history", response_model=RiskHistoryOut)
def zone_history(zone_id: str, db: Session = Depends(get_db)):
    result = risk_service.get_zone_history(db, zone_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Zone {zone_id} not found")
    return result
