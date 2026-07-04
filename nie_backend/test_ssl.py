import pytest
from app.ml.semi_supervised.label_generator import LabelGenerator
from app.core.feature_definitions import InteractionType

def test_explicit_like():
    generator = LabelGenerator()
    label = generator.generate(
        interaction_type=InteractionType.SCRIPT_GEN.value,
        prompt="topic",
        ai_response="something",
        edited_response="something else",
        feedback=1
    )
    assert label.label == "Accepted"
    assert label.confidence_score == 1.0
    assert label.reason == "EXPLICIT_LIKE"

def test_explicit_dislike():
    generator = LabelGenerator()
    label = generator.generate(
        interaction_type=InteractionType.SCRIPT_GEN.value,
        prompt="topic",
        ai_response="something",
        edited_response="something else completely different",
        feedback=0
    )
    assert label.label == "Rejected"
    assert label.confidence_score == 1.0
    assert label.reason == "EXPLICIT_DISLIKE"

def test_immediate_regeneration():
    generator = LabelGenerator()
    label = generator.generate(
        interaction_type=InteractionType.REGENERATE.value,
        prompt="topic",
        ai_response="bad hook",
        edited_response=None,
        feedback=None
    )
    assert label.label == "Rejected"
    assert label.confidence_score == 0.7
    assert label.reason == "IMMEDIATE_REGENERATION"

def test_high_similarity():
    generator = LabelGenerator()
    # 1 word changed out of many
    ai_text = "This is a really great hook for a viral video"
    edit_text = "This is a super great hook for a viral video"
    
    label = generator.generate(
        interaction_type=InteractionType.SCRIPT_EDIT.value,
        prompt="topic",
        ai_response=ai_text,
        edited_response=edit_text,
        feedback=None
    )
    assert label.label == "Accepted"
    assert label.reason == "HIGH_SIMILARITY"

def test_low_similarity():
    generator = LabelGenerator()
    # Complete rewrite
    ai_text = "This is a really great hook for a viral video"
    edit_text = "Stop scrolling! Here are three tips for programming faster in Python today."
    
    label = generator.generate(
        interaction_type=InteractionType.SCRIPT_EDIT.value,
        prompt="topic",
        ai_response=ai_text,
        edited_response=edit_text,
        feedback=None
    )
    assert label.label == "Rejected"
    assert label.reason == "LOW_SIMILARITY"

def test_neutral_ambiguous():
    generator = LabelGenerator()
    # Moderate edits (around 50-60% similar)
    ai_text = "This is a really great hook for a viral video about coding."
    edit_text = "This is an okay hook for a viral video about coding and python."
    
    label = generator.generate(
        interaction_type=InteractionType.SCRIPT_EDIT.value,
        prompt="topic",
        ai_response=ai_text,
        edited_response=edit_text,
        feedback=None
    )
    
    # We might need to adjust the text if it doesn't fall precisely in the 40-80 range,
    # but let's see. If the test fails, we can fine-tune the strings.
    assert label.label == "Neutral"
    assert label.reason == "AMBIGUOUS"

def test_no_signal():
    generator = LabelGenerator()
    label = generator.generate(
        interaction_type=InteractionType.SCRIPT_GEN.value,
        prompt="topic",
        ai_response=None,
        edited_response=None,
        feedback=None
    )
    assert label.label == "No Label"
    assert label.reason == "NO_SIGNAL"
