from fastapi import FastAPI
from app.api.v1.routes import interactions
from app.core.config import settings
from app.db.session import engine, Base
from app.db.models.interaction import RawInteraction
from app.db.models.feature_record import CreatorFeatureRecord
import logging

try:
    # Create tables for MVP
    Base.metadata.create_all(bind=engine)
except Exception as e:
    logging.warning(f"Could not connect to database at startup: {e}")

app = FastAPI(title=settings.PROJECT_NAME, version=settings.VERSION)

app.include_router(interactions.router, prefix=f"{settings.API_V1_STR}/interactions", tags=["interactions"])

@app.get("/health")
def health_check():
    return {"status": "ok"}
