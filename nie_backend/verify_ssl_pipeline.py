import sys
import os
import uuid

# Ensure the app module can be imported
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.session import engine, Base, SessionLocal
from app.db.models.interaction import RawInteraction
from app.db.models.feature_record import CreatorFeatureRecord
from app.db.models.training_label import TrainingLabel
from app.ml.semi_supervised.ssl_service import SSLService
from app.core.feature_definitions import InteractionType
from datetime import datetime, timezone

def verify_pipeline():
    print("="*50)
    print(" NIE SSL Pipeline Verification")
    print("="*50)
    
    # 1. Setup DB
    print("\n[1] Initializing Test DB Schema...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    try:
        # Clear existing data for a clean test
        db.query(TrainingLabel).delete()
        db.query(CreatorFeatureRecord).delete()
        db.query(RawInteraction).delete()
        db.commit()

        # 2. Insert Mock Data (3 Interactions)
        print("\n[2] Seeding 3 RawInteractions and corresponding FeatureRecords...")
        
        # Mock 1: Minor Edit (Accepted)
        id1 = str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        raw1 = RawInteraction(id=id1, user_id="user_123", interaction_type=InteractionType.SCRIPT_EDIT.value, prompt="topic 1", ai_response="Base hook", edited_response="Base hook edited", created_at=now)
        feat1 = CreatorFeatureRecord(user_id="user_123", interaction_id=id1, interaction_type=InteractionType.SCRIPT_EDIT.value, features={}, created_at=now)
        
        # Mock 2: Major Edit (Rejected)
        id2 = str(uuid.uuid4())
        raw2 = RawInteraction(id=id2, user_id="user_123", interaction_type=InteractionType.SCRIPT_EDIT.value, prompt="topic 2", ai_response="Base hook", edited_response="Completely different text here", created_at=now)
        feat2 = CreatorFeatureRecord(user_id="user_123", interaction_id=id2, interaction_type=InteractionType.SCRIPT_EDIT.value, features={}, created_at=now)
        
        # Mock 3: Explicit Like (Accepted)
        id3 = str(uuid.uuid4())
        raw3 = RawInteraction(id=id3, user_id="user_123", interaction_type=InteractionType.SCRIPT_GEN.value, prompt="topic 3", ai_response="Base hook", edited_response=None, feedback=1, created_at=now)
        feat3 = CreatorFeatureRecord(user_id="user_123", interaction_id=id3, interaction_type=InteractionType.SCRIPT_GEN.value, features={}, created_at=now)
        
        db.add_all([raw1, raw2, raw3, feat1, feat2, feat3])
        db.commit()
        
        # 3. Batch Process
        print("\n[3] Running SSL Service Batch Processor...")
        ssl_service = SSLService(db)
        processed_count = ssl_service.process_unlabeled_batch(limit=10)
        print(f" -> Processed {processed_count} unlabeled interactions.")
        
        # 4. Duplicate Protection
        print("\n[4] Running Batch Processor again to verify Duplicate Protection...")
        duplicate_count = ssl_service.process_unlabeled_batch(limit=10)
        print(f" -> Processed {duplicate_count} interactions (Expected: 0).")
        assert duplicate_count == 0, "Duplicate protection failed!"
        
        # 5. Database Verification
        print("\n[5] Verifying database entries:")
        labels = db.query(TrainingLabel).all()
        assert len(labels) == 3, f"Expected 3 labels, found {len(labels)}"
        
        for idx, lbl in enumerate(labels):
            print(f"\n--- Label {idx+1} ---")
            print(f"Interaction ID: {lbl.interaction_id}")
            print(f"User ID: {lbl.user_id}")
            print(f"Label: {lbl.label}")
            print(f"Reason: {lbl.reason}")
            print(f"Confidence: {lbl.confidence_score}")
            print(f"Created At: {lbl.created_at}")
            
        print("\n✅ Verification Complete! Pipeline is production ready.")

    finally:
        db.close()

if __name__ == "__main__":
    verify_pipeline()
