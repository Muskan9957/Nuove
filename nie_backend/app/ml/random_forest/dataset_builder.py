import pandas as pd
from sqlalchemy.orm import Session
from app.db.models.feature_record import CreatorFeatureRecord
from app.db.models.training_label import TrainingLabel

class DatasetBuilder:
    """
    Builds the training dataset by joining CreatorFeatureRecord (X) with TrainingLabel (y).
    Filters out Neutral and No Label interactions.
    """
    
    def __init__(self, db: Session):
        self.db = db
        
    def build_dataset(self) -> tuple[pd.DataFrame, pd.Series]:
        """
        Retrieves joined data and returns X (features) and y (target labels).
        Returns empty dataframe and series if no valid data exists.
        """
        # Join CreatorFeatureRecord and TrainingLabel on interaction_id
        # We only want rows where label is 'Accepted' or 'Rejected'
        query = (
            self.db.query(CreatorFeatureRecord, TrainingLabel)
            .join(TrainingLabel, CreatorFeatureRecord.interaction_id == TrainingLabel.interaction_id)
            .filter(TrainingLabel.label.in_(["Accepted", "Rejected"]))
        )
        
        results = query.all()
        
        if not results:
            return pd.DataFrame(), pd.Series(dtype=int)
            
        data = []
        for feature_record, label_record in results:
            features = feature_record.features
            
            # Map labels to binary
            target = 1 if label_record.label == "Accepted" else 0
            
            # Flatten features into a single dictionary
            row = {
                "interaction_id": feature_record.interaction_id,
                "target": target
            }
            row.update(features)
            data.append(row)
            
        df = pd.DataFrame(data)
        
        # Ensure we drop NaNs if any structural features are missing unexpectedly
        # (Though we shouldn't have any if the pipeline is strict)
        df = df.dropna()
        
        if df.empty:
            return pd.DataFrame(), pd.Series(dtype=int)
        
        # Separate X and y
        y = df["target"]
        
        # X is everything except interaction_id and target
        X = df.drop(columns=["interaction_id", "target"])
        
        # Categorical handling: 
        # Convert any string columns to dummies if they exist (e.g., niche). 
        # Right now we are focusing on structural features like prompt_length, response_length, hour_of_day.
        X = pd.get_dummies(X, drop_first=True)
        
        return X, y
