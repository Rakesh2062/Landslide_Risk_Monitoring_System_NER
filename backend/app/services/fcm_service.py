"""Firebase Cloud Messaging delivery for registered web browsers."""
import json
import logging
from functools import lru_cache

from app.core.config import settings
from app.models.models import User, UserDevice

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _firebase_app():
    if not settings.firebase_service_account_json:
        return None
    try:
        import firebase_admin
        from firebase_admin import credentials

        if firebase_admin._apps:
            return firebase_admin.get_app()
        account = json.loads(settings.firebase_service_account_json)
        return firebase_admin.initialize_app(credentials.Certificate(account))
    except Exception:
        logger.exception("FCM initialization failed")
        return None


def send_alert_notification(db, *, title: str, body: str, alert_id: str, severity: str, channels=None) -> int:
    """Send a notification to subscribed browser tokens and prune invalid tokens."""
    app = _firebase_app()
    if app is None:
        return 0
    tokens = [
        row[0]
        for row in db.query(UserDevice.fcm_token)
        .join(User, UserDevice.user_id == User.id)
        .all()
    ]
    if not tokens:
        return 0

    from firebase_admin import messaging

    sent = 0
    invalid = []
    for token in tokens:
        try:
            messaging.send(
                messaging.Message(
                    notification=messaging.Notification(title=title, body=body[:512]),
                    data={
                        "alert_id": alert_id,
                        "severity": severity,
                        "channels": ",".join(channels or ["app"]),
                        "url": "/citizen/alerts",
                    },
                    token=token,
                ),
                app=app,
            )
            sent += 1
        except messaging.UnregisteredError:
            invalid.append(token)
        except Exception:
            logger.exception("FCM send failed for alert %s", alert_id)

    if invalid:
        db.query(UserDevice).filter(UserDevice.fcm_token.in_(invalid)).delete(synchronize_session=False)
        db.commit()
    return sent
