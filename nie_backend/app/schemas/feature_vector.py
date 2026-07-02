from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.core.feature_definitions import InteractionType

class FeatureVector(BaseModel):
    """Standardized internal output for all interactions."""
    interaction_id: str
    user_id: str
    interaction_type: InteractionType
    prompt_length: Optional[int] = 0
    response_length: Optional[int] = 0
    edited_length: Optional[int] = 0
    words_added: Optional[int] = 0
    words_removed: Optional[int] = 0
    edit_distance: Optional[int] = 0
    emoji_count: Optional[int] = 0
    regenerated: bool = False
    feedback: Optional[int] = None
    created_at: datetime
