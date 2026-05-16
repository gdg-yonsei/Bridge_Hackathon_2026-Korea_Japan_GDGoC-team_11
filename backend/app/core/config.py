from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg2://app:app@db:5432/app"
    secret_key: str = "change-me"
    openai_api_key: str = ""
    seoul_api_key: str = ""


settings = Settings()
