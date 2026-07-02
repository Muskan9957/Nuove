from enum import Enum

class InteractionType(str, Enum):
    SCRIPT_GEN = "script_gen"
    CAPTION_GEN = "caption_gen"
    AI_COACH = "ai_coach"
    SCRIPT_EDIT = "script_edit"
    CAPTION_EDIT = "caption_edit"
    REGENERATE = "regenerate"
    FEEDBACK = "feedback"

# Feature Names Constants
FEATURE_PROMPT_LENGTH = "prompt_length"
FEATURE_RESPONSE_LENGTH = "response_length"
FEATURE_EDITED_LENGTH = "edited_length"
FEATURE_WORDS_ADDED = "words_added"
FEATURE_WORDS_REMOVED = "words_removed"
FEATURE_EDIT_DISTANCE = "edit_distance"
FEATURE_EMOJI_COUNT = "emoji_count"
FEATURE_REGENERATED = "regenerated"
FEATURE_FEEDBACK = "feedback"
