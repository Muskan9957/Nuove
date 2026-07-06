from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.ml.random_forest.model_trainer import ModelTrainer
from app.ml.random_forest.model_manager import ModelManager

router = APIRouter()
model_manager = ModelManager()

def train_background_task(db: Session):
    trainer = ModelTrainer(db)
    try:
        trainer.train()
    except Exception as e:
        # In a production setting, this should log to an APM tool (e.g. Sentry)
        print(f"Training failed: {e}")

@router.post("/start")
def start_training(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """
    Manually triggers the Random Forest retraining pipeline in the background.
    """
    background_tasks.add_task(train_background_task, db)
    return {"message": "Random Forest training started in the background."}

@router.get("/status")
def get_model_status():
    """
    Returns the metadata of the currently active model.
    """
    _, metadata = model_manager.load_latest_model()
    if not metadata:
        return {"status": "no_model_available"}
        
    return {
        "status": "ready",
        "active_version": metadata.get("model_version"),
        "metadata": metadata
    }

@router.post("/rollback")
def rollback_model():
    """
    Rolls back to the previous model version by removing the latest one.
    """
    new_version = model_manager.rollback()
    if new_version:
        return {"message": f"Rolled back. Active version is now {new_version}."}
    else:
        return {"message": "Rollback completed, but no models are left."}
