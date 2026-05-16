from typing import TypedDict


class DiaryAnalysisState(TypedDict, total=False):
    """LangGraph Graph A (일기 분석) 상태.

    노드 흐름 (PLAN.md §4):
      load_entry → classify_emotion → summarize → recommend_songs → persist
    """

    entry_id: int
    content: str
    emotion: dict | None      # EmotionResult를 dict로 통과 (Pydantic 변환은 persist에서)
    summary: str | None
    songs: list[dict] | None  # [{title, artist, reason, ...}]
    error: str | None
