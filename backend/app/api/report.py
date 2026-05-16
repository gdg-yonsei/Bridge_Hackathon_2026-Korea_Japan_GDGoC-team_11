from fastapi import APIRouter

router = APIRouter()


@router.get("/weekly")
async def get_weekly_report(week: str) -> dict:
    """주간 리포트 조회. 없으면 생성. `week` 포맷: '2026-W20'."""
    raise NotImplementedError
