from pydantic import BaseModel
from typing import Optional, Dict, Any
from app.core.feature_definitions import InteractionType

class InteractionRequest(BaseModel):
    user_id: str
    interaction_type: InteractionType
    prompt: Optional[str] = None
    ai_response: Optional[str] = None
    edited_response: Optional[str] = None
    feedback: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = None

class InteractionResponse(BaseModel):
    status: str
    interaction_id: str
    message: str
