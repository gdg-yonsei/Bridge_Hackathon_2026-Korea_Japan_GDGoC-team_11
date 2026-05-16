"""Gemini API 클라이언트 팩토리.

주간/기간 리포트 생성에 사용. google-genai SDK 사용 — Vertex 아님, Google AI Studio 키.
구조화 출력(`response_schema`) 지원하므로 ReportLLMResult Pydantic 으로 직접 디코딩 가능.
"""

from functools import lru_cache

from google import genai

from app.core.config import settings


@lru_cache(maxsize=1)
def get_gemini_client() -> genai.Client:
    if not settings.gemini_api_key:
        raise RuntimeError(
            "GEMINI_API_KEY is empty. 발급: https://aistudio.google.com/apikey"
        )
    return genai.Client(api_key=settings.gemini_api_key)
