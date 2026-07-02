import os
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from main import app
from app.db.session import Base, get_db
from app.core.feature_definitions import InteractionType

# Setup SQLite in-memory database for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200

def test_feature_extraction_and_store():
    payload = {
        "user_id": "user_123",
        "interaction_type": InteractionType.SCRIPT_EDIT,
        "prompt": "Create a script about machine learning.",
        "ai_response": "Here is a script. Machine learning is great. 🤖",
        "edited_response": "Here is a script. Machine learning is awesome! 🔥🤖",
        "feedback": 1
    }
    
    response = client.post("/api/v1/interactions/", json=payload)
    
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "success"
    assert "interaction_id" in data
    assert data["message"] == "Interaction processed successfully"
    print("Feature extraction endpoint test passed!")

    # Now verify the feature store internally via the service
    from app.services.feature_store_service import FeatureStoreService
    db = TestingSessionLocal()
    try:
        service = FeatureStoreService(db)
        
        # Test 1: Retrieve by user_id
        records = service.retrieve_by_user_id("user_123")
        assert len(records) > 0
        assert records[0].user_id == "user_123"
        assert records[0].feature_version == 1
        assert records[0].source_module == "feature_extraction_v1"
        assert "words_added" in records[0].features
        
        # Test 2: Batch store
        from app.schemas.feature_vector import FeatureVector
        from datetime import datetime
        
        vec1 = FeatureVector(interaction_id="uuid1", user_id="user_batch", interaction_type=InteractionType.AI_COACH, created_at=datetime.now())
        vec2 = FeatureVector(interaction_id="uuid2", user_id="user_batch", interaction_type=InteractionType.SCRIPT_GEN, created_at=datetime.now())
        
        service.store_vectors([vec1, vec2])
        
        batch_records = service.retrieve_by_user_id("user_batch")
        assert len(batch_records) == 2
        
        print("Feature store internal retrieval and batch tests passed!")
        
    finally:
        db.close()

if __name__ == "__main__":
    test_health()
    test_feature_extraction_and_store()
    print("All tests passed!")
