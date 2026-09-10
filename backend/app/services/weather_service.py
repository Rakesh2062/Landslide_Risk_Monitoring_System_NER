"""
Weather & sensor service.
"""
from __future__ import annotations

from typing import List, Optional
from time import monotonic

import httpx

from geoalchemy2.functions import ST_X, ST_Y, ST_Distance, ST_MakePoint, ST_SetSRID
from sqlalchemy.orm import Session
from sqlalchemy import func, cast
from geoalchemy2 import Geography

from app.models.models import Zone, WeatherReading, SoilSensor
from app.db.session import engine


_LIVE_WEATHER_URL = "https://api.open-meteo.com/v1/forecast"
_LIVE_CACHE_TTL_SECONDS = 60
_live_weather_cache: dict[tuple[float, float], tuple[float, dict]] = {}


def _sum(values: list[float]) -> float:
    return round(sum(float(value or 0) for value in values), 1)


def _get_live_weather(lat: float, lng: float) -> Optional[dict]:
    """Get location-specific live forecast/observations without persisting them."""
    key = (round(lat, 4), round(lng, 4))
    cached = _live_weather_cache.get(key)
    if cached and monotonic() - cached[0] < _LIVE_CACHE_TTL_SECONDS:
        return cached[1]

    try:
        response = httpx.get(
            _LIVE_WEATHER_URL,
            params={
                "latitude": lat,
                "longitude": lng,
                "hourly": "rain",
                "past_hours": 168,
                "forecast_hours": 24,
                "timezone": "auto",
            },
            timeout=8.0,
        )
        response.raise_for_status()
        rain = response.json().get("hourly", {}).get("rain", [])
        if len(rain) < 24:
            return None

        # With past_hours=168, the first 168 entries precede the current hour;
        # the remaining values are the next 24-hour forecast window.
        observed = rain[:-24] if len(rain) > 24 else rain
        forecast = rain[-24:]
        last_24 = observed[-24:]
        last_72 = observed[-72:]
        last_7d = observed[-168:]
        rainfall_24h = _sum(last_24)
        rainfall_72h = _sum(last_72)
        rainfall_7d = _sum(last_7d)

        result = {
            "lat": lat,
            "lng": lng,
            "rainfall_24h": rainfall_24h,
            "rainfall_72h": rainfall_72h,
            "rainfall_7d": rainfall_7d,
            "rainfall_intensity_peak": round(max((float(value or 0) for value in last_24), default=0), 1),
            # ARI is a clearly labelled derived saturation indicator, not a raw sensor value.
            "antecedent_rainfall_index": round(min(200, rainfall_24h + rainfall_72h * 0.45 + rainfall_7d * 0.15), 1),
            "forecast_next_24h": _sum(forecast),
            "source": "Open-Meteo live forecast",
        }
        _live_weather_cache[key] = (monotonic(), result)
        return result
    except httpx.HTTPError:
        return None


def get_current_weather(db: Session, lat: float, lng: float) -> Optional[dict]:
    """
    Find the nearest zone to (lat, lng) and return its latest weather reading.
    """
    if engine.dialect.name == "sqlite":
        zones = db.query(Zone).all()
        if not zones:
            return None
        def parse_pt(z):
            if z.geometry and "POINT(" in str(z.geometry):
                try:
                    c = str(z.geometry).replace("POINT(", "").replace(")", "").strip().split()
                    return float(c[0]), float(c[1])
                except Exception:
                    pass
            return 0.0, 0.0
        zone = min(zones, key=lambda z: (parse_pt(z)[0] - lng)**2 + (parse_pt(z)[1] - lat)**2)
    else:
        # Find nearest zone by PostGIS distance
        target = ST_SetSRID(ST_MakePoint(lng, lat), 4326)

        zone_row = (
            db.query(Zone, ST_X(Zone.geometry).label("z_lng"), ST_Y(Zone.geometry).label("z_lat"))
            .order_by(ST_Distance(Zone.geometry, target))
            .first()
        )
        if not zone_row:
            return None

        zone, z_lng, z_lat = zone_row

    # Each dropdown zone has its own coordinates, so fetch its live weather
    # first rather than presenting a misleading all-zero database fallback.
    live_weather = _get_live_weather(lat, lng)
    if live_weather:
        return live_weather

    reading = (
        db.query(WeatherReading)
        .filter(WeatherReading.zone_id == zone.id)
        .order_by(WeatherReading.recorded_at.desc())
        .first()
    )

    if reading:
        return {
            "lat": lat,
            "lng": lng,
            "rainfall_24h": reading.rainfall_24h,
            "rainfall_72h": reading.rainfall_72h,
            "rainfall_7d": reading.rainfall_7d,
            "rainfall_intensity_peak": reading.rainfall_intensity_peak,
            "antecedent_rainfall_index": reading.antecedent_rainfall_index,
            "forecast_next_24h": reading.forecast_next_24h,
            "source": reading.source,
        }

    # Do not present zeroes as live conditions. The caller will return a 404
    # until either the provider or a stored station reading is available.
    return None


def get_soil_moisture(db: Session, zone_id: Optional[str] = None) -> List[dict]:
    q = db.query(SoilSensor, Zone.zone_id.label("z_zone_id"))
    q = q.join(Zone, SoilSensor.zone_id == Zone.id)

    if zone_id:
        q = q.filter(Zone.zone_id == zone_id)

    results = []
    for sensor, z_zone_id in q.all():
        results.append({
            "sensor_id": sensor.sensor_id,
            "zone_id": z_zone_id,
            "moisture": sensor.moisture,
            "timestamp": sensor.recorded_at,
        })
    return results
