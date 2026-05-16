from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg2://app:app@db:5432/app"
    secret_key: str = "change-me"

    # vLLM (OpenAI 호환). vLLM 미가동 시에도 모듈 import는 가능해야 하므로 기본값 둠.
    vllm_base_url: str = "http://vllm:8000/v1"
    vllm_api_key: str = ""
    vllm_model: str = "Qwen/Qwen2.5-7B-Instruct"

    openai_api_key: str = ""   # 폴백 용도 (vLLM 대신 OpenAI 쓸 때)


settings = Settings()
