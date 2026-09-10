"""
Alerts service — create and list alerts; mock SMS sending.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.models import Alert, Zone, Village, SeverityEnum
from app.core.config import settings

logger = logging.getLogger(__name__)


def _next_alert_id(db: Session) -> str:
    count = db.query(func.count(Alert.id)).scalar() or 0
    return f"AL-{300 + count + 1}"


# Message templates keyed by message_key + language
_MESSAGE_TEMPLATES = {
    "landslide_risk_high": {
        "en": "Heavy rainfall detected. Risk of slope failure — avoid travel near landslide-prone areas.",
        "kha": "Ka jingpdiang u umsyiem bha lah biang. Ka jingphah ka slope — kwah ban leit ban leit.",
        "as": "গধুৰ বৰষুণ ধৰা পৰিছে। ঢাল বিপৰ্যয়ৰ আশংকা আছে — বিপদসংকুল অঞ্চলত যাতায়াত পৰিহাৰ কৰক।",
        "lus": "Ruah lian a sur ta a. Tlang khelhna a awm thei — NH-206 lama zin suh.",
    },
    "landslide_risk_critical": {
        "en": "CRITICAL: Imminent landslide risk. Evacuate immediately. Follow official instructions.",
        "kha": "CRITICAL: Ka khynmaw ka jingphah jong ka slope. Ia wan kynmaw lait. Pynsniew ia ki jingkyrteng ofisial.",
    },
    "road_blocked": {
        "en": "Road closure reported in your district due to landslide activity.",
    },
}


def _resolve_message(
    message_key: str,
    language: str,
    zone_name: str = "",
    zone_id: str = "",
) -> str:

    lang_map = _MESSAGE_TEMPLATES.get(message_key, {})
    template = lang_map.get(language) or lang_map.get("en")

    if not template:
        return f"Alert: {message_key}"

    if message_key == "landslide_risk_critical":
        return (
            "⚠️ LANDSLIDE ALERT\n\n"
            "CRITICAL: Imminent landslide risk detected.\n\n"
            f"Location: {zone_name}\n"
            f"Zone: {zone_id}\n\n"
            "Evacuate immediately and follow official instructions."
        )

    if message_key == "landslide_risk_high":
        return (
            "⚠️ LANDSLIDE RISK ALERT\n\n"
            "Heavy rainfall detected. High risk of slope failure.\n\n"
            f"Location: {zone_name}\n"
            f"Zone: {zone_id}\n\n"
            "Avoid travel near landslide-prone areas."
        )

    return template


def _mock_send(
    channels: List[str],
    zone_id_str: str,
    message: str,
    recipients_count: int,
) -> None:
    """Send real SMS through Twilio when SMS is enabled; otherwise mock."""

    # Handle non-SMS channels as before
    for channel in channels:
        if channel != "sms":
            logger.info(
                "[MOCK-%s] zone=%s recipients=%d | %s",
                channel.upper(),
                zone_id_str,
                recipients_count,
                message,
            )

    # SMS not requested
    if "sms" not in channels:
        return

    # Safety switch
    if not getattr(settings, "sms_enabled", False):
        logger.info(
            "[SMS-DISABLED] zone=%s recipients=%d",
            zone_id_str,
            recipients_count,
        )
        return

    recipients = [
        number.strip()
        for number in getattr(settings, "sms_broadcast_recipients", "").split(",")
        if number.strip()
    ]
    # Backwards-compatible single-recipient setting for local demos.
    if not recipients and getattr(settings, "sms_demo_recipient", ""):
        recipients = [settings.sms_demo_recipient]

    if not recipients:
        logger.warning("[SMS-SKIPPED] No SMS_BROADCAST_RECIPIENTS configured.")
        return

    try:
        from twilio.rest import Client

        client = Client(
            settings.twilio_account_sid,
            settings.twilio_auth_token,
        )

        for recipient in recipients:
            sms = client.messages.create(
                body=message[:1600],
                from_=settings.twilio_from_number,
                to=recipient,
            )
            logger.info(
                "[TWILIO] SMS accepted. zone=%s recipient=%s message_sid=%s",
                zone_id_str,
                recipient[-4:],
                sms.sid,
            )

    except Exception as e:
        logger.exception(
            "[TWILIO ERROR] zone=%s error=%s",
            zone_id_str,
            e,
        )

def _estimate_recipients(db: Session, zone_id_int: int) -> int:
    """Rough estimate: sum village populations in zone."""
    rows = db.query(Village).filter(Village.zone_id.in_(
        db.query(Zone.zone_id).filter(Zone.id == zone_id_int)
    )).all()
    total = sum(v.population for v in rows)
    return total if total > 0 else 500  # default fallback


def create_alert(db: Session, data: dict) -> dict:
    zone = db.query(Zone).filter(Zone.zone_id == data["zone_id"]).first()
    if not zone:
        raise ValueError(f"Zone {data['zone_id']} not found")

    languages = data.get("languages", ["en"])
    channels = data.get("channels", ["app"])
    recipients_count = _estimate_recipients(db, zone.id)
    alert_id = _next_alert_id(db)

    # Create one alert record per language (store primary language version)
    primary_lang = languages[0]
    message = (data.get("custom_message") or "").strip() or _resolve_message(
        data["message_key"],
        primary_lang,
        zone_name=f"{zone.village_name}, {zone.district}",
        zone_id=data["zone_id"],
    )

    alert = Alert(
        alert_id=alert_id,
        zone_id=zone.id,
        severity=SeverityEnum(data["severity"]),
        message=message,
        language=primary_lang,
        channels=channels,
        sent_at=datetime.now(timezone.utc),
        recipients_count=recipients_count,
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)

    _mock_send(channels, data["zone_id"], message, recipients_count)
    if "push" in channels or "app" in channels:
        from app.services.fcm_service import send_alert_notification
        sent = send_alert_notification(
            db,
            title=f"{data['severity'].upper()} landslide alert",
            body=message,
            alert_id=alert_id,
            severity=data["severity"],
            channels=channels,
        )
        logger.info("FCM sent alert=%s delivered=%d", alert_id, sent)

    return {"alert_id": alert_id, "status": "sent", "recipients_count": recipients_count}


def get_alerts(
    db: Session,
    village_id: Optional[str] = None,
    severity: Optional[str] = None,
) -> List[dict]:
    q = db.query(Alert, Zone)
    q = q.join(Zone, Alert.zone_id == Zone.id)

    if village_id:
        village = db.query(Village).filter(Village.village_id == village_id).first()
        if village and village.zone_id:
            q = q.filter(Zone.zone_id == village.zone_id)
        else:
            return []

    if severity:
        try:
            sev_enum = SeverityEnum(severity)
            q = q.filter(Alert.severity == sev_enum)
        except ValueError:
            return []

    results = []
    for alert, zone in q.order_by(Alert.sent_at.desc()).all():
        # Prefer alert-level lat/lng (stored from field reports) over zone geometry
        lat = alert.lat if alert.lat is not None else None
        lng = alert.lng if alert.lng is not None else None

        # Fall back to zone geometry if alert doesn't have its own coordinates
        if lat is None or lng is None:
            if zone.geometry and "POINT(" in str(zone.geometry):
                try:
                    coords = str(zone.geometry).replace("POINT(", "").replace(")", "").strip().split()
                    lng, lat = float(coords[0]), float(coords[1])
                except Exception:
                    pass

        results.append({
            "alert_id": alert.alert_id,
            "village": zone.village_name,
            "zone_id": zone.zone_id,
            "severity": alert.severity.value if hasattr(alert.severity, "value") else str(alert.severity) if alert.severity else "low",
            "message": alert.message,
            "description": alert.description or alert.message,
            "language": alert.language,
            "channels": alert.channels or [],
            "sent_via": alert.channels or [],
            "sent_at": alert.sent_at,
            "timestamp": alert.sent_at,
            "lat": lat,
            "lng": lng,
        })
    return results

