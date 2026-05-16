"""Gemini API client factory.

Used for emotion classification and period report generation.
Uses the google-genai SDK (Google AI Studio key, not Vertex AI).
Supports structured output via `response_schema` for direct Pydantic decoding.
"""

from functools import lru_cache

from google import genai

from app.core.config import settings


@lru_cache(maxsize=1)
def get_gemini_client() -> genai.Client:
    if not settings.gemini_api_key:
        raise RuntimeError(
            "GEMINI_API_KEY is empty. Get a key at https://aistudio.google.com/apikey"
        )
    return genai.Client(api_key=settings.gemini_api_key)
