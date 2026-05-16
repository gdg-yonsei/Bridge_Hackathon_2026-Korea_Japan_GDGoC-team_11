"""vLLM (OpenAI 호환) 클라이언트 팩토리.

vLLM은 `vllm serve --model ...` 로 띄우면 OpenAI 호환 엔드포인트가 생기므로
OpenAI SDK 를 그대로 쓰고 base_url 만 교체한다. 모델은 settings.vllm_model.
"""

from functools import lru_cache

from openai import OpenAI

from app.core.config import settings


@lru_cache(maxsize=1)
def get_llm_client() -> OpenAI:
    return OpenAI(
        base_url=settings.vllm_base_url,
        api_key=settings.vllm_api_key or "EMPTY",  # vLLM은 키 검증 안 함
    )
