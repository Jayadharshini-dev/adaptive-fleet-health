import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas, crud

logger = logging.getLogger("adaptive_fleet.baselines")
router = APIRouter(prefix="", tags=["Baselines"])

@router.get("/baselines/{device_id}", response_model=schemas.BaselineResponse)
def get_baseline(
    device_id: str,
    instance_id: Optional[str] = Query(None, description="Optional physical instance ID"),
    db: Session = Depends(get_db)
):
    baseline = crud.get_baseline_by_device(db, device_id, instance_id)
    if not baseline:
        raise HTTPException(status_code=404, detail=f"Baseline for device {device_id} not found")
    return baseline
