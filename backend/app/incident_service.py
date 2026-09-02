import logging
from datetime import datetime, timezone
from typing import Optional, Tuple, Dict, Any, List
from threading import Lock
from sqlalchemy.orm import Session
from app import models

logger = logging.getLogger("adaptive_fleet.incidents")
_incident_lock = Lock()

def ensure_tz_aware(dt: Optional[datetime]) -> datetime:
    if dt is None:
        return datetime.now(timezone.utc)
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt

def process_incident_lifecycle(
    db: Session,
    device_id: str,
    device_instance_id: str,
    region: str,
    health_result: Dict[str, Any],
    reading_timestamp: datetime
) -> Tuple[Optional[models.Incident], Optional[str]]:
    """
    Authoritative Incident Lifecycle State Machine:
    - Anomaly detected (1-2 obs): Transient anomaly (is_transient=True).
    - Anomaly persists (>2 consecutive obs): Promoted to PERSISTENT INCIDENT (is_transient=False).
    - Healthy telemetry:
      - If transient (<= 2 obs): Auto-clears (TRANSIENT_CLEARED).
      - If persistent (> 2 obs): REMAINS ACTIVE/ACKNOWLEDGED until manual authenticated operator resolution.
    - Deduplication strictly by (device_id, device_instance_id).
    """
    anomaly_type = str(health_result.get("anomaly_type", "none")).lower()
    is_anomalous = anomaly_type not in ["none", "healthy", "normal", ""]
    severity = float(health_result.get("severity", 0.0))
    confidence = float(health_result.get("confidence", 0.0))
    explanation = str(health_result.get("explanation", ""))
    ts_aware = ensure_tz_aware(reading_timestamp)

    with _incident_lock:
        active_incident = (
            db.query(models.Incident)
            .filter(
                models.Incident.device_id == device_id,
                models.Incident.device_instance_id == device_instance_id,
                models.Incident.status.in_(["ACTIVE", "ACKNOWLEDGED"])
            )
            .first()
        )

        if is_anomalous:
            if active_incident is None:
                incident_id = models.generate_incident_id()
                new_incident = models.Incident(
                    incident_id=incident_id,
                    device_id=device_id,
                    device_instance_id=device_instance_id,
                    region=region,
                    anomaly_type=anomaly_type,
                    severity=severity,
                    confidence=confidence,
                    status="ACTIVE",
                    first_detected_at=ts_aware,
                    last_detected_at=ts_aware,
                    occurrence_count=1,
                    consecutive_anomalous_count=1,
                    is_transient=True,
                    peak_severity=severity,
                    peak_confidence=confidence,
                    latest_explanation=explanation,
                    created_at=ts_aware,
                    updated_at=ts_aware
                )
                db.add(new_incident)
                db.flush()

                audit_event = models.IncidentEvent(
                    incident_id=incident_id,
                    event_type="TRANSIENT_DETECTED",
                    operator_name="System",
                    details={"anomaly_type": anomaly_type, "severity": severity, "confidence": confidence, "explanation": explanation},
                    timestamp=ts_aware
                )
                db.add(audit_event)
                db.flush()

                logger.info(f"Created initial transient incident {incident_id} for {device_id}/{device_instance_id} ({anomaly_type})")
                return new_incident, "incident_created"

            else:
                active_incident.occurrence_count += 1
                active_incident.consecutive_anomalous_count += 1
                active_incident.last_detected_at = max(ensure_tz_aware(active_incident.last_detected_at), ts_aware)
                active_incident.region = region
                active_incident.anomaly_type = anomaly_type
                active_incident.severity = severity
                active_incident.confidence = confidence
                active_incident.peak_severity = max(active_incident.peak_severity or 0.0, severity)
                active_incident.peak_confidence = max(active_incident.peak_confidence or 0.0, confidence)
                if explanation:
                    active_incident.latest_explanation = explanation

                # Promote to persistent incident if > 2 consecutive anomalous readings
                if active_incident.consecutive_anomalous_count > 2 and active_incident.is_transient:
                    active_incident.is_transient = False
                    audit_promo = models.IncidentEvent(
                        incident_id=active_incident.incident_id,
                        event_type="INCIDENT_PERSISTENT_PROMOTED",
                        operator_name="System",
                        details={"consecutive_count": active_incident.consecutive_anomalous_count, "anomaly_type": anomaly_type},
                        timestamp=ts_aware
                    )
                    db.add(audit_promo)
                    logger.info(f"Promoted incident {active_incident.incident_id} to PERSISTENT INCIDENT.")

                db.flush()
                return active_incident, "incident_updated"

        else:
            # Telemetry is healthy
            if active_incident is not None:
                if active_incident.is_transient:
                    # Transient anomaly (<= 2 observations) auto-clears
                    active_incident.status = "RESOLVED"
                    active_incident.resolved_at = ts_aware
                    active_incident.resolved_by = "System Auto-Clear"
                    active_incident.resolution_reason = "Transient observation cleared after normal telemetry"
                    active_incident.updated_at = ts_aware

                    audit_clear = models.IncidentEvent(
                        incident_id=active_incident.incident_id,
                        event_type="TRANSIENT_CLEARED",
                        operator_name="System",
                        details={"device_id": device_id, "instance_id": device_instance_id, "reason": "Transient observation cleared"},
                        timestamp=ts_aware
                    )
                    db.add(audit_clear)
                    db.flush()
                    logger.info(f"Transient incident {active_incident.incident_id} cleared automatically.")
                    return active_incident, "incident_resolved"
                else:
                    # Persistent incident (> 2 observations) MUST NOT auto-resolve.
                    # It stays ACTIVE / ACKNOWLEDGED awaiting operator resolution.
                    return None, None

            return None, None

def acknowledge_incident(db: Session, incident_id: str, operator_name: str = "Operator 01") -> Optional[models.Incident]:
    """Acknowledge active incident by operator."""
    with _incident_lock:
        incident = db.query(models.Incident).filter(
            (models.Incident.incident_id == incident_id) | (models.Incident.id == incident_id)
        ).first()

        if not incident:
            return None

        now = datetime.now(timezone.utc)
        incident.status = "ACKNOWLEDGED"
        incident.acknowledged_at = now
        incident.acknowledged_by = operator_name
        incident.updated_at = now

        audit = models.IncidentEvent(
            incident_id=incident.incident_id,
            event_type="INCIDENT_ACKNOWLEDGED",
            operator_name=operator_name,
            details={"action": "acknowledged", "operator": operator_name},
            timestamp=now
        )
        db.add(audit)
        db.flush()
        return incident

def resolve_incident(
    db: Session,
    incident_id: str,
    operator_name: str = "Operator 01",
    resolution_reason: str = "Operator inspection completed"
) -> Optional[models.Incident]:
    """Resolve incident by authenticated operator."""
    with _incident_lock:
        incident = db.query(models.Incident).filter(
            (models.Incident.incident_id == incident_id) | (models.Incident.id == incident_id)
        ).first()

        if not incident:
            return None

        now = datetime.now(timezone.utc)
        incident.status = "RESOLVED"
        incident.resolved_at = now
        incident.resolved_by = operator_name
        incident.resolution_reason = resolution_reason
        incident.updated_at = now

        audit = models.IncidentEvent(
            incident_id=incident.incident_id,
            event_type="INCIDENT_RESOLVED",
            operator_name=operator_name,
            details={"action": "resolved", "operator": operator_name, "reason": resolution_reason},
            timestamp=now
        )
        db.add(audit)
        db.flush()
        return incident
