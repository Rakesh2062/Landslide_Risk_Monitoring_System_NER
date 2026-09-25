"""
Auth router — login returns JWT, registration with residency proof, and verification endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Form, File, UploadFile
from typing import Optional
from sqlalchemy.orm import Session
import os, re, secrets, shutil
from datetime import datetime

from app.db.session import get_db
from app.schemas.schemas import GoogleAuthIn, LoginIn, LoginOut, UserRegisterIn, UserRegisterOut
from app.models.models import User, UserRoleEnum
from app.core.security import verify_password, create_access_token, hash_password, get_current_user
from app.core.config import settings

router = APIRouter()


def _google_username(email: str, db: Session) -> str:
    """Create a stable, unique local username without treating email as identity."""
    base = re.sub(r"[^a-zA-Z0-9_.-]", "_", email.split("@", 1)[0])[:130] or "google_user"
    candidate = base
    suffix = 1
    while db.query(User.id).filter(User.username == candidate).first():
        suffix_text = f"_{suffix}"
        candidate = f"{base[:150 - len(suffix_text)]}{suffix_text}"
        suffix += 1
    return candidate


def _verify_google_credential(credential: str) -> tuple[str, str]:
    if not settings.google_oauth_client_id:
        raise HTTPException(status_code=503, detail="Google sign-in is not configured.")
    try:
        from google.auth.transport import requests as google_requests
        from google.oauth2 import id_token

        identity = id_token.verify_oauth2_token(
            credential, google_requests.Request(), settings.google_oauth_client_id
        )
    except (ValueError, ImportError) as exc:
        raise HTTPException(status_code=401, detail="Invalid Google credential.") from exc

    google_sub = identity.get("sub")
    email = identity.get("email")
    if not google_sub or not email or not identity.get("email_verified"):
        raise HTTPException(status_code=401, detail="Google account email is not verified.")
    return google_sub, email


@router.post("/auth/login", response_model=LoginOut)
def login(body: LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == body.username).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )
    token = create_access_token(
        data={"sub": user.username, "role": user.role.value, "district": user.district, "is_verified": bool(user.is_verified)}
    )
    return {
        "token": token,
        "role": user.role.value,
        "district": user.district,
        "is_verified": bool(user.is_verified),
        "username": user.username,
    }


@router.post("/auth/google", response_model=LoginOut)
def google_auth(body: GoogleAuthIn, db: Session = Depends(get_db)):
    """Sign in an existing residency-registered Google account."""
    google_sub, _ = _verify_google_credential(body.credential)
    user = db.query(User).filter(User.google_sub == google_sub).first()
    if not user:
        raise HTTPException(status_code=404, detail="No Google account is registered. Submit residency proof first.")

    token = create_access_token(
        data={"sub": user.username, "role": user.role.value, "district": user.district, "is_verified": bool(user.is_verified)}
    )
    return {
        "token": token,
        "role": user.role.value,
        "district": user.district,
        "is_verified": bool(user.is_verified),
        "username": user.username,
    }


@router.get("/auth/me")
def get_me(db: Session = Depends(get_db), current_user_token: dict = Depends(get_current_user)):
    username = current_user_token.get("sub")
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "username": user.username,
        "role": user.role.value if hasattr(user.role, "value") else str(user.role),
        "district": user.district,
        "is_verified": bool(user.is_verified),
    }


@router.post("/auth/google/register", response_model=UserRegisterOut)
def register_with_google(
    credential: str = Form(...),
    district: Optional[str] = Form(None),
    proof: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Create/link a Google citizen account while preserving residency review."""
    google_sub, email = _verify_google_credential(credential)
    user = db.query(User).filter(User.google_sub == google_sub).first()
    if user:
        return {"user_id": user.id, "is_verified": user.is_verified}

    existing_email_user = db.query(User).filter(User.email == email).first()
    if existing_email_user:
        raise HTTPException(status_code=409, detail="This email is already linked to a different account.")

    upload_dir = os.path.join("uploads", "residency_proofs")
    os.makedirs(upload_dir, exist_ok=True)
    file_ext = os.path.splitext(proof.filename)[1]
    filename = f"google_{google_sub}_{int(datetime.utcnow().timestamp())}{file_ext}"
    file_path = os.path.join(upload_dir, filename)
    with open(file_path, "wb") as f:
        shutil.copyfileobj(proof.file, f)

    user = User(
        username=_google_username(email, db),
        hashed_password=hash_password(secrets.token_urlsafe(32)),
        district=district,
        proof_path=f"/uploads/residency_proofs/{filename}",
        role=UserRoleEnum.citizen,
        email=email,
        google_sub=google_sub,
        is_verified=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"user_id": user.id, "is_verified": user.is_verified}


@router.post("/auth/register", response_model=UserRegisterOut)
def register(
    username: str = Form(...),
    password: str = Form(...),
    district: Optional[str] = Form(None),
    proof: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    if db.query(User).filter(User.username == username).first():
        raise HTTPException(status_code=400, detail="Username already taken")
    
    upload_dir = os.path.join("uploads", "residency_proofs")
    os.makedirs(upload_dir, exist_ok=True)
    file_ext = os.path.splitext(proof.filename)[1]
    filename = f"{username}_{int(datetime.utcnow().timestamp())}{file_ext}"
    file_path = os.path.join(upload_dir, filename)
    with open(file_path, "wb") as f:
        shutil.copyfileobj(proof.file, f)
    
    web_proof_path = f"/uploads/residency_proofs/{filename}"

    hashed = hash_password(password)
    new_user = User(
        username=username,
        hashed_password=hashed,
        district=district,
        proof_path=web_proof_path,
        is_verified=False,
        role=UserRoleEnum.citizen,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"user_id": new_user.id, "is_verified": new_user.is_verified}


@router.get("/auth/pending-users")
def get_pending_users(db: Session = Depends(get_db)):
    users = db.query(User).filter(User.is_verified == False).all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "district": u.district,
            "proof_path": u.proof_path,
            "is_verified": u.is_verified,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        }
        for u in users
    ]


@router.post("/auth/verify-user/{user_id}")
def verify_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_verified = True
    db.commit()
    return {"status": "success", "message": f"User {user.username} verified successfully."}
