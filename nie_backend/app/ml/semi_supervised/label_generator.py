from dataclasses import dataclass
from typing import Optional
import Levenshtein
from app.core.config import settings
from app.core.feature_definitions import InteractionType

@dataclass
class GeneratedLabel:
    label: str
    confidence_score: float
    reason: str

class LabelGenerator:
    def __init__(self):
        self.high_sim = settings.HIGH_SIMILARITY_THRESHOLD
        self.low_sim = settings.LOW_SIMILARITY_THRESHOLD

    def generate(
        self, 
        interaction_type: str, 
        prompt: Optional[str], 
        ai_response: Optional[str], 
        edited_response: Optional[str], 
        feedback: Optional[int]
    ) -> GeneratedLabel:
        
        # Priority 1: Explicit Feedback overrides everything
        if feedback is not None:
            if feedback == 1:
                return GeneratedLabel(label="Accepted", confidence_score=1.0, reason="EXPLICIT_LIKE")
            elif feedback == 0:
                return GeneratedLabel(label="Rejected", confidence_score=1.0, reason="EXPLICIT_DISLIKE")
        
        # Priority 2: Interaction Type Heuristics (e.g., immediate regenerate)
        if interaction_type == InteractionType.REGENERATE.value:
            return GeneratedLabel(label="Rejected", confidence_score=0.7, reason="IMMEDIATE_REGENERATION")
            
        # Priority 3: String Similarity Heuristics
        if not ai_response or not edited_response:
            return GeneratedLabel(label="No Label", confidence_score=0.0, reason="NO_SIGNAL")
            
        distance = Levenshtein.distance(ai_response, edited_response)
        max_len = max(len(ai_response), len(edited_response))
        similarity = 1.0 - (distance / max_len) if max_len > 0 else 1.0
        
        # If it's a perfect match (no edits)
        if similarity == 1.0:
            return GeneratedLabel(label="Accepted", confidence_score=0.9, reason="HIGH_SIMILARITY")
            
        if similarity >= self.high_sim:
            return GeneratedLabel(label="Accepted", confidence_score=0.8, reason="HIGH_SIMILARITY")
        elif similarity <= self.low_sim:
            return GeneratedLabel(label="Rejected", confidence_score=0.8, reason="LOW_SIMILARITY")
        else:
            return GeneratedLabel(label="Neutral", confidence_score=0.0, reason="AMBIGUOUS")
