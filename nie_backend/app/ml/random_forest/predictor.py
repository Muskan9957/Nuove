import pandas as pd
from app.ml.random_forest.model_manager import ModelManager

class Predictor:
    """
    Internal component to run inferences through the active Random Forest model.
    """
    def __init__(self):
        self.model_manager = ModelManager()
        # Cache the model to avoid disk I/O on every request
        self.model, self.metadata = self.model_manager.load_latest_model()
        
    def reload_model(self):
        """Forces a reload of the model from disk. Useful after retraining."""
        self.model, self.metadata = self.model_manager.load_latest_model()
        
    def predict_acceptance(self, features: dict) -> float:
        """
        Takes a raw feature dictionary, processes it according to the model's expected features,
        and returns the probability of acceptance.
        """
        if self.model is None or self.metadata is None:
            # If no model exists yet, we return a neutral default score or raise an exception
            # For robustness, returning a 0.5 probability might be best, but let's raise
            # so the caller knows the model isn't ready.
            raise RuntimeError("Random Forest model is not initialized or trained yet.")
            
        # The model expects a specific list of features in a specific order
        expected_features = self.metadata.get("features_used", [])
        
        # Build the feature vector
        # Any missing expected features will default to 0
        vector = {f: features.get(f, 0) for f in expected_features}
        
        # Convert to Pandas DataFrame for prediction (model expects 2D array-like)
        X = pd.DataFrame([vector])
        
        # predict_proba returns array of probabilities for [class_0, class_1]
        # class_1 is "Accepted"
        probs = self.model.predict_proba(X)
        
        if len(probs[0]) > 1:
            return float(probs[0][1])
        else:
            # Fallback if model was trained on only one class (e.g., all 1s or all 0s)
            return float(self.model.classes_[0])
