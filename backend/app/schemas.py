import math
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

VALID_STATUSES = {"HEALTHY", "WARNING", "CRITICAL", "healthy", "warning", "critical"}
VALID_FAILURE_TYPES = {"drift", "spike", "flatline", "oscillation", "sensor_swap"}
VALID_TELEMETRY_STATUSES = {"ACTIVE", "STALE", "OFFLINE"}
VALID_INCIDENT_STATUSES = {"ACTIVE", "RESOLVED"}
CANONICAL_METRICS = ("temperature", "vibration", "current", "rpm")

def validate_finite_number(v: Any, field_name: str) -> float:
    if v is None:
        raise ValueError(f"{field_name} cannot be null")
    try:
        f = float(v)
    except (TypeError, ValueError):
        raise ValueError(f"{field_name} must be a valid number")
    if not math.isfinite(f):
        raise ValueError(f"{field_name} must be a finite number (not NaN or Infinity)")
    return f

def validate_non_empty_string(v: Any, field_name: str, max_len: int = 50) -> str:
    if not isinstance(v, str) or not v.strip():
        raise ValueError(f"{field_name} must be a non-empty string")
    if len(v.strip()) > max_len:
        raise ValueError(f"{field_name} must not exceed {max_len} characters")
    return v.strip()

# --- Canonical Telemetry Ingest Schema ---
class TelemetryIngestRequest(BaseModel):
    device_id: str = Field(..., max_length=50, description="Logical device ID (e.g. DEV-017)")
    device_instance_id: str = Field(..., max_length=100, description="Physical device session / instance ID (e.g. INST-017-A)")
    region: str = Field(..., max_length=50, description="Operational geographic region (e.g. South)")
    timestamp: Optional[datetime] = Field(default=None, description="ISO-8601 timestamp (defaults to current UTC if omitted)")
    metrics: Optional[Dict[str, Any]] = Field(default=None, description="Dictionary containing canonical metrics: temperature, vibration, current, rpm")

    temperature: Optional[Any] = None
    vibration: Optional[Any] = None
    current: Optional[Any] = None
    rpm: Optional[Any] = None

    @field_validator("device_id")
    @classmethod
    def check_device_id(cls, v: Any) -> str:
        return validate_non_empty_string(v, "device_id", 50)

    @field_validator("device_instance_id")
    @classmethod
    def check_instance_id(cls, v: Any) -> str:
        return validate_non_empty_string(v, "device_instance_id", 100)

    @field_validator("region")
    @classmethod
    def check_region(cls, v: Any) -> str:
        return validate_non_empty_string(v, "region", 50)

    @model_validator(mode="after")
    def validate_canonical_metrics(self) -> "TelemetryIngestRequest":
        m_dict: Dict[str, float] = {}

        if self.metrics is not None:
            if not isinstance(self.metrics, dict):
                raise ValueError("metrics must be a dictionary")
            for key in CANONICAL_METRICS:
                if key not in self.metrics:
                    raise ValueError(f"Missing required canonical metric: '{key}'")
                m_dict[key] = validate_finite_number(self.metrics[key], key)
        else:
            for key in CANONICAL_METRICS:
                val = getattr(self, key, None)
                if val is None:
                    raise ValueError(f"Missing required canonical metric: '{key}'")
                m_dict[key] = validate_finite_number(val, key)

        self.metrics = m_dict
        return self


# --- Rich HealthResult Response Schema ---
class HealthResultResponse(BaseModel):
    device_id: str
    device_instance_id: Optional[str] = None
    region: Optional[str] = None
    status: str
    anomaly_type: str
    severity: float
    confidence: float
    current_metrics: Dict[str, Any]
    baseline_metrics: Dict[str, Any]
    detectors: List[Dict[str, Any]] = []
    explanation: str = ""
    timestamp: Optional[str] = None
    is_mature: bool = True

    model_config = ConfigDict(from_attributes=True)


# --- Incident Response Schema with Bounds ---
class IncidentResponse(BaseModel):
    id: int
    incident_id: str
    device_id: str
    device_instance_id: str
    region: str
    anomaly_type: str
    severity: float = Field(..., ge=0.0, le=1.0)
    confidence: float = Field(..., ge=0.0, le=1.0)
    status: str
    first_detected_at: datetime
    last_detected_at: datetime
    resolved_at: Optional[datetime] = None
    occurrence_count: int = Field(..., ge=1)
    peak_severity: float = Field(..., ge=0.0, le=1.0)
    peak_confidence: float = Field(..., ge=0.0, le=1.0)
    latest_explanation: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- Device Schemas ---
class DeviceBase(BaseModel):
    device_id: str = Field(..., max_length=50)
    device_instance_id: str = Field(..., max_length=100)
    region: str = Field(..., max_length=50)
    status: str = Field(default="HEALTHY")

class DeviceCreate(BaseModel):
    device_id: str = Field(..., max_length=50)
    device_instance_id: Optional[str] = Field(default=None, max_length=100)
    region: str = Field(..., max_length=50)
    status: str = Field(default="HEALTHY")

class DeviceResponse(BaseModel):
    device_id: str
    device_instance_id: str
    region: str
    status: str
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class DeviceDetailResponse(BaseModel):
    device_id: str
    device_instance_id: str
    region: str
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- Baseline & Alert Schemas ---
class BaselineResponse(BaseModel):
    device_id: str
    device_instance_id: str
    temperature_mean: float
    temperature_std: float
    vibration_mean: float
    vibration_std: float
    current_mean: float
    current_std: float
    rpm_mean: float
    rpm_std: float
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class AlertResponse(BaseModel):
    id: int
    device_id: str
    device_instance_id: Optional[str] = None
    failure_type: str
    severity: str
    confidence: float
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)

# --- Legacy Detection Schemas ---
class DetectionInput(BaseModel):
    device_id: str = Field(..., max_length=50)
    status: str
    failure_type: str
    confidence: float

    @field_validator("device_id")
    @classmethod
    def check_device_id(cls, v: Any) -> str:
        return validate_non_empty_string(v, "device_id", 50)

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in VALID_STATUSES:
            raise ValueError(f"status must be one of: {', '.join(sorted(VALID_STATUSES))}")
        return v

    @field_validator("failure_type")
    @classmethod
    def validate_failure_type(cls, v: str) -> str:
        if v not in VALID_FAILURE_TYPES:
            raise ValueError(f"failure_type must be one of: {', '.join(sorted(VALID_FAILURE_TYPES))}")
        return v

    @field_validator("confidence")
    @classmethod
    def validate_confidence(cls, v: Any) -> float:
        val = validate_finite_number(v, "confidence")
        if not (0.0 <= val <= 1.0):
            raise ValueError("confidence must be between 0.0 and 1.0 inclusive")
        return val

class DetectionResponse(BaseModel):
    message: str
    device_id: str
    status: str
    alert: AlertResponse

    model_config = ConfigDict(from_attributes=True)


# --- Summary & Authoritative State Schemas ---
class FleetSummaryResponse(BaseModel):
    total_devices: int
    healthy: int
    warning: int
    critical: int
    active_alerts: int

class RegionSummaryItem(BaseModel):
    region: Optional[str] = None
    total_devices: int
    healthy: int
    warning: int
    critical: int
    active_alerts: Optional[int] = 0
    active_conflicts: Optional[int] = 0

class DeviceStateReading(BaseModel):
    temperature: float
    vibration: float
    current: float
    rpm: float
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)

class DeviceStateAlert(BaseModel):
    failure_type: str
    severity: str
    confidence: float
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)

class DeviceStateResponse(BaseModel):
    device_id: str
    device_instance_id: str
    region: str
    status: str
    telemetry_status: str = Field(default="OFFLINE")
    seconds_since_last_reading: Optional[int] = None
    latest_reading: Optional[DeviceStateReading] = None
    latest_alert: Optional[DeviceStateAlert] = None

    model_config = ConfigDict(from_attributes=True)


# --- Regional Conflict Schemas ---
class RegionalConflictResponse(BaseModel):
    id: int
    conflict_id: str
    region: str
    status: str
    anomaly_types: List[str]
    affected_devices: List[Dict[str, Any]]
    severity: float = Field(..., ge=0.0, le=1.0)
    confidence: float = Field(..., ge=0.0, le=1.0)
    explanation: str
    detected_at: datetime
    last_updated_at: datetime
    resolved_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class RegionalDetailResponse(BaseModel):
    region: str
    total_devices: int
    healthy: int
    warning: int
    critical: int
    active_conflicts: List[RegionalConflictResponse] = []

    model_config = ConfigDict(from_attributes=True)


RegionSummaryResponse = RegionSummaryItem
