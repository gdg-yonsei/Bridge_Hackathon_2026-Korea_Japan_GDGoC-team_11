"""LangGraph 일기 분석 그래프 (Graph A).

PLAN.md §4 의 노드 순서:
  load_entry → classify_emotion → summarize → recommend_songs → persist

현재는 자리만 잡아둠. 실제 노드 구현은 vLLM 연동(결정 #2·#3) 후 진행.
그 전까지는 services/diary_service.py 의 stub 트리거가 placeholder 결과를 저장.
"""

from app.services.chat_service.types import DiaryAnalysisState


def build_graph() -> object:
    """LangGraph StateGraph 인스턴스를 만들어 반환. 미구현."""
    raise NotImplementedError(
        "vLLM 연동 후 langgraph.graph.StateGraph 로 노드 4개 연결 예정"
    )


# 노드 시그니처 자리 (구현 시 채울 것)
def load_entry(state: DiaryAnalysisState) -> DiaryAnalysisState: ...
def classify_emotion(state: DiaryAnalysisState) -> DiaryAnalysisState: ...
def summarize(state: DiaryAnalysisState) -> DiaryAnalysisState: ...
def recommend_songs(state: DiaryAnalysisState) -> DiaryAnalysisState: ...
def persist(state: DiaryAnalysisState) -> DiaryAnalysisState: ...
