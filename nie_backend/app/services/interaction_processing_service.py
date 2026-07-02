from sqlalchemy.orm import Session
from app.schemas.interaction import InteractionRequest, InteractionResponse
from app.repositories.interaction_repo import InteractionRepository
from app.services.feature_extraction_service import FeatureExtractionService
from app.services.feature_store_service import FeatureStoreService

class InteractionProcessingService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = InteractionRepository(db)
        self.feature_store_service = FeatureStoreService(db)

    def process_interaction(self, request: InteractionRequest) -> InteractionResponse:
        # 1. Store raw interaction
        raw_interaction = self.repo.create_interaction(request)
        
        # 2. Extract features
        feature_vector = FeatureExtractionService.extract_features(
            request=request, 
            interaction_id=str(raw_interaction.id),
            created_at=raw_interaction.created_at
        )
        
        # 3. Store in Feature Store
        self.feature_store_service.store_vector(feature_vector)
        
        # 4. Return success response
        return InteractionResponse(
            status="success",
            interaction_id=str(raw_interaction.id),
            message="Interaction processed successfully"
        )
