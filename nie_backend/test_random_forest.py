import os
import shutil
import pytest
from datetime import datetime, timezone
from app.db.session import SessionLocal, engine, Base
from app.db.models.feature_record import CreatorFeatureRecord
from app.db.models.training_label import TrainingLabel
from app.ml.random_forest.model_manager import ModelManager, MODELS_BASE_DIR
from app.ml.random_forest.model_trainer import ModelTrainer
from app.ml.random_forest.predictor import Predictor

@pytest.fixture(scope="module")
def setup_database():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    # Clean up previous data
    db.query(TrainingLabel).delete()
    db.query(CreatorFeatureRecord).delete()
    db.commit()
    
    # Insert dummy data (15 records to allow for train/test split)
    for i in range(15):
        interaction_id = f"test_int_{i}"
        
        # We need a mix of Accepted and Rejected to train a binary classifier properly
        label = "Accepted" if i % 2 == 0 else "Rejected"
        
        feature_record = CreatorFeatureRecord(
            user_id="test_user",
            interaction_id=interaction_id,
            interaction_type="hook_generation",
            features={"prompt_length": 50 + i*10, "response_length": 150 - i*5, "hour_of_day": i % 24},
            created_at=datetime.now(timezone.utc)
        )
        
        label_record = TrainingLabel(
            user_id="test_user",
            interaction_id=interaction_id,
            label=label,
            reason="EXPLICIT_FEEDBACK",
            confidence_score=1.0
        )
        
        db.add(feature_record)
        db.add(label_record)
        
    db.commit()
    
    yield db
    
    # Cleanup DB
    db.query(TrainingLabel).delete()
    db.query(CreatorFeatureRecord).delete()
    db.commit()
    db.close()
    
@pytest.fixture(scope="module")
def setup_models_dir():
    # Clear out any test models before and after running
    if os.path.exists(MODELS_BASE_DIR):
        shutil.rmtree(MODELS_BASE_DIR)
        
    yield
    
    if os.path.exists(MODELS_BASE_DIR):
        shutil.rmtree(MODELS_BASE_DIR)

def test_model_training_and_saving(setup_database, setup_models_dir):
    """
    Tests that ModelTrainer correctly builds a dataset, trains, and saves metadata.
    """
    db = setup_database
    trainer = ModelTrainer(db)
    
    metadata = trainer.train()
    
    assert metadata["training_samples"] == 15
    assert "prompt_length" in metadata["features_used"]
    assert "accuracy" in metadata
    
    # Verify ModelManager created the files
    manager = ModelManager()
    latest_version = manager.get_latest_version()
    
    assert latest_version == "v1"
    
    model, loaded_meta = manager.load_latest_model()
    assert model is not None
    assert loaded_meta["model_version"] == "v1"

def test_predictor_inference(setup_database, setup_models_dir):
    """
    Tests that the Predictor can load the model and predict successfully.
    """
    predictor = Predictor()
    
    # Pass a sample feature vector
    features = {
        "prompt_length": 100,
        "response_length": 120,
        "hour_of_day": 14
    }
    
    probability = predictor.predict_acceptance(features)
    
    assert isinstance(probability, float)
    assert 0.0 <= probability <= 1.0

def test_model_rollback(setup_database, setup_models_dir):
    """
    Tests that training a second model increments version and rollback deletes it.
    """
    db = setup_database
    trainer = ModelTrainer(db)
    manager = ModelManager()
    
    # Train a second time
    trainer.train()
    
    assert manager.get_latest_version() == "v2"
    
    # Rollback
    new_version = manager.rollback()
    assert new_version == "v1"
    assert manager.get_latest_version() == "v1"
