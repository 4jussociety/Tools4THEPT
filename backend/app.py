import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

# 라우터 임포트
from routers import sessions, profile, patients

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
app.include_router(patients.router)

from fastapi import BackgroundTasks, Request, Depends, HTTPException
from auth_middleware import get_current_user_id
from services.pipeline_service import run_local_edge_mimic_pipeline
from supabase_client import get_supabase

@app.post("/api/functions/analyze")
async def local_edge_analyze(
    request: Request,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id)
):
    """
    Supabase Edge Function 'analyze'를 로컬에서 모사하는 백엔드 API 엔드포인트입니다.
    """
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="Missing session_id")
        
    supabase = get_supabase()
    
    # 1. 세션 확인
    session_res = supabase.table("sessions").select("*").eq("id", session_id).execute()
    if not session_res.data:
        raise HTTPException(status_code=404, detail="Session not found")
    session = session_res.data[0]
    if session["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
        
    # 2. Quota 확인 및 선차감
    profile_res = supabase.table("profiles").select("quota_limit", "quota_used").eq("id", user_id).execute()
    if not profile_res.data:
        raise HTTPException(status_code=404, detail="User profile not found")
        
    profile = profile_res.data[0]
    if profile["quota_limit"] - profile["quota_used"] <= 0:
        raise HTTPException(status_code=403, detail="사용 가능한 크레딧이 부족합니다. 구독 서비스 결제가 필요합니다.")
        
    # quota_used 1 증가
    supabase.table("profiles").update({"quota_used": profile["quota_used"] + 1}).eq("id", user_id).execute()

    # 3. 백그라운드 태스크 실행 (로컬 에지 파이프라인 모사)
    background_tasks.add_task(
        run_local_edge_mimic_pipeline,
        session_id=session_id,
        user_id=user_id,
        profession=session["profession"],
        memo=session.get("memo")
    )
    
    return {
        "status": "success",
        "message": "분석이 로컬 에지 모사 파이프라인에서 시작되었습니다.",
        "session_id": session_id
    }

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
