from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- Supabase ---
    # Settings → API 에서 복사:
    #   - supabase_url:           Project URL (https://<ref>.supabase.co)
    #   - supabase_anon_key:      anon public key (프론트가 씀, 백엔드는 일반적으로 미사용)
    #   - supabase_service_role_key: service_role key (백엔드 admin 작업 시. 노출 금지)
    #   - supabase_jwt_secret:    JWT secret (백엔드가 사용자 토큰 검증할 때 사용)
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = ""

    # Supabase → Database → Connection string → URI (Transaction or Session pooler 권장)
    # 예: postgresql+psycopg2://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:6543/postgres
    database_url: str = ""

    # --- LLM ---
    # vLLM (CBT-Copilot 등). OpenAI 호환 엔드포인트.
    vllm_base_url: str = "http://vllm:8000/v1"
    vllm_api_key: str = "EMPTY"
    vllm_model: str = "thillaic/CBT-Copilot"

    # Gemini (주간 리포트용)
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"


settings = Settings()
