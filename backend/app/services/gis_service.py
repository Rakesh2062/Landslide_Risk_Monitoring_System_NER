"""
GIS service — roads and villages.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import List, Optional

from geoalchemy2.functions import ST_X, ST_Y, ST_AsGeoJSON
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.models import Road, Village, Zone, RoadStatusEnum
from app.db.session import engine


def make_line(coords):
    """Build a geometry LINESTRING from [(lat, lng), ...] list."""
    from shapely.geometry import LineString
    from geoalchemy2.shape import from_shape
    if engine.dialect.name == "sqlite":
        pts = ", ".join(f"{lng} {lat}" for lat, lng in coords)
        return f"LINESTRING({pts})"
    return from_shape(LineString([(lng, lat) for lat, lng in coords]), srid=4326)


def _parse_wkt_linestring(wkt: str) -> List[List[float]]:
    if not wkt or "LINESTRING(" not in wkt:
        return []
    try:
        clean = wkt.replace("LINESTRING(", "").replace(")", "").strip()
        pts = clean.split(",")
        coords = []
        for p in pts:
            parts = p.strip().split()
            coords.append([float(parts[1]), float(parts[0])])
        return coords
    except Exception:
        return []


def _linestring_geojson_to_coords(geojson_str: Optional[str]) -> List[List[float]]:
    """Parse ST_AsGeoJSON output (GeoJSON string) to [[lat, lng], ...] list."""
    if not geojson_str:
        return []
    try:
        geojson = json.loads(geojson_str)
        # GeoJSON coordinates are [lng, lat] — spec says [lat, lng]
        return [[c[1], c[0]] for c in geojson["coordinates"]]
    except Exception:
        return []


def _road_to_dict(road: Road, geojson_str: Optional[str] = None) -> dict:
    if engine.dialect.name == "sqlite":
        coords = _parse_wkt_linestring(str(road.geometry))
    else:
        coords = _linestring_geojson_to_coords(geojson_str)
    return {
        "road_id": road.road_id,
        "name": road.name,
        "status": road.status.value if road.status else "clear",
        "coordinates": coords,
        "last_updated": road.last_updated,
    }


def get_roads(
    db: Session,
    district: Optional[str] = None,
    status: Optional[str] = None,
) -> List[dict]:
    if engine.dialect.name == "sqlite":
        q = db.query(Road)
        if district:
            q = q.filter(func.lower(Road.district) == district.lower())
        if status:
            try:
                status_enum = RoadStatusEnum(status)
                q = q.filter(Road.status == status_enum)
            except ValueError:
                return []
        return [_road_to_dict(road) for road in q.all()]

    q = db.query(Road, ST_AsGeoJSON(Road.geometry).label("geojson"))
    if district:
        q = q.filter(func.lower(Road.district) == district.lower())
    if status:
        try:
            status_enum = RoadStatusEnum(status)
            q = q.filter(Road.status == status_enum)
        except ValueError:
            return []
    return [_road_to_dict(road, geojson) for road, geojson in q.all()]


def patch_road(db: Session, road_id: str, status: str) -> Optional[dict]:
    road = db.query(Road).filter(Road.road_id == road_id).first()
    if not road:
        return None
    road.status = RoadStatusEnum(status)
    road.last_updated = datetime.now(timezone.utc)
    db.commit()
    db.refresh(road)

    if engine.dialect.name == "sqlite":
        return _road_to_dict(road)

    # Fetch with GeoJSON
    row = db.query(Road, ST_AsGeoJSON(Road.geometry).label("geojson")).filter(
        Road.road_id == road_id
    ).first()
    if row:
        return _road_to_dict(row[0], row[1])
    return _road_to_dict(road)


def get_villages(db: Session) -> List[dict]:
    if engine.dialect.name == "sqlite":
        villages = db.query(Village).all()
        results = []
        for village in villages:
            lng, lat = 0.0, 0.0
            if village.geometry and "POINT(" in str(village.geometry):
                try:
                    c = str(village.geometry).replace("POINT(", "").replace(")", "").strip().split()
                    lng, lat = float(c[0]), float(c[1])
                except Exception:
                    pass
            results.append({
                "village_id": village.village_id,
                "name": village.name,
                "lat": lat,
                "lng": lng,
                "population": village.population,
                "zone_id": village.zone_id,
            })
        return results

    rows = db.query(
        Village,
        ST_X(Village.geometry).label("lng"),
        ST_Y(Village.geometry).label("lat"),
    ).all()
    results = []
    for village, lng, lat in rows:
        results.append({
            "village_id": village.village_id,
            "name": village.name,
            "lat": lat,
            "lng": lng,
            "population": village.population,
            "zone_id": village.zone_id,
        })
    return results


def create_road_from_report(
    db: Session,
    report_id: str,
    lat: float,
    lng: float,
    road_status: str,
    road_name: Optional[str] = None,
    district: Optional[str] = None,
) -> Optional[dict]:
    """
    Dynamically creates (or updates) a road segment at the citizen-reported
    GPS location.  The segment is a short ±0.005° (~500 m) E-W line centred
    on (lat, lng) so it renders visibly on the map.

    If a citizen-report road already exists very close to this point
    (within ~1 km), its status is updated instead of creating a duplicate.

    Args:
        report_id:   Field-report ID used to build a unique road_id
        lat, lng:    GPS coordinates from the submitted report
        road_status: "blocked" | "partial" | "clear"
        road_name:   Optional descriptive name; falls back to a generated name
        district:    Optional district name

    Returns:
        Road dict if successful, None on error
    """
    from datetime import datetime, timezone
    from app.models.models import Road, RoadStatusEnum

    if road_status not in ("blocked", "partial", "clear"):
        road_status = "blocked"

    # ── Check for a nearby existing citizen-report road (within ~0.01° ≈ 1 km)
    THRESH = 0.01
    existing_road = (
        db.query(Road)
        .filter(Road.road_id.like("RD-REPORT-%"))
        .all()
    )

    for road in existing_road:
        # Parse its geometry centroid to compare
        geom_str = str(road.geometry) if engine.dialect.name == "sqlite" else None
        try:
            if geom_str and "LINESTRING(" in geom_str:
                clean = geom_str.replace("LINESTRING(", "").replace(")", "")
                pts = [p.strip().split() for p in clean.split(",")]
                c_lng = sum(float(p[0]) for p in pts) / len(pts)
                c_lat = sum(float(p[1]) for p in pts) / len(pts)
                if abs(c_lat - lat) < THRESH and abs(c_lng - lng) < THRESH:
                    # Update status of the existing road
                    road.status = RoadStatusEnum(road_status)
                    road.last_updated = datetime.now(timezone.utc)
                    db.commit()
                    db.refresh(road)
                    return _road_to_dict(road)
        except Exception:
            pass

    # ── Create a new short segment centred on the report point
    new_road_id = f"RD-REPORT-{report_id}"
    name = road_name or f"Citizen-Reported Hazard ({lat:.4f}, {lng:.4f})"

    # 500 m segment: offset lng by ±0.005° (~550 m at equator)
    half = 0.005
    coords = [(lat, lng - half), (lat, lng), (lat, lng + half)]

    try:
        obj = Road(
            road_id=new_road_id,
            name=name,
            status=RoadStatusEnum(road_status),
            district=district or "East Khasi Hills",
            geometry=make_line(coords),
            last_updated=datetime.now(timezone.utc),
        )
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return _road_to_dict(obj)
    except Exception as e:
        print(f"[GIS] create_road_from_report error: {e}")
        db.rollback()
        return None

