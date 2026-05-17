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
    #
    # Effective key pool = GEMINI_API_KEY (1) + GEMINI_API_KEYS (n), deduped.
    # Each Gemini call round-robins across the pool, multiplying free-tier
    # RPM/RPD by the pool size. Either var alone is fine; together is fine.
    gemini_api_key: str = ""
    gemini_api_keys: str = ""
    gemini_model: str = "gemini-2.5-flash"
    # On 429 RESOURCE_EXHAUSTED from the primary model, the same call is
    # retried once against this fallback. 1.5-flash has a much more generous
    # free-tier RPD (1500/day vs 2.5-flash's 20/day) so it almost always
    # absorbs the burst. Set to empty string to disable fallback.
    gemini_fallback_model: str = "gemini-1.5-flash"

    @property
    def gemini_api_key_list(self) -> list[str]:
        """Effective key pool — `GEMINI_API_KEY` first (legacy/primary), then
        anything in the comma-separated `GEMINI_API_KEYS`. Whitespace stripped,
        empty entries dropped, duplicates removed while preserving order."""
        candidates: list[str] = []
        if self.gemini_api_key:
            candidates.append(self.gemini_api_key.strip())
        if self.gemini_api_keys:
            candidates.extend(k.strip() for k in self.gemini_api_keys.split(",") if k.strip())
        seen: set[str] = set()
        ordered: list[str] = []
        for key in candidates:
            if key and key not in seen:
                seen.add(key)
                ordered.append(key)
        return ordered

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
