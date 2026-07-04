from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Nuove Intelligence Engine (NIE)"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "nie_db"
    
    # SSL Labeling Thresholds
    HIGH_SIMILARITY_THRESHOLD: float = 0.80
    LOW_SIMILARITY_THRESHOLD: float = 0.40
    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        # Using sqlite for easy manual testing on the local machine
        return "sqlite:///./nie.db"

    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()
