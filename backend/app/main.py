from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, chat, diary, festival, report, seoul_event

app = FastAPI(title="GDGoC Team 1 Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(chat.router, prefix="/chat", tags=["chat"])
app.include_router(diary.router, prefix="/diary", tags=["diary"])
app.include_router(report.router, prefix="/reports", tags=["reports"])

# 결정 대기 (PLAN.md §8 #1): 일기 도메인 확정 시 제거 예정
app.include_router(festival.router, prefix="/festivals", tags=["legacy"])
app.include_router(seoul_event.router, prefix="/seoul-events", tags=["legacy"])


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
