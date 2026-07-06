import uuid
from sqlalchemy import Column, String, Float, DateTime, func, Uuid
from app.db.session import Base

class TrainingLabel(Base):
    __tablename__ = "training_labels"
    
    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String, index=True, nullable=False)
    interaction_id = Column(String, index=True, nullable=False, unique=True)
    
    # "Accepted", "Rejected", "Neutral", "No Label"
    label = Column(String, index=True, nullable=False)
    
    # "EXPLICIT_LIKE", "EXPLICIT_DISLIKE", "HIGH_SIMILARITY", "LOW_SIMILARITY", etc.
    reason = Column(String, nullable=False)
    
    confidence_score = Column(Float, nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
