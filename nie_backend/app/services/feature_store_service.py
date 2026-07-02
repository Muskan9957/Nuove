from sqlalchemy.orm import Session
from typing import List, Dict, Any
from app.repositories.feature_store_repo import FeatureStoreRepository
from app.db.models.feature_record import CreatorFeatureRecord
from app.schemas.feature_vector import FeatureVector
from app.schemas.feature_store import FeatureRecordResponse
import datetime

class FeatureStoreService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = FeatureStoreRepository(db)
        self.version = 1
        self.source_module = "feature_extraction_v1"

    def _prepare_record(self, vector: FeatureVector) -> CreatorFeatureRecord:
        vector_dict = vector.model_dump()
        
        # Extract relational keys
        interaction_id = vector_dict.pop("interaction_id")
        user_id = vector_dict.pop("user_id")
        interaction_type = vector_dict.pop("interaction_type")
        created_at = vector_dict.pop("created_at")
        
        # The remaining dict is purely math features
        return CreatorFeatureRecord(
            user_id=user_id,
            interaction_id=interaction_id,
            interaction_type=interaction_type,
            feature_version=self.version,
            source_module=self.source_module,
            features=vector_dict,
            created_at=created_at
        )

    def store_vector(self, vector: FeatureVector) -> CreatorFeatureRecord:
        record = self._prepare_record(vector)
        return self.repo.save_feature_vector(record)

    def store_vectors(self, vectors: List[FeatureVector]) -> None:
        records = [self._prepare_record(v) for v in vectors]
        self.repo.save_feature_vectors_batch(records)

    def retrieve_by_user_id(self, user_id: str, limit: int = 100, offset: int = 0) -> List[FeatureRecordResponse]:
        records = self.repo.get_by_user_id(user_id, limit, offset)
        return [FeatureRecordResponse.model_validate(r) for r in records]

    def retrieve_by_type(self, interaction_type: str, limit: int = 100, offset: int = 0) -> List[FeatureRecordResponse]:
        records = self.repo.get_by_type(interaction_type, limit, offset)
        return [FeatureRecordResponse.model_validate(r) for r in records]

    def retrieve_by_date_range(self, user_id: str, start_date: datetime.datetime, end_date: datetime.datetime) -> List[FeatureRecordResponse]:
        records = self.repo.get_by_date_range(user_id, start_date, end_date)
        return [FeatureRecordResponse.model_validate(r) for r in records]
