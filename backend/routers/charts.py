import os
from fastapi import APIRouter, Depends, HTTPException
from supabase_client import get_supabase
from auth_middleware import get_current_user_id

router = APIRouter(prefix="/api/charts", tags=["charts"])

@router.get("/appointment/{appointment_id}")
async def get_charts_by_appointment(
    appointment_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """예약 ID에 연결된 차트 목록 반환
    - 예약 소유자와 현재 로그인 사용자가 일치해야 함
    """
    supabase = get_supabase()
    # 예약 소유자 확인
    appt_res = supabase.table("appointments").select("user_id").eq("id", appointment_id).execute()
    if not appt_res.data:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if appt_res.data[0]["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # 매핑된 차트 조회
    map_res = supabase.table("appointment_chart_map").select("chart_id, linked_at").eq("appointment_id", appointment_id).execute()
    chart_ids = [row["chart_id"] for row in map_res.data]
    if not chart_ids:
        return []
    charts_res = supabase.table("charts").select("id, title, created_at, metadata").in_("id", chart_ids).execute()
    return charts_res.data

@router.get("/{chart_id}")
async def get_chart_detail(chart_id: str, user_id: str = Depends(get_current_user_id)):
    """차트 상세 정보를 반환합니다.
    - 차트가 연결된 세션과 예약을 확인해 권한을 검증합니다.
    """
    supabase = get_supabase()
    # 차트 존재 확인 및 기본 정보 가져오기
    chart_res = supabase.table("charts").select("id, session_id, title, created_at, metadata").eq("id", chart_id).single().execute()
    if not chart_res.data:
        raise HTTPException(status_code=404, detail="Chart not found")
    # 차트와 연결된 세션 조회
    session_res = supabase.table("sessions").select("user_id, appointment_id").eq("id", chart_res.data["session_id"]).single().execute()
    if not session_res.data:
        raise HTTPException(status_code=404, detail="Session not found")
    if session_res.data["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    # (선택) 예약 ID 포함
    chart_detail = chart_res.data.copy()
    chart_detail["appointment_id"] = session_res.data.get("appointment_id")
    return chart_detail

# Mount router in main app (backend/app.py)
# Add the following line to `backend/app.py` after other router includes:
# app.include_router(router)
