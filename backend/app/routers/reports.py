"""
Field reports router — POST (multipart), GET, PATCH.
"""
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.schemas import FieldReportOut, FieldReportCreatedOut, FieldReportPatchIn
from app.services import reports_service
from app.services import image_analysis_service
from app.core.security import get_current_user, get_current_user_optional

router = APIRouter()


@router.post("/field-reports", response_model=FieldReportCreatedOut, status_code=201)
async def create_field_report(
    lat: float = Form(...),
    lng: float = Form(...),
    description: Optional[str] = Form(None),
    reporter_type: str = Form("citizen"),
    language: str = Form("en"),
    client_report_id: Optional[str] = Form(None),
    timestamp: Optional[str] = Form(None),
    severity: Optional[str] = Form("medium"),
    photo: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    # Parse timestamp
    ts: Optional[datetime] = None
    if timestamp:
        try:
            ts = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
        except ValueError:
            pass

    # Save photo if provided
    photo_url: Optional[str] = None
    if photo and photo.filename:
        # Temporary ID for naming — will be replaced after report creation
        import uuid
        temp_id = f"FR-TEMP-{uuid.uuid4().hex[:8]}"
        photo_url = reports_service.save_photo(photo, temp_id)

    report = reports_service.create_report(
        db=db,
        lat=lat,
        lng=lng,
        description=description,
        photo_url=photo_url,
        # Never trust a client-supplied reporter type for public alert delivery.
        reporter_type=(
            "official"
            if current_user and current_user.get("role") in ("district_admin", "field_official")
            else "citizen"
        ),
        language=language,
        client_report_id=client_report_id,
        timestamp=ts,
        severity=severity,
    )
    return {
        "report_id": report.report_id,
        "status": report.status.value,
        "severity": report.severity.value if report.severity else "medium",
        "photo_url": report.photo_url,
    }


@router.post("/analyze-road-image", status_code=200)
async def analyze_road_image(
    photo: UploadFile = File(...),
):
    """
    Accepts an uploaded image and uses Gemini Vision to detect whether
    the road in the photo is blocked, partially blocked, or clear.

    Returns:
        road_status: "blocked" | "partial" | "clear" | "unknown"
        confidence:  "high" | "medium" | "low"
        reason:      Short human-readable explanation
        hazard_type: Type of hazard detected
        suggested_severity: "critical" | "high" | "medium" | "low"
    """
    image_bytes = await photo.read()
    mime_type = photo.content_type or "image/jpeg"
    result = image_analysis_service.analyze_road_image(image_bytes, mime_type)
    return result

@router.get("/field-reports", response_model=List[FieldReportOut])
def list_field_reports(
    status: Optional[str] = None,
    zone_id: Optional[str] = None,
    since: Optional[str] = None,
    db: Session = Depends(get_db),
):
    since_dt: Optional[datetime] = None
    if since:
        try:
            since_dt = datetime.fromisoformat(since.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(status_code=422, detail="Invalid 'since' datetime format")
    return reports_service.get_reports(db, status=status, zone_id=zone_id, since=since_dt)


@router.patch("/field-reports/{report_id}", status_code=200)
def patch_field_report(
    report_id: str,
    body: FieldReportPatchIn,
    db: Session = Depends(get_db),
):
    if body.status:
        allowed_statuses = ("received", "verified", "dismissed", "archived")
        if body.status not in allowed_statuses:
            raise HTTPException(status_code=422, detail=f"status must be one of {allowed_statuses}")

    if body.severity:
        allowed_severities = ("low", "medium", "high", "critical")
        if body.severity not in allowed_severities:
            raise HTTPException(status_code=422, detail=f"severity must be one of {allowed_severities}")

    result = reports_service.patch_report(db, report_id=report_id, status=body.status, severity=body.severity)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Report {report_id} not found")
    return result


@router.delete("/field-reports/{report_id}", status_code=200)
def delete_field_report(
    report_id: str,
    db: Session = Depends(get_db),
):
    success = reports_service.delete_report(db, report_id=report_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Report {report_id} not found")
    return {"message": "Report removed successfully", "report_id": report_id}
