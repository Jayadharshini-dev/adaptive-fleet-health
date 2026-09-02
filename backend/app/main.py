import os
import logging
import math
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from app.routes import devices, readings, baselines, alerts, websocket, incidents, conflicts, auth
from app.database import engine, Base, SessionLocal
from app import models
from scripts.seed_data import seed_database

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("adaptive_fleet")

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        device_count = db.query(models.Device).count()
        db.close()
        if device_count == 0:
            logger.info("Database is empty. Automatically seeding 50 devices and sensor readings...")
            seed_database()
        else:
            logger.info(f"Database ready with {device_count} devices.")
    except Exception as e:
        logger.warning(f"Database initialization check: {e}")
    yield

app = FastAPI(
    lifespan=lifespan,
    title="Adaptive Fleet Health Monitoring API",
    description="""
## Adaptive Fleet Health Monitoring with Concurrent Session Coordination
**Authoritative Backend API with Real HealthEngine, Incident Lifecycle & Regional Conflict Engine**
""",
    version="3.2.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

def sanitize_nan_inf(obj):
    if isinstance(obj, float):
        if not math.isfinite(obj):
            return str(obj)
        return obj
    elif isinstance(obj, dict):
        return {k: sanitize_nan_inf(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [sanitize_nan_inf(item) for item in obj]
    return obj

@app.exception_handler(RequestValidationError)
async def custom_validation_exception_handler(request: Request, exc: RequestValidationError):
    sanitized_errors = []
    for err in exc.errors():
        err_copy = dict(err)
        if "input" in err_copy:
            err_copy["input"] = sanitize_nan_inf(err_copy["input"])
        sanitized_errors.append(err_copy)
    return JSONResponse(status_code=422, content={"detail": jsonable_encoder(sanitized_errors)})

# Configurable CORS Origins from environment
cors_origins_env = os.getenv("CORS_ORIGINS", "*")
origins = [o.strip() for o in cors_origins_env.split(",") if o.strip()] if cors_origins_env != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(devices.router)
app.include_router(readings.router)
app.include_router(baselines.router)
app.include_router(alerts.router)
app.include_router(incidents.router)
app.include_router(conflicts.router)
app.include_router(websocket.router)

@app.get(
    "/",
    tags=["Root"],
    summary="Root metadata",
    description="Returns backend status, version, and architecture phase."
)
def root():
    return {
        "message": "Adaptive Fleet Backend is running with real Member 1 HealthEngine, Incident Lifecycle, and Regional Conflict Engine",
        "version": "3.2.0",
        "phase": "Full Integration (Member 1 + Member 2 + Member 3 Complete)"
    }

@app.get(
    "/health",
    tags=["Root"],
    summary="System Health Check",
    description="Returns system liveness and health status."
)
def health_check():
    return {
        "status": "healthy",
        "service": "adaptive-fleet-backend",
        "version": "3.2.0"
    }
