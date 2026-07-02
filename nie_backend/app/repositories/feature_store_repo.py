from sqlalchemy.orm import Session
from typing import List, Optional
import datetime
from app.db.models.feature_record import CreatorFeatureRecord

class FeatureStoreRepository:
    def __init__(self, db: Session):
        self.db = db

    def save_feature_vector(self, record: CreatorFeatureRecord) -> CreatorFeatureRecord:
        self.db.add(record)
        self.db.commit()
        self.db.refresh(record)
        return record

    def save_feature_vectors_batch(self, records: List[CreatorFeatureRecord]) -> None:
        self.db.add_all(records)
        self.db.commit()

    def get_by_interaction_id(self, interaction_id: str) -> Optional[CreatorFeatureRecord]:
        return self.db.query(CreatorFeatureRecord).filter(CreatorFeatureRecord.interaction_id == interaction_id).first()

    def get_by_user_id(self, user_id: str, limit: int = 100, offset: int = 0) -> List[CreatorFeatureRecord]:
        return self.db.query(CreatorFeatureRecord).filter(CreatorFeatureRecord.user_id == user_id).order_by(CreatorFeatureRecord.created_at.desc()).offset(offset).limit(limit).all()

    def get_by_type(self, interaction_type: str, limit: int = 100, offset: int = 0) -> List[CreatorFeatureRecord]:
        return self.db.query(CreatorFeatureRecord).filter(CreatorFeatureRecord.interaction_type == interaction_type).order_by(CreatorFeatureRecord.created_at.desc()).offset(offset).limit(limit).all()

    def get_by_date_range(self, user_id: str, start_date: datetime.datetime, end_date: datetime.datetime) -> List[CreatorFeatureRecord]:
        return self.db.query(CreatorFeatureRecord).filter(
            CreatorFeatureRecord.user_id == user_id,
            CreatorFeatureRecord.created_at >= start_date,
            CreatorFeatureRecord.created_at <= end_date
        ).order_by(CreatorFeatureRecord.created_at.desc()).all()
