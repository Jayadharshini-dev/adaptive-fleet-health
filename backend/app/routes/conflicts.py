import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from starlette import status as http_status
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas, conflict_service

logger = logging.getLogger("adaptive_fleet.conflicts")
router = APIRouter(prefix="", tags=["Regional Conflicts"])

@router.get("/conflicts", response_model=List[schemas.RegionalConflictResponse])
def get_conflicts(
    status: Optional[str] = Query(None, description="Filter by status: ACTIVE or RESOLVED"),
    region: Optional[str] = Query(None, description="Filter by geographic region"),
    skip: int = Query(0, ge=0, description="Offset for pagination"),
    limit: int = Query(100, ge=1, le=1000, description="Limit for pagination"),
    db: Session = Depends(get_db)
):
    """
    Retrieves filtered list of authoritative regional conflicts ordered newest first.
    """
    if status is not None:
        if status.upper() not in schemas.VALID_INCIDENT_STATUSES:
            raise HTTPException(
                status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid status filter '{status}'. Must be one of: {', '.join(sorted(schemas.VALID_INCIDENT_STATUSES))}"
            )
        status = status.upper()

    return conflict_service.get_conflicts(
        db=db,
        status=status,
        region=region,
        skip=skip,
        limit=limit
    )

@router.get("/conflicts/{conflict_id}", response_model=schemas.RegionalConflictResponse)
def get_conflict_by_id(
    conflict_id: str,
    db: Session = Depends(get_db)
):
    """
    Fetches full authoritative regional conflict record by public conflict ID.
    """
    conflict = conflict_service.get_conflict_by_id(db, conflict_id)
    if not conflict:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=f"Regional conflict '{conflict_id}' not found"
        )
    return conflict
