from datetime import datetime, timezone
import uuid
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Index, JSON, Boolean
from sqlalchemy.orm import relationship
from app.database import Base

def utc_now():
    return datetime.now(timezone.utc)

def generate_incident_id(prefix="INC"):
    return f"{prefix}-{uuid.uuid4().hex[:8].upper()}"

def generate_conflict_id(prefix="RC"):
    return f"{prefix}-{uuid.uuid4().hex[:8].upper()}"

class Device(Base):
    """Represents a logical edge device asset with physical instance tracking."""
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    device_id = Column(String(50), index=True, nullable=False)
    device_instance_id = Column(String(100), index=True, nullable=False)
    region = Column(String(50), nullable=False)
    status = Column(String(20), default="HEALTHY", nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    __table_args__ = (
        Index("idx_devices_id_instance", "device_id", "device_instance_id"),
    )


class SensorReading(Base):
    """Represents a canonical time-series telemetry reading (temperature, vibration, current, rpm)."""
    __tablename__ = "sensor_readings"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    device_id = Column(String(50), nullable=False, index=True)
    device_instance_id = Column(String(100), nullable=False, index=True)
    region = Column(String(50), nullable=True)
    timestamp = Column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)
    temperature = Column(Float, nullable=False)
    vibration = Column(Float, nullable=False)
    current = Column(Float, nullable=False)
    rpm = Column(Float, nullable=False)
    received_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    __table_args__ = (
        Index("idx_sensor_readings_id_instance", "device_id", "device_instance_id"),
        Index("idx_sensor_readings_device_timestamp", "device_id", "device_instance_id", "timestamp"),
    )


class HealthResultRecord(Base):
    """Stores rich HealthResult evaluations produced by Member 1 HealthEngine."""
    __tablename__ = "health_results"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    device_id = Column(String(50), nullable=False, index=True)
    device_instance_id = Column(String(100), nullable=False, index=True)
    region = Column(String(50), nullable=True)
    status = Column(String(20), nullable=False)  # healthy, warning, critical
    anomaly_type = Column(String(50), nullable=False)  # none, drift, spike, flatline, oscillation, sensor_swap
    severity = Column(Float, nullable=False)
    confidence = Column(Float, nullable=False)
    current_metrics = Column(JSON, nullable=False)
    baseline_metrics = Column(JSON, nullable=False)
    detectors = Column(JSON, nullable=False)
    explanation = Column(String(1000), nullable=True)
    is_mature = Column(Boolean, default=True, nullable=False)
    timestamp = Column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    __table_args__ = (
        Index("idx_health_results_id_instance", "device_id", "device_instance_id"),
        Index("idx_health_results_device_timestamp", "device_id", "device_instance_id", "timestamp"),
    )


class Incident(Base):
    """Represents an authoritative incident lifecycle for a physical device instance."""
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    incident_id = Column(String(64), unique=True, index=True, default=generate_incident_id, nullable=False)
    device_id = Column(String(50), nullable=False, index=True)
    device_instance_id = Column(String(100), nullable=False, index=True)
    region = Column(String(50), nullable=False, index=True)
    anomaly_type = Column(String(50), nullable=False, index=True)
    severity = Column(Float, nullable=False)
    confidence = Column(Float, nullable=False)
    status = Column(String(20), default="ACTIVE", nullable=False, index=True)  # ACTIVE, RESOLVED
    first_detected_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    last_detected_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    acknowledged_by = Column(String(100), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolved_by = Column(String(100), nullable=True)
    resolution_reason = Column(String(500), nullable=True)
    is_transient = Column(Boolean, default=False, nullable=False)
    consecutive_anomalous_count = Column(Integer, default=1, nullable=False)
    occurrence_count = Column(Integer, default=1, nullable=False)
    peak_severity = Column(Float, nullable=False)
    peak_confidence = Column(Float, nullable=False)
    latest_explanation = Column(String(1000), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    __table_args__ = (
        Index("idx_incidents_device_instance_status", "device_id", "device_instance_id", "status"),
        Index("idx_incidents_region_status", "region", "status"),
        Index("idx_incidents_anomaly_status", "anomaly_type", "status"),
    )


class RegionalConflict(Base):
    """Represents an authoritative cross-device regional conflict."""
    __tablename__ = "regional_conflicts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    conflict_id = Column(String(64), unique=True, index=True, default=generate_conflict_id, nullable=False)
    region = Column(String(50), nullable=False, index=True)
    status = Column(String(20), default="ACTIVE", nullable=False, index=True)  # ACTIVE, RESOLVED
    anomaly_types = Column(JSON, nullable=False)  # List[str] e.g. ["spike"]
    affected_devices = Column(JSON, nullable=False)  # List[Dict[str, Any]]
    severity = Column(Float, nullable=False)
    confidence = Column(Float, nullable=False)
    explanation = Column(String(1000), nullable=False)
    detected_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    last_updated_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    acknowledged_by = Column(String(100), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolved_by = Column(String(100), nullable=True)
    resolution_reason = Column(String(500), nullable=True)
    is_transient = Column(Boolean, default=False, nullable=False)
    consecutive_anomalous_count = Column(Integer, default=1, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    __table_args__ = (
        Index("idx_conflicts_region_status", "region", "status"),
        Index("idx_conflicts_status_detected", "status", "detected_at"),
    )


class Baseline(Base):
    """Stores snapshot of learned baseline statistics for a device instance."""
    __tablename__ = "baselines"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    device_id = Column(String(50), nullable=False, index=True)
    device_instance_id = Column(String(100), nullable=False, index=True)
    temperature_mean = Column(Float, nullable=False)
    temperature_std = Column(Float, nullable=False)
    vibration_mean = Column(Float, nullable=False)
    vibration_std = Column(Float, nullable=False)
    current_mean = Column(Float, nullable=False, default=10.0)
    current_std = Column(Float, nullable=False, default=0.5)
    rpm_mean = Column(Float, nullable=False, default=1500.0)
    rpm_std = Column(Float, nullable=False, default=10.0)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    __table_args__ = (
        Index("idx_baselines_id_instance", "device_id", "device_instance_id"),
    )


class Alert(Base):
    """Stores alerts for fast querying and backward compatibility."""
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    device_id = Column(String(50), nullable=False, index=True)
    device_instance_id = Column(String(100), nullable=True, index=True)
    failure_type = Column(String(50), nullable=False)  # drift, spike, flatline, oscillation, sensor_swap
    severity = Column(String(20), nullable=False)      # HEALTHY, WARNING, CRITICAL
    confidence = Column(Float, nullable=False)        # 0.0 to 1.0
    timestamp = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    __table_args__ = (
        Index("idx_alerts_id_instance", "device_id", "device_instance_id"),
    )


class User(Base):
    """Represents an authenticated fleet operator."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    full_name = Column(String(100), nullable=False)
    role = Column(String(50), nullable=False)
    password_hash = Column(String(100), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)


class SessionEvent(Base):
    """Represents an operator login session event."""
    __tablename__ = "session_events"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    username = Column(String(50), index=True, nullable=False)
    session_id = Column(String(64), unique=True, index=True, nullable=False)
    login_timestamp = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    ip_address = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)


class IncidentEvent(Base):
    """Stores lifecycle audit events for incident tracking."""
    __tablename__ = "incident_events"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    incident_id = Column(String(64), index=True, nullable=False)
    event_type = Column(String(50), index=True, nullable=False)  # INCIDENT_DETECTED, INCIDENT_ACTIVATED, INCIDENT_ACKNOWLEDGED, INCIDENT_RESOLVED, TRANSIENT_DETECTED, TRANSIENT_CLEARED
    operator_name = Column(String(100), nullable=True)
    details = Column(JSON, nullable=True)
    timestamp = Column(DateTime(timezone=True), default=utc_now, nullable=False)
