"""
Pydantic schemas — every request/response body defined here.
Field names match the API contract exactly.
"""
from __future__ import annotations

from datetime import datetime, date
from typing import List, Optional, Any
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Shared / enums
# ---------------------------------------------------------------------------

class SeverityLiteral(str):
    pass


# ---------------------------------------------------------------------------
# Risk / prediction
# ---------------------------------------------------------------------------

class RiskZoneOut(BaseModel):
    zone_id: str
    village_name: str
    lat: float
    lng: float
    risk_score: float
    severity: str
    last_updated: datetime

    class Config:
        from_attributes = True


class PredictRiskIn(BaseModel):
    slope: float
    aspect: float
    elevation: float
    curvature: float
    dist_to_drainage: float
    rainfall_24h: float
    rainfall_72h: float
    rainfall_7d: float
    rainfall_intensity_peak: float
    antecedent_rainfall_index: float
    soil_moisture: float
    dist_to_history: float
    landslide_density_5km: float


class PredictRiskOut(BaseModel):
    risk_score: float
    severity: str
    model_source: str
    model_version: str


class RiskHistoryPoint(BaseModel):
    date: str   # "YYYY-MM-DD"
    risk_score: float


class RiskHistoryOut(BaseModel):
    zone_id: str
    history: List[RiskHistoryPoint]


# ---------------------------------------------------------------------------
# Weather
# ---------------------------------------------------------------------------

class WeatherCurrentOut(BaseModel):
    lat: float
    lng: float
    rainfall_24h: float
    rainfall_72h: float
    rainfall_7d: float
    rainfall_intensity_peak: float
    antecedent_rainfall_index: float
    forecast_next_24h: float
    source: str


# ---------------------------------------------------------------------------
# Sensors
# ---------------------------------------------------------------------------

class SoilMoistureOut(BaseModel):
    sensor_id: str
    zone_id: str
    moisture: float
    timestamp: datetime

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Roads
# ---------------------------------------------------------------------------

class RoadOut(BaseModel):
    road_id: str
    name: str
    status: str
    coordinates: List[List[float]]
    last_updated: datetime

    class Config:
        from_attributes = True


class RoadPatchIn(BaseModel):
    status: str  # "clear" | "partial" | "blocked"


# ---------------------------------------------------------------------------
# Villages
# ---------------------------------------------------------------------------

class VillageOut(BaseModel):
    village_id: str
    name: str
    lat: float
    lng: float
    population: int
    zone_id: Optional[str]

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Field reports
# ---------------------------------------------------------------------------

class FieldReportOut(BaseModel):
    report_id: str
    lat: float
    lng: float
    description: Optional[str]
    photo_url: Optional[str]
    status: str
    severity: Optional[str] = "medium"
    reporter_type: str
    timestamp: datetime

    class Config:
        from_attributes = True


class FieldReportCreatedOut(BaseModel):
    report_id: str
    status: str
    severity: Optional[str] = "medium"
    photo_url: Optional[str]


class FieldReportPatchIn(BaseModel):
    status: Optional[str] = None    # "received" | "verified" | "dismissed"
    severity: Optional[str] = None  # "low" | "medium" | "high" | "critical"


# ---------------------------------------------------------------------------
# Alerts
# ---------------------------------------------------------------------------

class AlertOut(BaseModel):
    alert_id: str
    village: Optional[str] = "Sohra"
    zone_id: str
    severity: str
    message: str
    description: Optional[str] = None
    language: Optional[str] = "en"
    sent_via: Optional[List[str]] = ["app"]
    channels: Optional[List[str]] = ["app"]
    timestamp: Optional[datetime] = None
    sent_at: Optional[datetime] = None
    lat: Optional[float] = None
    lng: Optional[float] = None

    class Config:
        from_attributes = True


class AlertCreateIn(BaseModel):
    zone_id: str
    severity: str
    message_key: str
    languages: List[str] = ["en"]
    channels: List[str] = ["app"]
    custom_message: Optional[str] = None


class AlertCreatedOut(BaseModel):
    alert_id: str
    status: str
    recipients_count: int


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

class TopPriorityZone(BaseModel):
    zone_id: str
    village_name: str
    risk_score: float


class DashboardSummaryOut(BaseModel):
    total_zones_monitored: int
    high_risk_zones: int
    roads_blocked: int
    active_alerts: int
    reports_last_24h: int
    top_priority_zones: List[TopPriorityZone]


# ---------------------------------------------------------------------------
# Offline sync
# ---------------------------------------------------------------------------

class SyncReportItem(BaseModel):
    client_report_id: str
    lat: float
    lng: float
    description: Optional[str] = None
    timestamp: Optional[datetime] = None
    reporter_type: Optional[str] = "citizen"
    language: Optional[str] = "en"


class SyncFieldReportsIn(BaseModel):
    reports: List[SyncReportItem]


class SyncFieldReportsOut(BaseModel):
    synced: List[str]
    failed: List[str]


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class LoginIn(BaseModel):
    username: str
    password: str


class LoginOut(BaseModel):
    token: str
    role: str
    district: Optional[str]
    is_verified: bool = False


class GoogleAuthIn(BaseModel):
    credential: str

# Registration schemas
class UserRegisterIn(BaseModel):
    username: str
    password: str
    district: Optional[str] = None
    # proof file handled separately in endpoint

class UserRegisterOut(BaseModel):
    user_id: int
    is_verified: bool = False
