"""
FastAPI application entry point — NER Landslide Early Warning Platform.
"""
from sqlalchemy import inspect as sa_inspect
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.session import engine
from app.db.base import Base
import app.models.models  # noqa: F401
from app.routers import risk, weather, roads, reports, alerts, dashboard, auth, sync, chat, notifications
from fastapi.staticfiles import StaticFiles

from sqlalchemy import text

# Keep SQLite developer fallback usable.  PostgreSQL schema changes are owned
# exclusively by Alembic; startup must not drift a deployed database.
os.makedirs(settings.upload_dir, exist_ok=True)
if engine.dialect.name == "sqlite":
    for table in Base.metadata.tables.values():
        try:
            table.create(bind=engine, checkfirst=True)
        except Exception as e:
            print(f"Table creation note for {table.name}: {e}")

# Automatically add missing columns for existing database.
# Uses introspection so it works on both PostgreSQL and SQLite.


def _add_column_if_missing(engine, table: str, column: str, col_type: str, default=None):
    """Maintain the local SQLite fallback without altering PostgreSQL at startup."""
    if engine.dialect.name != "sqlite":
        return
    try:
        insp = sa_inspect(engine)
        if table not in insp.get_table_names():
            return  # table doesn't exist yet — will be created by metadata.create_all
        existing = {c["name"] for c in insp.get_columns(table)}
        if column in existing:
            return
        default_clause = f" DEFAULT {default}" if default is not None else ""
        with engine.connect() as conn:
            conn.execute(
                text(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}{default_clause}"))
            conn.commit()
        print(f"Migration: added {table}.{column}")
    except Exception as e:
        print(f"Migration note ({table}.{column}): {e}")


_add_column_if_missing(engine, "field_reports",
                       "severity", "VARCHAR(50)", "'medium'")
_add_column_if_missing(engine, "users", "is_verified", "BOOLEAN", "FALSE")
_add_column_if_missing(engine, "users", "proof_path", "VARCHAR(500)")
_add_column_if_missing(engine, "users", "created_at",
                       "DATETIME", "CURRENT_TIMESTAMP")
_add_column_if_missing(engine, "alerts", "lat", "FLOAT")
_add_column_if_missing(engine, "alerts", "lng", "FLOAT")
_add_column_if_missing(engine, "alerts", "description", "TEXT")

# Back-fill nulls
if engine.dialect.name == "sqlite":
    try:
        with engine.connect() as conn:
            conn.execute(text(
                "UPDATE field_reports SET severity = 'medium' WHERE severity IS NULL OR severity = ''"))
            conn.commit()
    except Exception:
        pass

app = FastAPI(
    title="NER Landslide Early Warning Platform — API",
    description=(
        "AI-based landslide early warning and monitoring system for the "
        "North Eastern Region of India (pilot: East Khasi Hills, Meghalaya). "
        "Smart India Hackathon prototype."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS — allow local dev server and deployed frontend domains
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3001",
        # Production Vercel deployment.
        "https://landslide-risk-monitoring-system-ne.vercel.app",
        # Retain the previously configured deployment URL in case it is used.
        "https://landslide-risk-monitoring-system-ner.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all routers under /api prefix
API_PREFIX = "/api"

app.include_router(risk.router, prefix=API_PREFIX, tags=["Risk & Prediction"])
app.include_router(weather.router, prefix=API_PREFIX,
                   tags=["Weather & Sensors"])
app.include_router(roads.router, prefix=API_PREFIX,
                   tags=["GIS / Infrastructure"])
app.include_router(reports.router, prefix=API_PREFIX, tags=["Field Reporting"])
app.include_router(alerts.router, prefix=API_PREFIX,
                   tags=["Alerts & Notifications"])
app.include_router(dashboard.router, prefix=API_PREFIX, tags=["Dashboard"])
app.include_router(sync.router, prefix=API_PREFIX, tags=["Offline Sync"])
app.include_router(auth.router, prefix=API_PREFIX, tags=["Auth"])
app.include_router(chat.router, prefix=API_PREFIX, tags=["AI Assistant"])
app.include_router(notifications.router, prefix=API_PREFIX, tags=["Notifications"])

# Mount uploads directory to serve local photos
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")


@app.get("/", tags=["Health"])
def root():
    return {
        "service": "NER Landslide Early Warning Platform",
        "status": "running",
        "docs": "/docs",
        "api_base": "/api",
    }


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok"}
