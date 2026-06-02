import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

# 라우터 임포트
from routers import sessions, profile

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

app = FastAPI(title="재활치료 AI 차팅 SaaS 솔루션 API")

# CORS 미들웨어 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 실무에서는 특정 도메인만 허용하도록 변경 권장
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 정적 파일 서빙 디렉토리 설정 (절대 경로 사용)
STATIC_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# 라우터 마운트
app.include_router(sessions.router)
app.include_router(profile.router)

@app.get("/")
async def read_index():
    index_path = STATIC_DIR / "index.html"
    return FileResponse(str(index_path))

@app.get("/api/config")
async def get_config():
    """
    프론트엔드에서 Supabase Client를 동적으로 초기화할 수 있도록 환경변수를 반환합니다.
    """
    return {
        "supabase_url": os.getenv("SUPABASE_URL", ""),
        "supabase_anon_key": os.getenv("SUPABASE_ANON_KEY", "")
    }
