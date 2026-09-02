import sys
import os

# Add parent directory to path so script can be run standalone
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import engine, Base
from app import models

def create_tables():
    print("=" * 60)
    print("Creating database tables for Adaptive Fleet Backend...")
    print(f"Target Database URL: {engine.url}")
    print("=" * 60)
    
    try:
        Base.metadata.create_all(bind=engine)
        print(" Successfully created tables:")
        for table in Base.metadata.tables.keys():
            print(f"   - {table}")
        print("=" * 60)
    except Exception as e:
        print(f"❌ Error creating tables: {e}", file=sys.stderr)
        print("\nTroubleshooting:", file=sys.stderr)
        print("1. Ensure PostgreSQL is running (e.g., brew services start postgresql)", file=sys.stderr)
        print("2. Ensure the database 'adaptive_fleet' exists in PostgreSQL", file=sys.stderr)
        print("3. Verify your DATABASE_URL in the .env file", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    create_tables()
