from datetime import date

from fastapi import APIRouter, status

router = APIRouter()


@router.post("", status_code=status.HTTP_202_ACCEPTED)
async def create_diary(payload: dict) -> dict:
    """일기 작성 → 즉시 202 반환, LangGraph 분석은 백그라운드 실행."""
    raise NotImplementedError


@router.get("")
async def list_diary(year: int, month: int) -> list[dict]:
    """캘린더용 월간 리스트: [{date, primary_emotion, status}, ...]."""
    raise NotImplementedError


@router.get("/{entry_id}")
async def get_diary(entry_id: int) -> dict:
    """단건 조회 (감정·요약·노래 포함)."""
    raise NotImplementedError


@router.put("/{entry_id}")
async def update_diary(entry_id: int, payload: dict) -> dict:
    """본문 수정. 재분석 정책은 결정 후 구현."""
    raise NotImplementedError


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_diary(entry_id: int) -> None:
    raise NotImplementedError


@router.post("/{entry_id}/reanalyze", status_code=status.HTTP_202_ACCEPTED)
async def reanalyze_diary(entry_id: int) -> dict:
    """실패/수동 재분석."""
    raise NotImplementedError
