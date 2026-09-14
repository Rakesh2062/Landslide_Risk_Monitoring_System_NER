"""
Weather & sensor router.
"""
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.schemas import WeatherCurrentOut, SoilMoistureOut
from app.services import weather_service

router = APIRouter()


@router.get("/weather/current", response_model=WeatherCurrentOut)
def current_weather(
    lat: float = Query(..., description="Latitude"),
    lng: float = Query(..., description="Longitude"),
    db: Session = Depends(get_db),
):
    result = weather_service.get_current_weather(db, lat=lat, lng=lng)
    if result is None:
        raise HTTPException(status_code=404, detail="No weather data available")
    return result


@router.get("/sensors/soil-moisture", response_model=List[SoilMoistureOut])
def soil_moisture(
    zone_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    return weather_service.get_soil_moisture(db, zone_id=zone_id)


@router.get("/weather/soil-moisture-live")
def live_soil_moisture(
    lat: float = Query(..., description="Latitude"),
    lng: float = Query(..., description="Longitude"),
):
    """
    Fetch real-time volumetric soil moisture (0–1 cm depth) from Open-Meteo.
    Returns moisture in m³/m³ (0.0–1.0), suitable for the ML model's soil_moisture feature.
    """
    result = weather_service.get_live_soil_moisture(lat, lng)
    if result is None:
        raise HTTPException(status_code=503, detail="Live soil moisture data unavailable")
    return result

