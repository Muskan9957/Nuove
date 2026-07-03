from typing import List, Optional
from sqlalchemy.orm import Session
from app.db.models.training_label import TrainingLabel
from app.db.models.interaction import RawInteraction
from app.db.models.feature_record import CreatorFeatureRecord
from sqlalchemy import String

class SSLRepository:
    def __init__(self, db: Session):
        self.db = db
        
    def save_label(self, user_id: str, interaction_id: str, label: str, reason: str, confidence_score: float) -> TrainingLabel:
        """Saves or updates a training label."""
        existing = self.db.query(TrainingLabel).filter(TrainingLabel.interaction_id == interaction_id).first()
        
        if existing:
            existing.label = label
            existing.reason = reason
            existing.confidence_score = confidence_score
            label_record = existing
        else:
            label_record = TrainingLabel(
                user_id=user_id,
                interaction_id=interaction_id,
                label=label,
                reason=reason,
                confidence_score=confidence_score
            )
            self.db.add(label_record)
            
        self.db.commit()
        self.db.refresh(label_record)
        return label_record

    def get_labels_by_interaction(self, interaction_id: str) -> Optional[TrainingLabel]:
        return self.db.query(TrainingLabel).filter(TrainingLabel.interaction_id == interaction_id).first()

    def get_unlabeled_interactions(self, limit: int = 100) -> List[RawInteraction]:
        """
        Finds RawInteractions that have a CreatorFeatureRecord (meaning they have been processed for features)
        but DO NOT have a TrainingLabel yet.
        """
        # Subquery for interactions that are already labeled
        subquery_labels = self.db.query(TrainingLabel.interaction_id)
        
        # Subquery for interactions that have features extracted
        subquery_features = self.db.query(CreatorFeatureRecord.interaction_id)
        
        # We need RawInteractions where id is in features but not in labels
        return self.db.query(RawInteraction).filter(
            RawInteraction.id.in_(subquery_features),
            ~RawInteraction.id.in_(subquery_labels)
        ).limit(limit).all()
