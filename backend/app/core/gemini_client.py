"""Gemini API client factory + resilient call helper.

Used for emotion classification, period report generation, the Solis chatbot,
therapist matching, and song recommendation. Uses the google-genai SDK (Google
AI Studio key, not Vertex AI). Supports structured output via `response_schema`
for direct Pydantic decoding.

Two resilience layers
---------------------
1. **Key rotation**: if `GEMINI_API_KEYS` is set (comma-separated), every
   `get_gemini_client()` call returns a client backed by the *next* key in
   round-robin order. Combined with `GEMINI_API_KEY` (always first), the pool
   multiplies free-tier RPM/RPD across the available keys.
2. **Model fallback**: `generate_with_fallback(...)` tries the primary
   `gemini_model` first; on `429 RESOURCE_EXHAUSTED` it retries the same
   call against `gemini_fallback_model` (default `gemini-1.5-flash`, which
   has a much more generous free tier). The fallback also picks the next
   key from the rotation pool, so we get a fresh key *and* a different
   model in one swap.

Single-key, single-model mode (legacy `GEMINI_API_KEY` only, no fallback)
still works — just leave the new env vars unset.
"""

from __future__ import annotations

import logging
from functools import lru_cache
from threading import Lock
from typing import Any

from google import genai
from google.genai import errors

from app.core.config import settings

logger = logging.getLogger(__name__)

_lock = Lock()
_counter = 0


@lru_cache(maxsize=16)
def _client_for_key(api_key: str) -> genai.Client:
    return genai.Client(api_key=api_key)


def get_gemini_client() -> genai.Client:
    """Return a Gemini client backed by the next key in the round-robin pool."""
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


def _is_quota_error(exc: Exception) -> bool:
    """True when Gemini rejected the request due to RPM/RPD exhaustion.

    The SDK raises `errors.ClientError` for 4xx; status_code surfaces on it.
    We also fall back to a substring check on the message so the helper keeps
    working if google-genai changes the exception shape across versions.
    """
    if isinstance(exc, errors.ClientError) and getattr(exc, "status_code", None) == 429:
        return True
    return "RESOURCE_EXHAUSTED" in str(exc)


def generate_with_fallback(*, contents: Any, config: Any) -> Any:
    """Call Gemini, falling back to the fallback model on a quota error.

    The fallback call uses a fresh key from the rotation pool, so we swap
    *both* the model and the key in one retry.
    """
    primary = settings.gemini_model
    fallback = settings.gemini_fallback_model

    client = get_gemini_client()
    try:
        return client.models.generate_content(model=primary, contents=contents, config=config)
    except Exception as exc:
        if not (_is_quota_error(exc) and fallback and fallback != primary):
            raise
        logger.warning(
            "Gemini quota exhausted on %s — falling back to %s for this call",
            primary,
            fallback,
        )
        return get_gemini_client().models.generate_content(
            model=fallback, contents=contents, config=config
        )
