"""LangGraph diary analysis graph (Graph A) — placeholder stubs.

Node order (PLAN.md §4):
  load_entry → classify_emotion → summarize → recommend_songs → persist

Not yet implemented. Emotion classification is currently handled directly
in services/diary_analysis_service.py via Gemini.
"""

from app.services.chat_service.types import DiaryAnalysisState


def build_graph() -> object:
    raise NotImplementedError(
        "Connect four StateGraph nodes via langgraph.graph.StateGraph when ready."
    )


def load_entry(state: DiaryAnalysisState) -> DiaryAnalysisState: ...
def classify_emotion(state: DiaryAnalysisState) -> DiaryAnalysisState: ...
def summarize(state: DiaryAnalysisState) -> DiaryAnalysisState: ...
def recommend_songs(state: DiaryAnalysisState) -> DiaryAnalysisState: ...
def persist(state: DiaryAnalysisState) -> DiaryAnalysisState: ...
