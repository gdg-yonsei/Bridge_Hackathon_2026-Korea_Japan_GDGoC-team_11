from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- Supabase ---
    # Copy from Supabase Dashboard → Settings → API:
    #   - supabase_url:              Project URL (https://<ref>.supabase.co)
    #   - supabase_anon_key:         anon public key (used by frontend; backend rarely needs it)
    #   - supabase_service_role_key: service_role key (backend admin ops only — never expose)
    #   - supabase_jwt_secret:       JWT secret (backend uses this to verify user tokens)
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = ""

    # Supabase → Database → Connection string → URI
    # e.g. postgresql+psycopg2://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:6543/postgres
    database_url: str = ""

    # --- LLM ---
    # vLLM (CBT-Copilot). OpenAI-compatible endpoint.
    vllm_base_url: str = "http://vllm:8000/v1"
    vllm_api_key: str = "EMPTY"
    vllm_model: str = "thillaic/CBT-Copilot"

    # Gemini (emotion analysis + period reports)
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"


settings = Settings()
