import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(BASE_DIR, ".env"))

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{os.path.join(BASE_DIR, 'adaptive_fleet.db')}")

# Ensure SQLite path is resolved to absolute project root so uvicorn finds it from any working directory
if DATABASE_URL.startswith("sqlite:///") and not DATABASE_URL.startswith("sqlite:////") and ":memory:" not in DATABASE_URL:
    rel_path = DATABASE_URL.replace("sqlite:///", "").lstrip("./")
    DATABASE_URL = f"sqlite:///{os.path.join(BASE_DIR, rel_path)}"

if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False}
    )
else:
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    """Dependency provider that yields a SQLAlchemy database session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
