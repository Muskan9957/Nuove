import datetime
import emoji
import Levenshtein
from app.schemas.interaction import InteractionRequest
from app.schemas.feature_vector import FeatureVector
from app.core.feature_definitions import InteractionType

class FeatureExtractionService:
    @staticmethod
    def extract_features(request: InteractionRequest, interaction_id: str, created_at: datetime.datetime) -> FeatureVector:
        prompt_len = len(request.prompt.split()) if request.prompt else 0
        response_len = len(request.ai_response.split()) if request.ai_response else 0
        edited_len = len(request.edited_response.split()) if request.edited_response else 0
        
        words_added = 0
        words_removed = 0
        edit_dist = 0
        emoji_cnt = 0
        
        final_text = request.edited_response if request.edited_response else request.ai_response
        if final_text:
            emoji_cnt = emoji.emoji_count(final_text)
            
        if request.ai_response and request.edited_response:
            ai_words = request.ai_response.split()
            edit_words = request.edited_response.split()
            edit_dist = Levenshtein.distance(request.ai_response, request.edited_response)
            
            # Simple heuristic for words added/removed using length difference
            # A more robust diff would use difflib, but this is a good V1 proxy
            ai_set = set(ai_words)
            edit_set = set(edit_words)
            words_added = len(edit_set - ai_set)
            words_removed = len(ai_set - edit_set)
            
        regenerated = request.interaction_type == InteractionType.REGENERATE
        
        return FeatureVector(
            interaction_id=interaction_id,
            user_id=request.user_id,
            interaction_type=request.interaction_type,
            prompt_length=prompt_len,
            response_length=response_len,
            edited_length=edited_len,
            words_added=words_added,
            words_removed=words_removed,
            edit_distance=edit_dist,
            emoji_count=emoji_cnt,
            regenerated=regenerated,
            feedback=request.feedback,
            created_at=created_at
        )
