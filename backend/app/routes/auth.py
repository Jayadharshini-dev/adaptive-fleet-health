import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app import models

router = APIRouter(prefix="/auth", tags=["Authentication"])

DEMO_OPERATORS = {
    "operator1": {
        "password": "demo123",
        "username": "operator1",
        "full_name": "Operator 01",
        "role": "Control Room A"
    },
    "operator2": {
        "password": "demo123",
        "username": "operator2",
        "full_name": "Operator 02",
        "role": "Control Room B"
    }
}

class LoginRequest(BaseModel):
    username: str
    password: str
    selected_operator: Optional[str] = None

class UserInfo(BaseModel):
    username: str
    full_name: str
    role: str

class LoginResponse(BaseModel):
    user: UserInfo
    token: str
    login_timestamp: str

@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticates operator console credentials.
    Returns operator metadata and authoritative server-generated login_timestamp (ISO-8601 UTC).
    """
    uname = payload.username.strip().lower()
    passw = payload.password.strip()

    op_info = DEMO_OPERATORS.get(uname)
    if not op_info or op_info["password"] != passw:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid operator credentials. Use operator1/demo123 or operator2/demo123."
        )

    # Server-generated authoritative login timestamp
    now = datetime.now(timezone.utc)
    login_ts_iso = now.isoformat()
    session_id = f"sess_{uuid.uuid4().hex[:16]}"
    token = f"bearer-{uname}-{session_id[:8]}"

    # Record session event in DB
    try:
        session_rec = models.SessionEvent(
            username=op_info["username"],
            session_id=session_id,
            login_timestamp=now,
            created_at=now
        )
        db.add(session_rec)
        db.commit()
    except Exception as e:
        db.rollback()

    return {
        "user": {
            "username": op_info["username"],
            "full_name": op_info["full_name"],
            "role": op_info["role"]
        },
        "token": token,
        "login_timestamp": login_ts_iso
    }
