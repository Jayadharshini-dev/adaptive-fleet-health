import logging
import threading
from datetime import datetime, timezone
from typing import Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session
from app import models

logger = logging.getLogger("adaptive_fleet.incidents")

_incident_lock = threading.Lock()

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
    Authoritative Incident Lifecycle Management:
    - First anomaly on device instance -> Creates single ACTIVE incident
    - Subsequent anomalies -> Updates same ACTIVE incident (increments count, peak severity/confidence)
    - Returning to HEALTHY -> Resolves active incident (sets status=RESOLVED, resolved_at)
    - New anomaly after resolution -> Creates brand-new incident with new ID
    """
    status = str(health_result.get("status", "healthy")).lower()
    anomaly_type = str(health_result.get("anomaly_type", "none")).lower()
    severity = float(health_result.get("severity", 0.0))
    confidence = float(health_result.get("confidence", 0.0))
    explanation = health_result.get("explanation", "")
    ts_aware = ensure_tz_aware(reading_timestamp)

    is_anomalous = (status in ["warning", "critical"] and anomaly_type != "none")

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
                    event_type="INCIDENT_DETECTED",
                    operator_name="System",
                    details={"anomaly_type": anomaly_type, "severity": severity, "confidence": confidence, "explanation": explanation},
                    timestamp=ts_aware
                )
                db.add(audit_event)
                db.flush()

                logger.info(f"Created incident {incident_id} for {device_id}/{device_instance_id} ({anomaly_type})")
                return new_incident, "incident_created"

            else:
                active_incident.occurrence_count += 1
                active_incident.last_detected_at = max(ensure_tz_aware(active_incident.last_detected_at), ts_aware)
                active_incident.region = region
                active_incident.anomaly_type = anomaly_type
                active_incident.severity = severity
                active_incident.confidence = confidence
                active_incident.peak_severity = max(active_incident.peak_severity, severity)
                active_incident.peak_confidence = max(active_incident.peak_confidence, confidence)
                if explanation:
                    active_incident.latest_explanation = explanation

                db.flush()
                logger.info(f"Updated incident {active_incident.incident_id} for {device_id}/{device_instance_id} (count={active_incident.occurrence_count})")
                return active_incident, "incident_updated"

        else:
            # Telemetry is healthy -> resolve active incident
            if active_incident is not None:
                active_incident.status = "RESOLVED"
                active_incident.resolved_at = ts_aware
                active_incident.resolved_by = "System Auto-Resolution"
                active_incident.resolution_reason = "Device telemetry returned to healthy operating baseline"
                active_incident.updated_at = ts_aware

                audit_event = models.IncidentEvent(
                    incident_id=active_incident.incident_id,
                    event_type="INCIDENT_RESOLVED",
                    operator_name="System Auto-Resolution",
                    details={"device_id": device_id, "instance_id": device_instance_id, "reason": "Telemetry returned to normal"},
                    timestamp=ts_aware
                )
                db.add(audit_event)
                db.flush()
                logger.info(f"Active incident {active_incident.incident_id} resolved automatically on healthy telemetry.")
                return active_incident, "incident_resolved"

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
            details={"action": "acknowledged"},
            timestamp=now
        )
        db.add(audit)
        db.commit()
        db.refresh(incident)
        return incident


def resolve_incident(
    db: Session,
    incident_id: str,
    operator_name: str = "Operator 01",
    reason: str = "Operator inspection completed"
) -> Optional[models.Incident]:
    """Resolve active incident by operator."""
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
        incident.resolution_reason = reason
        incident.updated_at = now

        audit = models.IncidentEvent(
            incident_id=incident.incident_id,
            event_type="INCIDENT_RESOLVED",
            operator_name=operator_name,
            details={"action": "resolved", "reason": reason},
            timestamp=now
        )
        db.add(audit)
        db.commit()
        db.refresh(incident)
        return incident
