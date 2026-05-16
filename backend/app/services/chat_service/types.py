from typing import TypedDict


class DiaryAnalysisState(TypedDict, total=False):
    """LangGraph Graph A state for diary analysis.

    Node flow (PLAN.md §4):
      load_entry → classify_emotion → summarize → recommend_songs → persist
    """

    entry_id: int
    content: str
    emotion: dict | None      # EmotionResult passed as dict; Pydantic conversion happens in persist
    summary: str | None
    songs: list[dict] | None  # [{title, artist, reason, ...}]
    error: str | None
