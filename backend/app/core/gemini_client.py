"""Gemini API client factory.

Used for emotion classification, period report generation, the Solis chatbot,
therapist matching, and song recommendation. Uses the google-genai SDK (Google
AI Studio key, not Vertex AI). Supports structured output via `response_schema`
for direct Pydantic decoding.

Key rotation
------------
If `GEMINI_API_KEYS` is set (comma-separated), every `get_gemini_client()` call
returns a client backed by the *next* key in round-robin order. Each request
to Gemini therefore uses a different key — free-tier RPM/RPD limits effectively
multiply by the pool size. Per-key clients are cached so we don't rebuild the
underlying httpx session on every call.

Single-key mode (`GEMINI_API_KEY` only) is unchanged: always the same client.
"""

from functools import lru_cache
from threading import Lock

from google import genai

from app.core.config import settings

_lock = Lock()
_counter = 0


@lru_cache(maxsize=16)
def _client_for_key(api_key: str) -> genai.Client:
    return genai.Client(api_key=api_key)


def get_gemini_client() -> genai.Client:
    keys = settings.gemini_api_key_list
    if not keys:
        raise RuntimeError(
            "GEMINI_API_KEY(S) is empty. Get a key at https://aistudio.google.com/apikey"
        )
    if len(keys) == 1:
        return _client_for_key(keys[0])

    global _counter
    with _lock:
        idx = _counter % len(keys)
        _counter += 1
    return _client_for_key(keys[idx])
