from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from supabase_client import get_supabase
from auth_middleware import get_current_user_id

router = APIRouter(prefix="/api/profile", tags=["profile"])

class ChargeRequest(BaseModel):
    amount: int  # 충전할 횟수 (예: 10, 50, 100)

@router.get("")
async def get_profile(user_id: str = Depends(get_current_user_id)):
    """
    로그인한 사용자의 프로필 정보(이름, 직군, 잔여 Quota 등)를 조회합니다.
    """
    supabase = get_supabase()
    try:
        res = supabase.table("profiles").select("*").eq("id", user_id).execute()
        if not res.data:
            # 트리거가 작동하지 않았거나 예외적으로 프로필이 없는 경우 기본 프로필 생성
            new_profile = {
                "id": user_id,
                "name": "치료사",
                "profession": "pt",
                "quota_limit": 10,
                "quota_used": 0
            }
            insert_res = supabase.table("profiles").insert(new_profile).execute()
            if insert_res.data:
                return insert_res.data[0]
            raise HTTPException(status_code=404, detail="Profile not found and failed to auto-create")
            
        return res.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch profile: {str(e)}")

@router.post("/charge")
async def charge_quota(payload: ChargeRequest, user_id: str = Depends(get_current_user_id)):
    """
    Mock 결제 완료 후 사용자의 Quota를 충전해 줍니다.
    """
    supabase = get_supabase()
    try:
        # 기존 프로필 조회
        res = supabase.table("profiles").select("quota_limit").eq("id", user_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Profile not found")
            
        current_limit = res.data[0].get("quota_limit", 10)
        new_limit = current_limit + payload.amount
        
        # quota_limit를 업데이트
        update_res = supabase.table("profiles")\
            .update({"quota_limit": new_limit})\
            .eq("id", user_id)\
            .execute()
            
        if not update_res.data:
            raise ValueError("Failed to update profile quota")
            
        return {
            "status": "success",
            "message": f"성공적으로 {payload.amount}회 충전되었습니다.",
            "quota_limit": new_limit
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to charge quota: {str(e)}")
