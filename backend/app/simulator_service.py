import asyncio
import logging
import random
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from sqlalchemy.orm import sessionmaker
from app.database import engine
from app import intelligence_service, incident_service, conflict_service, models
from app.websocket_manager import manager
from app.routes.incidents import serialize_incident_for_ui
from simulator.fleet_simulator import FleetSimulator

logger = logging.getLogger("adaptive_fleet.simulator")

class BackgroundTelemetryService:
    """
    Continuous Background Fleet Simulator.
    Generates realistic 4-metric telemetry for all 50 devices using Member 1's FleetSimulator.
    Evaluates through real HealthEngine, updates PostgreSQL, and broadcasts real-time WebSocket events.
    """

    def __init__(self):
        self.simulator = FleetSimulator(seed=42, sampling_interval_seconds=2)
        # Inject standard demo failure behaviors
        self.simulator.inject_failure("DEV-007", "drift", target_metric="temperature", rate=1.2)
        self.simulator.inject_failure("DEV-014", "spike", target_metric="current", magnitude=26.0)
        self.simulator.inject_failure("DEV-021", "flatline", target_metric="vibration")
        self.simulator.inject_failure("DEV-032", "oscillation", target_metric="vibration", amplitude=4.8)
        self.simulator.inject_failure("DEV-045", "sensor_swap", target_device_id="DEV-024")
        
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self.SessionMaker = sessionmaker(bind=engine)

    async def start(self):
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._run_loop())
        logger.info("Continuous Background Telemetry Simulator started (50 devices).")

    async def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Continuous Background Telemetry Simulator stopped.")

    async def _run_loop(self):
        while self._running:
            try:
                await asyncio.sleep(2.0)
                packets = self.simulator.step()
                now_utc = datetime.now(timezone.utc)
                ts_iso = now_utc.isoformat().replace("+00:00", "Z")

                # Pick 4 random devices + 1 failure candidate per cycle
                batch = random.sample(packets, min(4, len(packets)))
                failure_devs = [p for p in packets if p.device_id in ["DEV-007", "DEV-014", "DEV-021", "DEV-032", "DEV-045"]]
                if failure_devs and random.random() < 0.5:
                    batch.append(random.choice(failure_devs))

                db = self.SessionMaker()
                try:
                    for p in batch:
                        metrics_dict = {
                            "temperature": float(p.metrics["temperature"]),
                            "vibration": float(p.metrics["vibration"]),
                            "current": float(p.metrics["current"]),
                            "rpm": float(p.metrics["rpm"])
                        }

                        # Process through Member 1 HealthEngine
                        health_result = intelligence_service.process_reading(
                            db=db,
                            device_id=p.device_id,
                            device_instance_id=p.device_instance_id,
                            region=p.region,
                            metrics=metrics_dict,
                            timestamp=now_utc
                        )

                        # Update Device record
                        dev = db.query(models.Device).filter(
                            models.Device.device_id == p.device_id,
                            models.Device.device_instance_id == p.device_instance_id
                        ).first()
                        if dev:
                            raw_st = str(health_result.get("status", "HEALTHY")).upper()
                            dev.status = raw_st if raw_st in ["HEALTHY", "WARNING", "CRITICAL"] else "HEALTHY"
                            dev.updated_at = now_utc

                        # Record SensorReading
                        sr = models.SensorReading(
                            device_id=p.device_id,
                            device_instance_id=p.device_instance_id,
                            region=p.region,
                            timestamp=now_utc,
                            temperature=p.metrics['temperature'],
                            vibration=p.metrics['vibration'],
                            current=p.metrics['current'],
                            rpm=p.metrics['rpm'],
                            received_at=now_utc
                        )
                        db.add(sr)

                        # Record HealthResult
                        hr_rec = models.HealthResultRecord(
                            device_id=p.device_id,
                            device_instance_id=p.device_instance_id,
                            region=p.region,
                            status=health_result.get("status", "healthy"),
                            anomaly_type=health_result.get("anomaly_type", "none"),
                            severity=health_result.get("severity", 0.0),
                            confidence=health_result.get("confidence", 0.0),
                            current_metrics=health_result.get("current_metrics", {}),
                            baseline_metrics=health_result.get("baseline_metrics", {}),
                            detectors=health_result.get("detectors", []),
                            explanation=health_result.get("explanation", ""),
                            is_mature=health_result.get("is_mature", True),
                            timestamp=now_utc,
                            created_at=now_utc
                        )
                        db.add(hr_rec)

                        # Incident Lifecycle
                        incident_obj, incident_action = incident_service.process_incident_lifecycle(
                            db=db,
                            device_id=p.device_id,
                            device_instance_id=p.device_instance_id,
                            region=p.region,
                            health_result=health_result,
                            reading_timestamp=now_utc
                        )

                        db.commit()

                        # Broadcast telemetry_update
                        await manager.broadcast({
                            "event": "telemetry_update",
                            "type": "telemetry_update",
                            "device_id": p.device_id,
                            "device_instance_id": p.device_instance_id,
                            "region": p.region,
                            "timestamp": ts_iso,
                            "temperature": p.metrics["temperature"],
                            "vibration": p.metrics["vibration"],
                            "current": p.metrics["current"],
                            "rpm": p.metrics["rpm"],
                            "reading": {
                                "device_id": p.device_id,
                                "device_instance_id": p.device_instance_id,
                                "region": p.region,
                                "timestamp": ts_iso,
                                "temperature": p.metrics["temperature"],
                                "vibration": p.metrics["vibration"],
                                "current": p.metrics["current"],
                                "rpm": p.metrics["rpm"]
                            }
                        })

                        # Broadcast incident update if changed
                        if incident_obj and incident_action:
                            serialized_inc = serialize_incident_for_ui(incident_obj, db)
                            await manager.broadcast({
                                "event": incident_action,
                                "type": incident_action,
                                "action": incident_action,
                                "data": serialized_inc,
                                "alert": serialized_inc,
                                "incident": serialized_inc,
                                "timestamp": ts_iso
                            })
                finally:
                    db.close()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Continuous background simulator exception: {e}")

# Global background simulator service
telemetry_bg_service = BackgroundTelemetryService()
