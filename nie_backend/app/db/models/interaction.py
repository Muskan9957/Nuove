import uuid
from sqlalchemy import Column, String, Text, Integer, DateTime, func, JSON, Uuid
from app.db.session import Base

class RawInteraction(Base):
    __tablename__ = "raw_interactions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    user_id = Column(String, index=True, nullable=False)
    interaction_type = Column(String, index=True, nullable=False)
    prompt = Column(Text, nullable=True)
    ai_response = Column(Text, nullable=True)
    edited_response = Column(Text, nullable=True)
    feedback = Column(Integer, nullable=True)
    metadata_ = Column("metadata", JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
