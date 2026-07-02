import uuid
from sqlalchemy import Column, String, Integer, DateTime, func, JSON, Uuid
from app.db.session import Base

class CreatorFeatureRecord(Base):
    __tablename__ = "creator_features"
    
    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String, index=True, nullable=False)
    interaction_id = Column(String, index=True, nullable=False, unique=True)
    interaction_type = Column(String, index=True, nullable=False)
    feature_version = Column(Integer, nullable=False, default=1)
    source_module = Column(String, nullable=False, default="feature_extraction_v1")
    features = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), index=True, nullable=False)
