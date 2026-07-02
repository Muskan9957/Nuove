from sqlalchemy.orm import Session
from app.db.models.interaction import RawInteraction
from app.schemas.interaction import InteractionRequest

class InteractionRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_interaction(self, request: InteractionRequest) -> RawInteraction:
        db_obj = RawInteraction(
            user_id=request.user_id,
            interaction_type=request.interaction_type,
            prompt=request.prompt,
            ai_response=request.ai_response,
            edited_response=request.edited_response,
            feedback=request.feedback,
            metadata_=request.metadata
        )
        self.db.add(db_obj)
        self.db.commit()
        self.db.refresh(db_obj)
        return db_obj
