import logging
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app import crud, models, schemas

logger = logging.getLogger("adaptive_fleet.devices")
router = APIRouter(tags=["Devices & Fleet Overview"])

class DuplicateResolveRequest(BaseModel):
    action: str = "keep_both"

def compute_telemetry_freshness(latest_reading: Optional[models.SensorReading]) -> Tuple[str, Optional[int]]:
    if not latest_reading or not latest_reading.timestamp:
        return "OFFLINE", None
    now = datetime.now(timezone.utc)
    ts = latest_reading.timestamp
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    diff = (now - ts).total_seconds()
    if diff < 0:
        return "ACTIVE", 0
    diff_int = int(diff)
    if diff_int <= 60:
        return "ACTIVE", diff_int
    elif diff_int <= 300:
        return "STALE", diff_int
    else:
        return "OFFLINE", diff_int

@router.get(
    "/devices",
    response_model=List[schemas.DeviceResponse],
    summary="Get all fleet devices",
    description="Retrieve the complete list of all registered fleet devices with their region and status."
)
def get_all_devices(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of records to return"),
    db: Session = Depends(get_db)
):
    return crud.get_devices(db=db, skip=skip, limit=limit)

@router.get(
    "/fleet/summary",
    response_model=schemas.FleetSummaryResponse,
    summary="Get fleet health summary",
    description="Dynamically calculated counts of total devices, health statuses, and active alerts."
)
def get_fleet_summary(db: Session = Depends(get_db)):
    return crud.get_fleet_summary(db=db)

@router.get(
    "/regions/summary",
    response_model=Dict[str, schemas.RegionSummaryItem],
    summary="Get regional fleet breakdown",
    description="Dynamically aggregated fleet health status grouped by geographic region."
)
def get_regions_summary(db: Session = Depends(get_db)):
    return crud.get_regions_summary(db=db)

@router.get(
    "/regions",
    response_model=List[schemas.RegionSummaryItem],
    summary="Get all regions overview",
    description="Returns regional health breakdown as a list with active conflict counts."
)
def get_regions_list(db: Session = Depends(get_db)):
    all_regions = [r[0] for r in db.query(models.Device.region).distinct().all() if r[0]]
    res = []
    for reg_name in all_regions:
        devs = db.query(models.Device).filter(models.Device.region == reg_name).all()
        healthy = sum(1 for d in devs if d.status.upper() == "HEALTHY")
        warning = sum(1 for d in devs if d.status.upper() == "WARNING")
        critical = sum(1 for d in devs if d.status.upper() == "CRITICAL")
        conf_count = db.query(models.RegionalConflict).filter(
            models.RegionalConflict.region == reg_name,
            models.RegionalConflict.status == "ACTIVE"
        ).count()
        alerts_count = db.query(models.Incident).filter(
            models.Incident.region == reg_name,
            models.Incident.status == "ACTIVE"
        ).count()
        res.append(schemas.RegionSummaryItem(
            region=reg_name,
            total_devices=len(devs),
            healthy=healthy,
            warning=warning,
            critical=critical,
            active_alerts=alerts_count,
            active_conflicts=conf_count
        ))
    return res

@router.get(
    "/regions/{region}",
    response_model=schemas.RegionalDetailResponse,
    summary="Get single region detail",
    description="Returns detailed device health and active conflict objects for a specific region."
)
def get_region_detail(region: str, db: Session = Depends(get_db)):
    devices = db.query(models.Device).filter(models.Device.region == region).all()
    if not devices:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Region '{region}' not found or has no devices"
        )
    healthy = sum(1 for d in devices if d.status.upper() == "HEALTHY")
    warning = sum(1 for d in devices if d.status.upper() == "WARNING")
    critical = sum(1 for d in devices if d.status.upper() == "CRITICAL")
    conflicts = db.query(models.RegionalConflict).filter(
        models.RegionalConflict.region == region,
        models.RegionalConflict.status == "ACTIVE"
    ).all()
    return schemas.RegionalDetailResponse(
        region=region,
        total_devices=len(devices),
        healthy=healthy,
        warning=warning,
        critical=critical,
        active_conflicts=conflicts
    )

@router.get(
    "/devices/{device_id}/state",
    response_model=schemas.DeviceStateResponse,
    summary="Get authoritative device state, telemetry freshness & alerts",
    description="""
    Retrieve current device status, dynamic telemetry connectivity status (ACTIVE/STALE/OFFLINE),
    seconds since last reading, full latest sensor reading, and latest alert.
    """
)
def get_device_state(
    device_id: str,
    instance_id: Optional[str] = Query(None, description="Optional physical instance ID filter"),
    db: Session = Depends(get_db)
):
    device = crud.resolve_device_or_error(db=db, device_id=device_id, device_instance_id=instance_id)
    latest_reading = crud.get_latest_reading_by_device(db=db, device_id=device.device_id, device_instance_id=device.device_instance_id)
    latest_alert = crud.get_latest_alert_by_device(db=db, device_id=device.device_id, device_instance_id=device.device_instance_id)
    telemetry_status, seconds_since = compute_telemetry_freshness(latest_reading)

    return schemas.DeviceStateResponse(
        device_id=device.device_id,
        device_instance_id=device.device_instance_id,
        region=device.region,
        status=device.status,
        telemetry_status=telemetry_status,
        seconds_since_last_reading=seconds_since,
        latest_reading=latest_reading,
        latest_alert=latest_alert
    )

@router.get(
    "/health/{device_id}",
    response_model=schemas.DeviceStateResponse,
    summary="Get device health state (Alias)",
    description="Alias for /devices/{device_id}/state."
)
def get_device_health_alias(
    device_id: str,
    instance_id: Optional[str] = Query(None, description="Optional physical instance ID filter"),
    db: Session = Depends(get_db)
):
    return get_device_state(device_id=device_id, instance_id=instance_id, db=db)

@router.get(
    "/devices/{device_id}",
    response_model=schemas.DeviceDetailResponse,
    summary="Get device details by ID",
    description="Retrieve details for a specific device. Disambiguates with instance_id if multiple exist."
)
def get_device_by_id(
    device_id: str,
    instance_id: Optional[str] = Query(None, description="Optional physical instance ID filter"),
    db: Session = Depends(get_db)
):
    return crud.resolve_device_or_error(db=db, device_id=device_id, device_instance_id=instance_id)

@router.get(
    "/devices/{device_id}/baseline",
    response_model=schemas.BaselineResponse,
    summary="Get baseline statistics for a device",
    description="Retrieve baseline operating metrics (means and standard deviations) for temperature, vibration, current, and rpm."
)
def get_device_baseline(
    device_id: str,
    instance_id: Optional[str] = Query(None, description="Optional physical instance ID filter"),
    db: Session = Depends(get_db)
):
    device = crud.resolve_device_or_error(db=db, device_id=device_id, device_instance_id=instance_id)
    baseline = crud.get_baseline_by_device(db=db, device_id=device.device_id, device_instance_id=device.device_instance_id)
    if not baseline:
        logger.warning(f"Baseline not found for device: {device_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Baseline not found for device {device_id}"
        )
    return baseline

@router.get("/duplicates", summary="Get Duplicate Device Assets")
def get_duplicate_devices(db: Session = Depends(get_db)):
    all_devs = db.query(models.Device).all()
    grouped = {}
    for d in all_devs:
        grouped.setdefault(d.device_id, []).append(d)
    
    dupes = []
    for dev_id, instances in grouped.items():
        if len(instances) > 1:
            dupes.append({
                "id": f"dup_{dev_id}",
                "device_id": dev_id,
                "instances": [
                    {
                        "device_instance_id": inst.device_instance_id,
                        "region": inst.region,
                        "status": inst.status,
                        "created_at": inst.created_at.isoformat() if inst.created_at else None
                    }
                    for inst in instances
                ]
            })
    return dupes

@router.post("/duplicates/{duplicate_id}/resolve", summary="Resolve Duplicate Device Merge Strategy")
def resolve_duplicate(duplicate_id: str, payload: DuplicateResolveRequest, db: Session = Depends(get_db)):
    return {"status": "success", "duplicate_id": duplicate_id, "action": payload.action}
