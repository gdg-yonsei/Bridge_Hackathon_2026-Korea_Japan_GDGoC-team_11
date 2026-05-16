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
    # Gemini drives chatbot, emotion classification, period reports, and
    # therapist matching. Get a key at https://aistudio.google.com/apikey
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"

    # --- Spotify ---
    # Client Credentials Flow — no user OAuth required.
    # https://developer.spotify.com/dashboard → Create app → copy ID/secret.
    # Used to resolve Gemini-suggested songs to playable preview URLs and to
    # power the standalone GET /songs/search endpoint.
    spotify_client_id: str = ""
    spotify_client_secret: str = ""

    # --- CORS ---
    # Comma-separated list of allowed origins. "*" allows all (dev convenience).
    # Production: set to your frontend domain(s), e.g.
    #   CORS_ORIGINS=https://app.example.com,https://www.example.com
    cors_origins: str = "*"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
