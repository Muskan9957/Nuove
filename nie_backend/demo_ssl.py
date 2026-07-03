import sys
import os

# Ensure the app module can be imported
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.ml.semi_supervised.label_generator import LabelGenerator
from app.core.feature_definitions import InteractionType

def run_demo():
    generator = LabelGenerator()
    
    print("="*50)
    print(" NIE Semi-Supervised Learning (SSL) Demo")
    print("="*50)
    
    # Scenario 1: Minor Edits (Accepted)
    print("\n[Scenario 1] User makes minor tweaks to the AI hook")
    print("AI Generated: 'Stop scrolling! Here are 3 tips to go viral.'")
    print("User Edited : 'Stop scrolling! Here are my 3 tips to go viral.'")
    result1 = generator.generate(
        interaction_type=InteractionType.SCRIPT_EDIT.value,
        prompt="viral tips",
        ai_response="Stop scrolling! Here are 3 tips to go viral.",
        edited_response="Stop scrolling! Here are my 3 tips to go viral.",
        feedback=None
    )
    print(f" Result -> Label: {result1.label} | Reason: {result1.reason} | Confidence: {result1.confidence_score}")
    
    # Scenario 2: Complete Rewrite (Rejected)
    print("\n[Scenario 2] User completely rewrites the hook")
    print("AI Generated: 'Stop scrolling! Here are 3 tips to go viral.'")
    print("User Edited : 'I grew my account to 10k followers in a week. Here is how.'")
    result2 = generator.generate(
        interaction_type=InteractionType.SCRIPT_EDIT.value,
        prompt="viral tips",
        ai_response="Stop scrolling! Here are 3 tips to go viral.",
        edited_response="I grew my account to 10k followers in a week. Here is how.",
        feedback=None
    )
    print(f" Result -> Label: {result2.label} | Reason: {result2.reason} | Confidence: {result2.confidence_score}")

    # Scenario 3: Explicit Feedback (Overrides edits)
    print("\n[Scenario 3] User rewrote it entirely, but clicked 'Thumbs Up' (Explicit Like)")
    result3 = generator.generate(
        interaction_type=InteractionType.SCRIPT_EDIT.value,
        prompt="viral tips",
        ai_response="Stop scrolling! Here are 3 tips to go viral.",
        edited_response="I grew my account to 10k followers in a week. Here is how.",
        feedback=1
    )
    print(f" Result -> Label: {result3.label} | Reason: {result3.reason} | Confidence: {result3.confidence_score}")
    
    print("\n" + "="*50)

if __name__ == "__main__":
    run_demo()
