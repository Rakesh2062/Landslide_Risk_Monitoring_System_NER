"""
seed.py — Seed the database with realistic sample data for
East Khasi Hills, Meghalaya pilot district.

Run: python seed.py

Seeds: zones (with terrain columns), villages, roads, weather readings,
       soil sensors, risk history, alerts, and two users.
"""
import os
import sys
from datetime import datetime, timedelta, timezone

# Ensure app is on path
sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.models import (
    Zone, Village, Road, WeatherReading, SoilSensor,
    RiskHistory, Alert, User, SeverityEnum, RoadStatusEnum,
    ReporterTypeEnum, ReportStatusEnum, UserRoleEnum
)
from app.core.security import hash_password

from app.db.session import SessionLocal, engine

# GeoAlchemy2 WKT helpers
from geoalchemy2.shape import from_shape
from shapely.geometry import Point, LineString


def make_point(lat: float, lng: float):
    if engine.dialect.name == "sqlite":
        return f"POINT({lng} {lat})"
    return from_shape(Point(lng, lat), srid=4326)


def make_line(coords):  # coords = [(lat, lng), ...]
    if engine.dialect.name == "sqlite":
        pts = ", ".join(f"{lng} {lat}" for lat, lng in coords)
        return f"LINESTRING({pts})"
    return from_shape(LineString([(lng, lat) for lat, lng in coords]), srid=4326)


def seed(db: Session):
    # -------------------------------------------------------------- Users --
    USERS = [
        dict(username="admin_shillong", password="Admin@1234", role=UserRoleEnum.district_admin, district="East Khasi Hills"),
        dict(username="official_shillong", password="Admin@1234", role=UserRoleEnum.district_admin, district="East Khasi Hills"),
        dict(username="field_sohra", password="Field@1234", role=UserRoleEnum.field_official, district="East Khasi Hills"),
    ]
    for u in USERS:
        if not db.query(User).filter(User.username == u["username"]).first():
            obj = User(
                username=u["username"],
                hashed_password=hash_password(u["password"]),
                role=u["role"],
                district=u["district"],
                is_verified=True,
            )
            db.add(obj)
    db.commit()

    # ---------------------------------------------------------------- Zones --
    # 10 realistic zones in East Khasi Hills
    ZONES = [
        dict(
            zone_id="MEG-EKH-001", village_name="Shillong", district="East Khasi Hills",
            lat=25.5788, lng=91.8933, current_risk_score=0.21, current_severity=SeverityEnum.low,
            slope=18.5, aspect=210.0, elevation=1496.0, curvature=-0.18,
            dist_to_drainage=420.0, dist_to_history=2.5, landslide_freq_district=47,
        ),
        dict(
            zone_id="MEG-EKH-014", village_name="Sohra (Cherrapunji)", district="East Khasi Hills",
            lat=25.2840, lng=91.7325, current_risk_score=0.82, current_severity=SeverityEnum.high,
            slope=34.5, aspect=182.3, elevation=1420.0, curvature=-0.42,
            dist_to_drainage=310.0, dist_to_history=0.8, landslide_freq_district=47,
        ),
        dict(
            zone_id="MEG-EKH-022", village_name="Mawsynram", district="East Khasi Hills",
            lat=25.2971, lng=91.5828, current_risk_score=0.91, current_severity=SeverityEnum.critical,
            slope=41.2, aspect=155.0, elevation=1401.0, curvature=-0.55,
            dist_to_drainage=180.0, dist_to_history=0.4, landslide_freq_district=47,
        ),
        dict(
            zone_id="MEG-EKH-031", village_name="Nongpoh", district="Ri-Bhoi",
            lat=25.9058, lng=91.8712, current_risk_score=0.44, current_severity=SeverityEnum.medium,
            slope=22.3, aspect=270.0, elevation=920.0, curvature=-0.22,
            dist_to_drainage=560.0, dist_to_history=1.9, landslide_freq_district=32,
        ),
        dict(
            zone_id="MEG-EKH-042", village_name="Mawkyrwat", district="South West Khasi Hills",
            lat=25.1833, lng=91.3833, current_risk_score=0.33, current_severity=SeverityEnum.medium,
            slope=28.7, aspect=120.0, elevation=1100.0, curvature=-0.30,
            dist_to_drainage=390.0, dist_to_history=3.2, landslide_freq_district=28,
        ),
        dict(
            zone_id="MEG-EKH-005", village_name="Mairang", district="West Khasi Hills",
            lat=25.5628, lng=91.6238, current_risk_score=0.17, current_severity=SeverityEnum.low,
            slope=15.1, aspect=315.0, elevation=870.0, curvature=-0.10,
            dist_to_drainage=710.0, dist_to_history=4.5, landslide_freq_district=22,
        ),
        dict(
            zone_id="MEG-EKH-009", village_name="Laitkynsew", district="East Khasi Hills",
            lat=25.2400, lng=91.8100, current_risk_score=0.68, current_severity=SeverityEnum.high,
            slope=36.8, aspect=190.0, elevation=1300.0, curvature=-0.48,
            dist_to_drainage=240.0, dist_to_history=1.1, landslide_freq_district=47,
        ),
        dict(
            zone_id="MEG-EKH-017", village_name="Mawlyngkneng", district="East Khasi Hills",
            lat=25.3100, lng=91.6900, current_risk_score=0.55, current_severity=SeverityEnum.high,
            slope=31.0, aspect=200.0, elevation=1350.0, curvature=-0.38,
            dist_to_drainage=300.0, dist_to_history=1.5, landslide_freq_district=47,
        ),
        dict(
            zone_id="MEG-EKH-039", village_name="Mawphlang", district="East Khasi Hills",
            lat=25.4500, lng=91.7200, current_risk_score=0.29, current_severity=SeverityEnum.medium,
            slope=20.5, aspect=160.0, elevation=1670.0, curvature=-0.15,
            dist_to_drainage=500.0, dist_to_history=3.8, landslide_freq_district=47,
        ),
        dict(
            zone_id="MEG-EKH-046", village_name="Dawki", district="East Khasi Hills",
            lat=25.1872, lng=92.0164, current_risk_score=0.72, current_severity=SeverityEnum.high,
            slope=38.2, aspect=145.0, elevation=650.0, curvature=-0.51,
            dist_to_drainage=210.0, dist_to_history=0.9, landslide_freq_district=47,
        ),
    ]

    zone_objs = {}
    now = datetime.now(timezone.utc)

    for z in ZONES:
        existing = db.query(Zone).filter(Zone.zone_id == z["zone_id"]).first()
        if existing:
            zone_objs[z["zone_id"]] = existing
            continue
        obj = Zone(
            zone_id=z["zone_id"],
            village_name=z["village_name"],
            district=z["district"],
            geometry=make_point(z["lat"], z["lng"]),
            current_risk_score=z["current_risk_score"],
            current_severity=z["current_severity"],
            last_updated=now,
            slope=z["slope"],
            aspect=z["aspect"],
            elevation=z["elevation"],
            curvature=z["curvature"],
            dist_to_drainage=z["dist_to_drainage"],
            dist_to_history=z["dist_to_history"],
            landslide_freq_district=z["landslide_freq_district"],
        )
        db.add(obj)
        zone_objs[z["zone_id"]] = obj

    db.flush()  # get IDs

    # -------------------------------------------------------- Risk history --
    for zone_id_str, zone_obj in zone_objs.items():
        for days_ago in [14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]:
            existing = db.query(RiskHistory).filter(
                RiskHistory.zone_id == zone_obj.id,
            ).count()
            if existing >= 15:
                break
            base = zone_obj.current_risk_score
            # simulate gradual increase
            score = round(max(0.0, min(1.0, base - (days_ago * 0.03))), 3)
            rh = RiskHistory(
                zone_id=zone_obj.id,
                risk_score=score,
                recorded_at=now - timedelta(days=days_ago),
            )
            db.add(rh)

    # ---------------------------------------------------------- Villages --
    VILLAGES = [
        dict(village_id="V-001", name="Shillong", lat=25.5788, lng=91.8933, population=354759, zone_id="MEG-EKH-001"),
        dict(village_id="V-014", name="Sohra", lat=25.2840, lng=91.7325, population=15000, zone_id="MEG-EKH-014"),
        dict(village_id="V-022", name="Mawsynram", lat=25.2971, lng=91.5828, population=8000, zone_id="MEG-EKH-022"),
        dict(village_id="V-031", name="Nongpoh", lat=25.9058, lng=91.8712, population=24000, zone_id="MEG-EKH-031"),
        dict(village_id="V-442", name="Mawphlang", lat=25.4500, lng=91.7200, population=5500, zone_id="MEG-EKH-039"),
        dict(village_id="V-441", name="Laitkynsew", lat=25.2400, lng=91.8100, population=3200, zone_id="MEG-EKH-009"),
        dict(village_id="V-046", name="Dawki", lat=25.1872, lng=92.0164, population=12000, zone_id="MEG-EKH-046"),
        dict(village_id="V-017", name="Mawlyngkneng", lat=25.3100, lng=91.6900, population=6000, zone_id="MEG-EKH-017"),
    ]
    for v in VILLAGES:
        if not db.query(Village).filter(Village.village_id == v["village_id"]).first():
            obj = Village(
                village_id=v["village_id"],
                name=v["name"],
                geometry=make_point(v["lat"], v["lng"]),
                population=v["population"],
                zone_id=v["zone_id"],
            )
            db.add(obj)

    # ------------------------------------------------------------- Roads --
    ROADS = [
        dict(
            road_id="RD-2291",
            name="Shillong–Sohra Road (NH-6)",
            status=RoadStatusEnum.blocked,
            district="East Khasi Hills",
            # Road passes FROM Mawphlang area INTO and THROUGH Sohra zone
            # Sohra zone center: (25.2840, 91.7325), radius ~2200 m
            # All 3 points are within or at the edge of the hazard circle
            coords=[(25.3010, 91.7450), (25.2840, 91.7325), (25.2650, 91.7200)],
            last_updated=now - timedelta(hours=3),
        ),
        dict(
            road_id="RD-1105",
            name="NH-44 — Shillong Bypass",
            status=RoadStatusEnum.clear,
            district="East Khasi Hills",
            coords=[(25.5788, 91.8933), (25.6200, 91.9100), (25.6500, 91.9400)],
            last_updated=now - timedelta(hours=6),
        ),
        dict(
            road_id="RD-0882",
            name="Dawki–Laitkynsew Road",
            status=RoadStatusEnum.partial,
            district="East Khasi Hills",
            # Partial road passes through Laitkynsew zone (25.2400, 91.8100)
            coords=[(25.1872, 92.0164), (25.2400, 91.8100), (25.3200, 91.8300)],
            last_updated=now - timedelta(hours=1),
        ),
        dict(
            road_id="RD-0543",
            name="Mawsynram–Shillong Road",
            status=RoadStatusEnum.clear,
            district="East Khasi Hills",
            coords=[(25.2971, 91.5828), (25.3500, 91.6500), (25.5000, 91.7500)],
            last_updated=now - timedelta(hours=8),
        ),
    ]
    for r in ROADS:
        if not db.query(Road).filter(Road.road_id == r["road_id"]).first():
            obj = Road(
                road_id=r["road_id"],
                name=r["name"],
                status=r["status"],
                district=r["district"],
                geometry=make_line(r["coords"]),
                last_updated=r["last_updated"],
            )
            db.add(obj)

    # ------------------------------------------------------- Weather readings --
    WEATHER = [
        dict(zone_id="MEG-EKH-014", rainfall_24h=65.2, rainfall_72h=210.0, rainfall_7d=380.5, intensity=28.4, ari=145.7, forecast=40.0),
        dict(zone_id="MEG-EKH-022", rainfall_24h=88.5, rainfall_72h=290.0, rainfall_7d=510.0, intensity=42.1, ari=198.3, forecast=65.0),
        dict(zone_id="MEG-EKH-009", rainfall_24h=52.0, rainfall_72h=175.0, rainfall_7d=310.0, intensity=22.8, ari=118.5, forecast=35.0),
        dict(zone_id="MEG-EKH-001", rainfall_24h=20.1, rainfall_72h=65.0, rainfall_7d=110.0, intensity=8.4, ari=45.2, forecast=15.0),
        dict(zone_id="MEG-EKH-046", rainfall_24h=71.3, rainfall_72h=230.0, rainfall_7d=420.0, intensity=33.5, ari=160.1, forecast=50.0),
        dict(zone_id="MEG-EKH-017", rainfall_24h=48.7, rainfall_72h=160.0, rainfall_7d=290.0, intensity=20.1, ari=108.0, forecast=30.0),
    ]
    for w in WEATHER:
        zone = zone_objs.get(w["zone_id"])
        if zone and not db.query(WeatherReading).filter(WeatherReading.zone_id == zone.id).first():
            obj = WeatherReading(
                zone_id=zone.id,
                rainfall_24h=w["rainfall_24h"],
                rainfall_72h=w["rainfall_72h"],
                rainfall_7d=w["rainfall_7d"],
                rainfall_intensity_peak=w["intensity"],
                antecedent_rainfall_index=w["ari"],
                forecast_next_24h=w["forecast"],
                source="IMD",
                recorded_at=now,
            )
            db.add(obj)

    # ------------------------------------------------------ Soil sensors --
    SENSORS = [
        dict(sensor_id="SM-014", zone_id="MEG-EKH-014", moisture=0.61),
        dict(sensor_id="SM-022", zone_id="MEG-EKH-022", moisture=0.78),
        dict(sensor_id="SM-009", zone_id="MEG-EKH-009", moisture=0.55),
        dict(sensor_id="SM-001", zone_id="MEG-EKH-001", moisture=0.31),
        dict(sensor_id="SM-046", zone_id="MEG-EKH-046", moisture=0.67),
        dict(sensor_id="SM-017", zone_id="MEG-EKH-017", moisture=0.49),
    ]
    for s in SENSORS:
        zone = zone_objs.get(s["zone_id"])
        if zone and not db.query(SoilSensor).filter(SoilSensor.sensor_id == s["sensor_id"]).first():
            obj = SoilSensor(
                sensor_id=s["sensor_id"],
                zone_id=zone.id,
                moisture=s["moisture"],
                recorded_at=now,
            )
            db.add(obj)

    # ------------------------------------------------------------- Alerts --
    ALERTS_DATA = [
        dict(zone_id="MEG-EKH-022", severity=SeverityEnum.critical, message="CRITICAL: Imminent landslide risk. Evacuate immediately. Follow official instructions.", lang="en", channels=["sms", "app"], recipients=8000),
        dict(zone_id="MEG-EKH-014", severity=SeverityEnum.high, message="Heavy rainfall detected. Risk of slope failure — avoid travel near NH-206.", lang="en", channels=["sms", "app"], recipients=15000),
        dict(zone_id="MEG-EKH-046", severity=SeverityEnum.high, message="Heavy rainfall detected. Risk of slope failure — avoid travel in this area.", lang="en", channels=["app"], recipients=12000),
    ]
    alert_counter = 300
    for a in ALERTS_DATA:
        alert_counter += 1
        alert_id = f"AL-{alert_counter}"
        zone = zone_objs.get(a["zone_id"])
        if zone and not db.query(Alert).filter(Alert.alert_id == alert_id).first():
            obj = Alert(
                alert_id=alert_id,
                zone_id=zone.id,
                severity=a["severity"],
                message=a["message"],
                language=a["lang"],
                channels=a["channels"],
                sent_at=now - timedelta(minutes=30),
                recipients_count=a["recipients"],
            )
            db.add(obj)

    # -------------------------------------------------------------- Users --
    USERS = [
        dict(username="admin_shillong", password="Admin@1234", role=UserRoleEnum.district_admin, district="East Khasi Hills"),
        dict(username="official_shillong", password="Admin@1234", role=UserRoleEnum.district_admin, district="East Khasi Hills"),
        dict(username="field_sohra", password="Field@1234", role=UserRoleEnum.field_official, district="East Khasi Hills"),
    ]
    for u in USERS:
        if not db.query(User).filter(User.username == u["username"]).first():
            obj = User(
                username=u["username"],
                hashed_password=hash_password(u["password"]),
                role=u["role"],
                district=u["district"],
            )
            db.add(obj)

    db.commit()
    print("Seed data inserted successfully!")
    print("\n--- Demo credentials ---")
    print("  Admin:     username=admin_shillong     password=Admin@1234  role=district_admin")
    print("  Official:  username=official_shillong  password=Admin@1234  role=district_admin")
    print("  Field:     username=field_sohra        password=Field@1234  role=field_official")


if __name__ == "__main__":
    db = SessionLocal()
    try:
        seed(db)
    finally:
        db.close()
