from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.interaction import InteractionRequest, InteractionResponse
from app.services.interaction_processing_service import InteractionProcessingService

router = APIRouter()

@router.post("/", response_model=InteractionResponse, status_code=201)
def process_interaction(request: InteractionRequest, db: Session = Depends(get_db)):
    service = InteractionProcessingService(db)
    return service.process_interaction(request)
