from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, timezone
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from app import models, schemas

def safe_round(val: Any, default: float) -> float:
    if val is None:
        return default
    try:
        return round(float(val), 2)
    except (TypeError, ValueError):
        return default

# --- Device CRUD (Instance-Aware with Disambiguation) ---
def get_devices(db: Session, skip: int = 0, limit: int = 100) -> List[models.Device]:
    return db.query(models.Device).offset(skip).limit(limit).all()

def resolve_device_or_error(
    db: Session,
    device_id: str,
    device_instance_id: Optional[str] = None
) -> models.Device:
    """
    Resolves device by identity:
    - If device_instance_id is provided, queries (device_id, device_instance_id).
    - If device_instance_id is omitted:
      - If exactly 1 instance exists, returns it.
      - If multiple instances exist (>1), raises HTTP 409 Conflict requesting instance_id.
      - If 0 instances exist, raises HTTP 404 Not Found.
    """
    if device_instance_id:
        dev = (
            db.query(models.Device)
            .filter(models.Device.device_id == device_id, models.Device.device_instance_id == device_instance_id)
            .first()
        )
        if not dev:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Device {device_id} with instance {device_instance_id} not found"
            )
        return dev

    # Device-only query
    matches = db.query(models.Device).filter(models.Device.device_id == device_id).all()
    if not matches:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device {device_id} not found"
        )
    if len(matches) > 1:
        instance_ids = [d.device_instance_id for d in matches]
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ambiguous device lookup: multiple instances exist for '{device_id}' ({', '.join(instance_ids)}). Please specify 'instance_id'."
        )
    return matches[0]

def get_device_by_id(db: Session, device_id: str) -> Optional[models.Device]:
    return db.query(models.Device).filter(models.Device.device_id == device_id).first()

# --- Sensor Reading CRUD ---
def get_readings_by_device(
    db: Session,
    device_id: str,
    device_instance_id: Optional[str] = None,
    limit: int = 100
) -> List[models.SensorReading]:
    query = db.query(models.SensorReading).filter(models.SensorReading.device_id == device_id)
    if device_instance_id:
        query = query.filter(models.SensorReading.device_instance_id == device_instance_id)
    return query.order_by(models.SensorReading.timestamp.desc()).limit(limit).all()

def get_latest_reading_by_device(
    db: Session,
    device_id: str,
    device_instance_id: Optional[str] = None
) -> Optional[models.SensorReading]:
    query = db.query(models.SensorReading).filter(models.SensorReading.device_id == device_id)
    if device_instance_id:
        query = query.filter(models.SensorReading.device_instance_id == device_instance_id)
    return query.order_by(models.SensorReading.timestamp.desc()).first()

# --- Alert CRUD ---
def get_alerts(db: Session, skip: int = 0, limit: int = 100) -> List[models.Alert]:
    return (
        db.query(models.Alert)
        .order_by(models.Alert.timestamp.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

def get_latest_alert_by_device(
    db: Session,
    device_id: str,
    device_instance_id: Optional[str] = None
) -> Optional[models.Alert]:
    query = db.query(models.Alert).filter(models.Alert.device_id == device_id)
    if device_instance_id:
        query = query.filter(models.Alert.device_instance_id == device_instance_id)
    return query.order_by(models.Alert.timestamp.desc()).first()

# --- Baseline CRUD ---
def get_baseline_by_device(
    db: Session,
    device_id: str,
    device_instance_id: Optional[str] = None
) -> Optional[models.Baseline]:
    query = db.query(models.Baseline).filter(models.Baseline.device_id == device_id)
    if device_instance_id:
        query = query.filter(models.Baseline.device_instance_id == device_instance_id)
    return query.first()

def save_or_update_baseline(
    db: Session,
    device_id: str,
    device_instance_id: str,
    baseline_dict: Dict[str, Any]
) -> models.Baseline:
    """Synchronizes learned HealthEngine baseline to database safely."""
    bl = (
        db.query(models.Baseline)
        .filter(models.Baseline.device_id == device_id, models.Baseline.device_instance_id == device_instance_id)
        .first()
    )
    t_dict = baseline_dict.get("temperature") if isinstance(baseline_dict.get("temperature"), dict) else {}
    v_dict = baseline_dict.get("vibration") if isinstance(baseline_dict.get("vibration"), dict) else {}
    c_dict = baseline_dict.get("current") if isinstance(baseline_dict.get("current"), dict) else {}
    r_dict = baseline_dict.get("rpm") if isinstance(baseline_dict.get("rpm"), dict) else {}

    t_m = safe_round(t_dict.get("mean"), 60.0)
    t_s = safe_round(t_dict.get("std_dev"), 1.0)
    v_m = safe_round(v_dict.get("mean"), 3.0)
    v_s = safe_round(v_dict.get("std_dev"), 0.5)
    c_m = safe_round(c_dict.get("mean"), 10.0)
    c_s = safe_round(c_dict.get("std_dev"), 0.5)
    r_m = safe_round(r_dict.get("mean"), 1500.0)
    r_s = safe_round(r_dict.get("std_dev"), 10.0)

    now = datetime.now(timezone.utc)
    if bl:
        bl.temperature_mean = t_m
        bl.temperature_std = t_s
        bl.vibration_mean = v_m
        bl.vibration_std = v_s
        bl.current_mean = c_m
        bl.current_std = c_s
        bl.rpm_mean = r_m
        bl.rpm_std = r_s
        bl.updated_at = now
    else:
        bl = models.Baseline(
            device_id=device_id,
            device_instance_id=device_instance_id,
            temperature_mean=t_m,
            temperature_std=t_s,
            vibration_mean=v_m,
            vibration_std=v_s,
            current_mean=c_m,
            current_std=c_s,
            rpm_mean=r_m,
            rpm_std=r_s,
            updated_at=now
        )
        db.add(bl)
    return bl

# --- Dynamic Summaries ---
def get_fleet_summary(db: Session) -> Dict[str, int]:
    total_devices = db.query(func.count(models.Device.id)).scalar() or 0
    healthy = db.query(func.count(models.Device.id)).filter(models.Device.status.in_(["HEALTHY", "healthy"])).scalar() or 0
    warning = db.query(func.count(models.Device.id)).filter(models.Device.status.in_(["WARNING", "warning"])).scalar() or 0
    critical = db.query(func.count(models.Device.id)).filter(models.Device.status.in_(["CRITICAL", "critical"])).scalar() or 0
    active_alerts = db.query(func.count(models.Alert.id)).scalar() or 0

    return {
        "total_devices": total_devices,
        "healthy": healthy,
        "warning": warning,
        "critical": critical,
        "active_alerts": active_alerts
    }

def get_regions_summary(db: Session) -> Dict[str, Dict[str, int]]:
    devices = db.query(models.Device).all()
    summary: Dict[str, Dict[str, int]] = {}
    for d in devices:
        if d.region not in summary:
            summary[d.region] = {"total_devices": 0, "healthy": 0, "warning": 0, "critical": 0}
        summary[d.region]["total_devices"] += 1
        st = d.status.lower()
        if st in summary[d.region]:
            summary[d.region][st] += 1
    return summary

def get_device_by_id(db: Session, device_id: str) -> Optional[models.Device]:
    return db.query(models.Device).filter(models.Device.device_id == device_id).first()

def update_device_status(db: Session, device_id: str, status: str) -> models.Device:
    dev = db.query(models.Device).filter(models.Device.device_id == device_id).first()
    if not dev:
        dev = models.Device(
            device_id=device_id,
            device_instance_id=f"INST-{device_id.replace('DEV-', '')}",
            region="North",
            status=status
        )
        db.add(dev)
    else:
        dev.status = status
    db.commit()
    db.refresh(dev)
    return dev

def create_alert(db: Session, alert: schemas.DetectionInput) -> models.Alert:
    db_alert = models.Alert(
        device_id=alert.device_id,
        device_instance_id=f"INST-{alert.device_id.replace('DEV-', '')}",
        failure_type=alert.failure_type,
        severity=alert.status,
        confidence=alert.confidence,
        timestamp=datetime.now(timezone.utc)
    )
    db.add(db_alert)
    db.commit()
    db.refresh(db_alert)
    return db_alert
