from pydantic import BaseModel
from typing import Dict, Any
from datetime import datetime
import uuid
from app.schemas.feature_vector import FeatureVector

class FeatureStoreRequest(FeatureVector):
    pass 

class FeatureRecordResponse(BaseModel):
    id: uuid.UUID
    user_id: str
    interaction_id: str
    interaction_type: str
    feature_version: int
    source_module: str
    features: Dict[str, Any]
    created_at: datetime
    
    class Config:
        from_attributes = True
