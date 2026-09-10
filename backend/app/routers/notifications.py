"""Authenticated browser notification subscription endpoints."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.models import User, UserDevice

router = APIRouter()


class DeviceTokenIn(BaseModel):
    token: str = Field(min_length=20, max_length=512)


@router.post("/notifications/devices", status_code=status.HTTP_204_NO_CONTENT)
def register_device(
    body: DeviceTokenIn,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.username == current_user.get("sub")).first()
    if not user:
        raise HTTPException(status_code=401, detail="User account no longer exists.")
    device = db.query(UserDevice).filter(UserDevice.fcm_token == body.token).first()
    if device:
        device.user_id = user.id
        device.updated_at = datetime.now(timezone.utc)
    else:
        db.add(UserDevice(user_id=user.id, fcm_token=body.token))
    db.commit()


@router.delete("/notifications/devices", status_code=status.HTTP_204_NO_CONTENT)
def unregister_device(
    body: DeviceTokenIn,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.username == current_user.get("sub")).first()
    if user:
        db.query(UserDevice).filter(
            UserDevice.user_id == user.id, UserDevice.fcm_token == body.token
        ).delete(synchronize_session=False)
        db.commit()
