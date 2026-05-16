"""vLLM (OpenAI-compatible) client factory.

vLLM exposes an OpenAI-compatible endpoint when started with `vllm serve --model ...`,
so we reuse the OpenAI SDK and only swap the base_url. Model is set via settings.vllm_model.
"""

from functools import lru_cache

from openai import OpenAI

from app.core.config import settings


@lru_cache(maxsize=1)
def get_llm_client() -> OpenAI:
    return OpenAI(
        base_url=settings.vllm_base_url,
        api_key=settings.vllm_api_key or "EMPTY",  # vLLM does not validate the key
    )
