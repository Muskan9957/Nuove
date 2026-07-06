import os
import json
import joblib
from datetime import datetime, timezone
import shutil
import sklearn

# The base directory for models
MODELS_BASE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "models", "random_forest")

class ModelManager:
    """
    Handles saving, loading, versioning, and rollback of Random Forest models.
    """
    
    def __init__(self, base_dir: str = MODELS_BASE_DIR):
        self.base_dir = base_dir
        os.makedirs(self.base_dir, exist_ok=True)
        
    def _get_next_version(self) -> str:
        """Determines the next version string based on existing directories."""
        existing_versions = []
        for item in os.listdir(self.base_dir):
            if item.startswith("v") and item[1:].isdigit():
                existing_versions.append(int(item[1:]))
                
        next_v = max(existing_versions) + 1 if existing_versions else 1
        return f"v{next_v}"
        
    def get_latest_version(self) -> str | None:
        """Returns the latest version string (e.g., 'v2'), or None if no models exist."""
        existing_versions = []
        for item in os.listdir(self.base_dir):
            if item.startswith("v") and item[1:].isdigit():
                existing_versions.append(int(item[1:]))
                
        if not existing_versions:
            return None
            
        latest_v = max(existing_versions)
        return f"v{latest_v}"

    def save_model(self, model, metadata: dict) -> str:
        """
        Saves a trained model and its metadata into a new versioned directory.
        """
        version = self._get_next_version()
        version_dir = os.path.join(self.base_dir, version)
        os.makedirs(version_dir, exist_ok=True)
        
        # Save the joblib model
        model_path = os.path.join(version_dir, "model.joblib")
        joblib.dump(model, model_path)
        
        # Ensure metadata contains required fields
        full_metadata = {
            "model_version": version,
            "algorithm": "RandomForestClassifier",
            "sklearn_version": sklearn.__version__,
            "training_samples": metadata.get("training_samples", 0),
            "features_used": metadata.get("features_used", []),
            "accuracy": metadata.get("accuracy", 0.0),
            "precision": metadata.get("precision", 0.0),
            "recall": metadata.get("recall", 0.0),
            "auc": metadata.get("auc", 0.0),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Save metadata
        metadata_path = os.path.join(version_dir, "metadata.json")
        with open(metadata_path, "w") as f:
            json.dump(full_metadata, f, indent=4)
            
        return version

    def load_latest_model(self):
        """
        Loads the model from the latest version directory.
        Returns a tuple of (model, metadata) or (None, None) if none exists.
        """
        latest_version = self.get_latest_version()
        if not latest_version:
            return None, None
            
        return self.load_model_version(latest_version)
        
    def load_model_version(self, version: str):
        """
        Loads a specific model version.
        """
        version_dir = os.path.join(self.base_dir, version)
        model_path = os.path.join(version_dir, "model.joblib")
        metadata_path = os.path.join(version_dir, "metadata.json")
        
        if not os.path.exists(model_path) or not os.path.exists(metadata_path):
            raise FileNotFoundError(f"Model version {version} not found.")
            
        model = joblib.load(model_path)
        with open(metadata_path, "r") as f:
            metadata = json.load(f)
            
        return model, metadata

    def rollback(self) -> str | None:
        """
        Rolls back to the previous model version by deleting the latest version.
        Returns the new 'latest' version string.
        """
        latest_version = self.get_latest_version()
        if not latest_version:
            return None
            
        latest_dir = os.path.join(self.base_dir, latest_version)
        shutil.rmtree(latest_dir)
        
        return self.get_latest_version()
