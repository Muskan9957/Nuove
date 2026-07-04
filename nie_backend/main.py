from fastapi import FastAPI
from app.api.v1.routes import feature_store, interactions, training
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

app.include_router(feature_store.router, prefix="/api/v1/feature-store", tags=["Feature Store"])
app.include_router(interactions.router, prefix="/api/v1/interactions", tags=["Interactions"])
app.include_router(training.router, prefix="/api/v1/training", tags=["ML Training"])

@app.get("/health")
def health_check():
    return {"status": "ok"}
