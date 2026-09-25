"""
GIS / infrastructure router — roads and villages.
"""
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.schemas import RoadOut, RoadPatchIn, VillageOut
from app.services import gis_service
from app.core.security import require_admin

router = APIRouter()


@router.get("/roads", response_model=List[RoadOut])
def list_roads(
    district: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    return gis_service.get_roads(db, district=district, status=status)


@router.patch("/roads/{road_id}", response_model=RoadOut)
def update_road(
    road_id: str,
    body: RoadPatchIn,
    db: Session = Depends(get_db),
    _user=Depends(require_admin),
):
    allowed = ("clear", "partial", "blocked")
    if body.status not in allowed:
        raise HTTPException(status_code=422, detail=f"status must be one of {allowed}")
    result = gis_service.patch_road(db, road_id=road_id, status=body.status)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Road {road_id} not found")
    return result


class RoadFromReportIn(BaseModel):
    report_id: str
    lat: float
    lng: float
    road_status: str          # "blocked" | "partial" | "clear"
    road_name: Optional[str] = None
    district: Optional[str] = None


@router.post("/roads/from-report", status_code=201)
def create_road_from_report(
    body: RoadFromReportIn,
    db: Session = Depends(get_db),
):
    """
    Called automatically after a citizen submits a report with an AI-detected
    road blockage. Creates (or updates) a short road segment at the reported
    GPS coordinates so the map immediately shows the affected road.
    """
    allowed = ("blocked", "partial", "clear")
    if body.road_status not in allowed:
        raise HTTPException(status_code=422, detail=f"road_status must be one of {allowed}")

    result = gis_service.create_road_from_report(
        db=db,
        report_id=body.report_id,
        lat=body.lat,
        lng=body.lng,
        road_status=body.road_status,
        road_name=body.road_name,
        district=body.district,
    )
    if result is None:
        raise HTTPException(status_code=500, detail="Failed to create road segment")
    return result


@router.get("/villages", response_model=List[VillageOut])
def list_villages(db: Session = Depends(get_db)):
    return gis_service.get_villages(db)
