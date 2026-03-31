from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Server
    port: int = 8000
    env: str = "production"

    # Gemini
    gemini_api_key: str
    gemini_model: str = "gemini-2.0-flash"

    # Ollama (Evaluation provider)
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.2:3b"

    # OCR
    ocr_max_retries: int = 3
    ocr_retry_wait_seconds: int = 2

    # Evaluation
    eval_max_retries: int = 3
    eval_temperature: float = 0.1

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    return Settings()
