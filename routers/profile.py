from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from supabase_client import get_supabase
from auth_middleware import get_current_user_id

router = APIRouter(prefix="/api/profile", tags=["profile"])

class ChargeRequest(BaseModel):
    amount: int  # 충전할 횟수 (예: 10, 50, 100)

def _ensure_profile_exists(supabase, user_id: str) -> dict:
    """프로필이 존재하는지 확인하고, 없으면 자동 생성합니다."""
    res = supabase.table("profiles").select("*").eq("id", user_id).execute()
    if res.data:
        return res.data[0]
    
    # 프로필이 없으면 자동 생성 시도
    print(f"Profile not found for user {user_id}. Auto-creating...")
    new_profile = {
        "id": user_id,
        "name": "치료사",
        "profession": "pt",
        "quota_limit": 10,
        "quota_used": 0
    }
    try:
        insert_res = supabase.table("profiles").insert(new_profile).execute()
        if insert_res.data:
            print(f"Profile auto-created for user {user_id}")
            return insert_res.data[0]
    except Exception as e:
        print(f"Failed to auto-create profile: {e}")
    
    raise HTTPException(status_code=404, detail="Profile not found and failed to auto-create")

@router.get("")
async def get_profile(user_id: str = Depends(get_current_user_id)):
    """
    로그인한 사용자의 프로필 정보(이름, 직군, 잔여 Quota 등)를 조회합니다.
    """
    supabase = get_supabase()
    try:
        return _ensure_profile_exists(supabase, user_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch profile: {str(e)}")

@router.post("/charge")
async def charge_quota(payload: ChargeRequest, user_id: str = Depends(get_current_user_id)):
    """
    Mock 결제 완료 후 사용자의 Quota를 충전해 줍니다.
    """
    supabase = get_supabase()
    try:
        # 프로필 조회 (없으면 자동 생성)
        profile = _ensure_profile_exists(supabase, user_id)
        current_limit = profile.get("quota_limit", 10)
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
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to charge quota: {str(e)}")

