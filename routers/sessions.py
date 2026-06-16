import json
import shutil
import uuid
from pathlib import Path
from fastapi import APIRouter, File, Form, UploadFile, Depends, HTTPException, BackgroundTasks
from supabase_client import get_supabase
from auth_middleware import get_current_user_id
from services.pipeline_service import run_async_pipeline

router = APIRouter(prefix="/api/sessions", tags=["sessions"])

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BASE_DIR / "output" / "uploads"

@router.post("/analyze")
async def analyze_audio(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    profession: str = Form("pt"),
    memo: str = Form(None),
    patient_id: str = Form(None),
    user_id: str = Depends(get_current_user_id)
):
    """
    오디오 파일을 업로드받아 백그라운드 분석 태스크를 시작하고, 세션 ID를 즉시 반환합니다.
    """
    supabase = get_supabase()
    
    # 1. 사용자의 Quota 확인 및 선차감 (낙관적 락을 통한 동시성 제어)
    max_retries = 3
    pre_deducted = False
    
    for attempt in range(max_retries):
        profile_res = supabase.table("profiles").select("quota_limit", "quota_used").eq("id", user_id).execute()
        if not profile_res.data:
            raise HTTPException(status_code=404, detail="User profile not found")
            
        profile = profile_res.data[0]
        quota_limit = profile.get("quota_limit", 10)
        current_used = profile.get("quota_used", 0)
        
        if quota_limit - current_used <= 0:
            raise HTTPException(
                status_code=403, 
                detail="사용 가능한 크레딧이 부족합니다. 구독 서비스 결제가 필요합니다."
            )
            
        # 낙관적 락(OCC): 읽은 시점의 quota_used가 다른 요청에 의해 변경되지 않은 경우에만 업데이트 수행
        update_res = supabase.table("profiles")\
            .update({"quota_used": current_used + 1})\
            .eq("id", user_id)\
            .eq("quota_used", current_used)\
            .execute()
            
        if update_res.data:
            pre_deducted = True
            print(f"[Credit] 선차감 성공. user_id: {user_id}, quota_used: {current_used} -> {current_used + 1}")
            break
            
    if not pre_deducted:
        raise HTTPException(
            status_code=409,
            detail="동시 요청이 감지되었습니다. 잠시 후 다시 시도해 주세요."
        )


    # 2. 오디오 파일 로컬 임시 저장 (ASCII 안전한 UUID 파일명 생성)
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    suffix = Path(file.filename).suffix
    temp_file_path = UPLOAD_DIR / f"{uuid.uuid4()}{suffix}"
    
    try:
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save uploaded file: {str(e)}")

    # 3. Supabase sessions 테이블에 'pending' 상태로 세션 삽입
    session_data = {
        "user_id": user_id,
        "patient_id": patient_id,
        "profession": profession,
        "patient_name": file.filename,
        "status": "pending",
        "memo": memo
    }
    
    try:
        session_res = supabase.table("sessions").insert(session_data).execute()
        if not session_res.data:
            raise ValueError("Failed to insert session row")
        session_id = session_res.data[0]["id"]
    except Exception as e:
        # 실패 시 임시 파일 삭제
        if temp_file_path.exists():
            temp_file_path.unlink()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    # 4. BackgroundTask로 비동기 파이프라인 연동
    background_tasks.add_task(
        run_async_pipeline,
        session_id=session_id,
        local_audio_path=str(temp_file_path),
        user_id=user_id,
        profession=profession,
        memo=memo
    )

    return {
        "status": "success",
        "message": "분석이 백그라운드에서 시작되었습니다.",
        "session_id": session_id
    }

@router.get("")
async def get_sessions(user_id: str = Depends(get_current_user_id)):
    """
    로그인한 사용자의 과거 분석 세션 이력 목록을 반환합니다.
    """
    supabase = get_supabase()
    try:
        res = supabase.table("sessions")\
            .select("id", "patient_name", "status", "profession", "created_at", "patient_id")\
            .eq("user_id", user_id)\
            .order("created_at", desc=True)\
            .execute()
        return res.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch sessions: {str(e)}")

@router.get("/{session_id}")
async def get_session_detail(session_id: str, user_id: str = Depends(get_current_user_id)):
    """
    특정 세션의 세부 정보 및 분석이 완료된 경우 결과(차트, 가이드, 녹취록)를 함께 반환합니다.
    """
    supabase = get_supabase()
    
    try:
        # 1. 세션 조회 및 소유권 확인
        session_res = supabase.table("sessions").select("*").eq("id", session_id).execute()
        if not session_res.data:
            raise HTTPException(status_code=404, detail="Session not found")
            
        session = session_res.data[0]
        if session["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Access denied to this session")

        response_data = {
            "id": session["id"],
            "patient_name": session["patient_name"],
            "status": session["status"],
            "profession": session["profession"],
            "audio_url": session["audio_url"],
            "memo": session["memo"],
            "created_at": session["created_at"],
            "results": None
        }

        # 2. 완료 상태인 경우 결과 조회
        if session["status"] == "completed":
            result_res = supabase.table("results").select("*").eq("session_id", session_id).execute()
            if result_res.data:
                r = result_res.data[0]
                # DB가 JSONB를 반환하면 그대로 가고, 텍스트 형태면 파싱
                chart_data = r.get("chart_data")
                if isinstance(chart_data, str):
                    try:
                        chart_data = json.loads(chart_data)
                    except Exception:
                        pass
                response_data["results"] = {
                    "raw_transcript": r.get("raw_transcript"),
                    "refined_transcript": r.get("refined_transcript"),
                    "chart_data": chart_data,
                    "guide_content": r.get("guide_content")
                }

        return response_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch session detail or invalid ID format: {str(e)}")
