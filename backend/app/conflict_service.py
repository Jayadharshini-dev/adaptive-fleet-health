import os
import logging
import threading
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Tuple, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app import models

logger = logging.getLogger("adaptive_fleet.conflicts")

REGIONAL_CONFLICT_WINDOW_SECONDS = int(os.getenv("REGIONAL_CONFLICT_WINDOW_SECONDS", "60"))
REGIONAL_CONFLICT_MIN_DEVICES = int(os.getenv("REGIONAL_CONFLICT_MIN_DEVICES", "2"))

# Process-local lock ensuring serialized active-conflict lookup, decision, and commit per process.
_conflict_lock = threading.Lock()

def ensure_tz_aware(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt

def get_conflicts(
    db: Session,
    status: Optional[str] = None,
    region: Optional[str] = None,
    skip: int = 0,
    limit: int = 100
) -> List[models.RegionalConflict]:
    """Queries filtered list of regional conflicts ordered newest first."""
    query = db.query(models.RegionalConflict)
    if status:
        query = query.filter(models.RegionalConflict.status == status.upper())
    if region:
        query = query.filter(models.RegionalConflict.region == region)
    return query.order_by(desc(models.RegionalConflict.detected_at)).offset(skip).limit(limit).all()

def get_conflict_by_id(db: Session, conflict_id: str) -> Optional[models.RegionalConflict]:
    """Fetches single regional conflict by public conflict_id."""
    conf = db.query(models.RegionalConflict).filter(models.RegionalConflict.conflict_id == conflict_id).first()
    if conf:
        return conf
    if conflict_id.isdigit():
        return db.query(models.RegionalConflict).filter(models.RegionalConflict.id == int(conflict_id)).first()
    return None

def evaluate_and_persist_regional_conflicts(
    db: Session,
    region: str,
    timestamp: datetime
) -> List[Tuple[Dict[str, Any], str]]:
    """
    Evaluates cross-device anomalies in the given region using committed DB state.
    Executes under _conflict_lock and commits the regional conflict changes to `db`.
    Returns serializable dictionary representations of conflicts and actions for WebSocket emission.
    """
    if not region:
        return []

    now_utc = datetime.now(timezone.utc)
    ts_aware = ensure_tz_aware(timestamp)

    results: List[Tuple[Dict[str, Any], str]] = []

    with _conflict_lock:
        try:
            # 1. Fetch all currently ACTIVE incidents in this region
            all_active_incidents = (
                db.query(models.Incident)
                .filter(
                    models.Incident.region == region,
                    models.Incident.status == "ACTIVE"
                )
                .all()
            )

            # 2. Determine sliding time window based on current reference time
            # For each anomaly type group, calculate if incidents fall within the window
            grouped_by_anomaly: Dict[str, Dict[Tuple[str, str], models.Incident]] = {}
            for inc in all_active_incidents:
                inc_time = ensure_tz_aware(inc.last_detected_at) or ts_aware
                # Group active incidents by anomaly_type
                atype = inc.anomaly_type
                if atype not in grouped_by_anomaly:
                    grouped_by_anomaly[atype] = {}
                instance_key = (inc.device_id, inc.device_instance_id)
                grouped_by_anomaly[atype][instance_key] = inc

            # 3. Query existing ACTIVE conflicts in this region
            active_conflicts = (
                db.query(models.RegionalConflict)
                .filter(
                    models.RegionalConflict.region == region,
                    models.RegionalConflict.status == "ACTIVE"
                )
                .all()
            )
            active_conflicts_by_type: Dict[str, models.RegionalConflict] = {}
            for c in active_conflicts:
                types = c.anomaly_types or []
                if types and isinstance(types, list):
                    active_conflicts_by_type[types[0]] = c

            # 4. Evaluate each anomaly group
            evaluated_types = set()
            for atype, instance_map in grouped_by_anomaly.items():
                evaluated_types.add(atype)
                
                # Filter instance_map to only those within REGIONAL_CONFLICT_WINDOW_SECONDS of the latest active incident
                timestamps = [ensure_tz_aware(inc.last_detected_at) for inc in instance_map.values() if inc.last_detected_at]
                if not timestamps:
                    continue
                latest_group_time = max(timestamps)
                window_start = latest_group_time - timedelta(seconds=REGIONAL_CONFLICT_WINDOW_SECONDS)

                valid_instances = {
                    k: inc for k, inc in instance_map.items()
                    if (ensure_tz_aware(inc.last_detected_at) or ts_aware) >= window_start
                }
                distinct_count = len(valid_instances)

                if distinct_count >= REGIONAL_CONFLICT_MIN_DEVICES:
                    affected_list = []
                    severities = []
                    confidences = []
                    detected_timestamps = []

                    for (dev_id, inst_id), inc in sorted(valid_instances.items()):
                        inc_ts = ensure_tz_aware(inc.first_detected_at) or ts_aware
                        affected_list.append({
                            "device_id": dev_id,
                            "device_instance_id": inst_id,
                            "anomaly_type": inc.anomaly_type,
                            "severity": inc.severity,
                            "confidence": inc.confidence,
                            "detected_at": inc_ts.isoformat()
                        })
                        severities.append(inc.severity)
                        confidences.append(inc.confidence)
                        detected_timestamps.append(inc_ts)

                    peak_sev = round(max(severities), 2)
                    peak_conf = round(max(confidences), 2)

                    if detected_timestamps:
                        time_delta = max(1, int(round((max(detected_timestamps) - min(detected_timestamps)).total_seconds())))
                    else:
                        time_delta = 10

                    instance_names = ", ".join([f"{k[0]}/{k[1]}" for k in sorted(valid_instances.keys())])
                    explanation = (
                        f"Regional conflict detected in {region}: {distinct_count} physical device instances "
                        f"({instance_names}) reported {atype} anomalies within {time_delta} seconds."
                    )

                    existing_conflict = active_conflicts_by_type.get(atype)
                    if existing_conflict:
                        # UPDATE existing conflict (protect monotonic timestamp)
                        existing_conflict.affected_devices = affected_list
                        existing_conflict.severity = peak_sev
                        existing_conflict.confidence = peak_conf
                        existing_conflict.explanation = explanation
                        existing_conflict_last = ensure_tz_aware(existing_conflict.last_updated_at) or ts_aware
                        existing_conflict.last_updated_at = max(existing_conflict_last, ts_aware)
                        existing_conflict.updated_at = now_utc
                        db.flush()
                        results.append((serialize_conflict(existing_conflict), "UPDATE"))
                    else:
                        # CREATE new conflict
                        new_conf = models.RegionalConflict(
                            conflict_id=models.generate_conflict_id(),
                            region=region,
                            status="ACTIVE",
                            anomaly_types=[atype],
                            affected_devices=affected_list,
                            severity=peak_sev,
                            confidence=peak_conf,
                            explanation=explanation,
                            detected_at=ts_aware,
                            last_updated_at=ts_aware,
                            created_at=now_utc,
                            updated_at=now_utc
                        )
                        db.add(new_conf)
                        db.flush()
                        results.append((serialize_conflict(new_conf), "CREATE"))
                        active_conflicts_by_type[atype] = new_conf

            # 5. Check if any previously ACTIVE conflict should now be RESOLVED
            for c in active_conflicts:
                types = c.anomaly_types or []
                primary_type = types[0] if types else "unknown"
                group_map = grouped_by_anomaly.get(primary_type, {})
                if primary_type not in evaluated_types or len(group_map) < REGIONAL_CONFLICT_MIN_DEVICES:
                    c.status = "RESOLVED"
                    c.resolved_at = ts_aware
                    c.updated_at = now_utc
                    db.flush()
                    results.append((serialize_conflict(c), "RESOLVE"))

            db.commit()
            return results

        except Exception as e:
            db.rollback()
            logger.error(f"Error during regional conflict evaluation in {region}: {e}")
            raise e

def serialize_conflict(conf: models.RegionalConflict) -> Dict[str, Any]:
    return {
        "id": conf.id,
        "conflict_id": conf.conflict_id,
        "region": conf.region,
        "anomaly_types": conf.anomaly_types,
        "affected_devices": conf.affected_devices,
        "severity": conf.severity,
        "confidence": conf.confidence,
        "status": conf.status,
        "explanation": conf.explanation,
        "detected_at": conf.detected_at.isoformat() if conf.detected_at else None,
        "last_updated_at": conf.last_updated_at.isoformat() if conf.last_updated_at else None,
        "resolved_at": conf.resolved_at.isoformat() if conf.resolved_at else None
    }
