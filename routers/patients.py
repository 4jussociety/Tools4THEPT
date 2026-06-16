import os
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from datetime import date
from typing import Optional, List
from supabase_client import get_supabase
from auth_middleware import get_current_user_id

router = APIRouter(prefix="/api/patients", tags=["patients"])

class PatientCreate(BaseModel):
    name: str
    birth_date: date
    gender: str  # 'M', 'F', or 'Other'
    chart_number: Optional[str] = None

@router.get("", response_model=List[dict])
async def get_patients(user_id: str = Depends(get_current_user_id)):
    """
    현재 로그인한 치료사가 등록 및 관리하는 환자 목록을 반환합니다.
    """
    supabase = get_supabase()
    try:
        res = supabase.table("patients")\
            .select("*")\
            .eq("therapist_id", user_id)\
            .order("name")\
            .execute()
        return res.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch patients: {str(e)}")

@router.post("", response_model=dict)
async def create_patient(
    patient: PatientCreate,
    user_id: str = Depends(get_current_user_id)
):
    """
    신규 환자를 치료사 하위에 등록합니다.
    """
    supabase = get_supabase()
    
    if patient.gender not in ['M', 'F', 'Other']:
        raise HTTPException(status_code=400, detail="Gender must be 'M', 'F', or 'Other'")
        
    patient_data = {
        "therapist_id": user_id,
        "name": patient.name,
        "birth_date": str(patient.birth_date),
        "gender": patient.gender,
        "chart_number": patient.chart_number
    }
    
    try:
        res = supabase.table("patients").insert(patient_data).execute()
        if not res.data:
            raise ValueError("Failed to create patient record")
        return res.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
