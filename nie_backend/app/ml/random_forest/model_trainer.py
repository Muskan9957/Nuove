from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
import pandas as pd
from sqlalchemy.orm import Session
import logging

from app.ml.random_forest.dataset_builder import DatasetBuilder
from app.ml.random_forest.model_manager import ModelManager
from app.ml.random_forest.metrics import calculate_metrics

logger = logging.getLogger(__name__)

class ModelTrainer:
    """
    Orchestrates the training of the Random Forest model.
    """
    def __init__(self, db: Session):
        self.db = db
        self.dataset_builder = DatasetBuilder(db)
        self.model_manager = ModelManager()
        
    def train(self) -> dict:
        """
        Retrieves data, trains the Random Forest classifier, and saves it.
        Returns the metadata dictionary.
        """
        logger.info("Starting Random Forest training pipeline...")
        
        # 1. Build Dataset
        X, y = self.dataset_builder.build_dataset()
        
        if len(X) < 10:
            raise ValueError("Insufficient data to train model. Need at least 10 samples.")
            
        logger.info(f"Dataset built with {len(X)} samples and {len(X.columns)} features.")
        
        # 2. Split Data
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y if y.nunique() > 1 else None)
        
        # 3. Train Model
        # Using standard parameters for V1. We can tune these later.
        model = RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42)
        model.fit(X_train, y_train)
        
        # 4. Evaluate Model
        y_pred = model.predict(X_test)
        y_prob = model.predict_proba(X_test)[:, 1] if len(model.classes_) > 1 else [0]*len(y_test)
        
        metrics = calculate_metrics(y_test, pd.Series(y_pred), pd.Series(y_prob))
        
        # 5. Save Model and Metadata
        metadata = {
            "training_samples": len(X),
            "features_used": list(X.columns),
            "accuracy": metrics["accuracy"],
            "precision": metrics["precision"],
            "recall": metrics["recall"],
            "auc": metrics["auc"]
        }
        
        version = self.model_manager.save_model(model, metadata)
        logger.info(f"Model {version} saved successfully with AUC: {metrics['auc']:.4f}")
        
        return metadata
