from typing import Optional
from sqlalchemy.orm import Session
from app.ml.semi_supervised.label_generator import LabelGenerator
from app.repositories.ssl_repo import SSLRepository
from app.db.models.training_label import TrainingLabel

class SSLService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = SSLRepository(db)
        self.label_generator = LabelGenerator()
        
    def process_interaction(
        self, 
        user_id: str, 
        interaction_id: str, 
        interaction_type: str, 
        prompt: Optional[str], 
        ai_response: Optional[str], 
        edited_response: Optional[str], 
        feedback: Optional[int]
    ) -> TrainingLabel:
        """
        Takes interaction data, passes it through the LabelGenerator, 
        and persists the resulting training label to the database.
        """
        generated_label = self.label_generator.generate(
            interaction_type=interaction_type,
            prompt=prompt,
            ai_response=ai_response,
            edited_response=edited_response,
            feedback=feedback
        )
        
        saved_label = self.repo.save_label(
            user_id=user_id,
            interaction_id=interaction_id,
            label=generated_label.label,
            reason=generated_label.reason,
            confidence_score=generated_label.confidence_score
        )
        
        return saved_label

    def process_unlabeled_batch(self, limit: int = 100) -> int:
        """
        Retrieves unlabeled feature vectors, passes them through LabelGenerator,
        and persists the generated labels in batch.
        Returns the number of labels generated.
        """
        unlabeled = self.repo.get_unlabeled_interactions(limit=limit)
        count = 0
        
        for raw in unlabeled:
            self.process_interaction(
                user_id=raw.user_id,
                interaction_id=str(raw.id),
                interaction_type=raw.interaction_type,
                prompt=raw.prompt,
                ai_response=raw.ai_response,
                edited_response=raw.edited_response,
                feedback=raw.feedback
            )
            count += 1
            
        return count
