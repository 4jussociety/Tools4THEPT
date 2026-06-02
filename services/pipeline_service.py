import os
import json
import shutil
import traceback
from pathlib import Path
from openai import OpenAI

from supabase_client import get_supabase
from audio_processor import process_audio
from stt_handler import transcribe, format_diarized_transcript
from text_refiner import refine_transcript
from report_generator import generate_chart, generate_patient_guide

BASE_DIR = Path(__file__).resolve().parent.parent
OUTPUT_DIR = BASE_DIR / "output"

def run_async_pipeline(
    session_id: str,
    local_audio_path: str,
    user_id: str,
    profession: str,
    memo: str = None
):
    """
    백그라운드에서 오디오 분석 전체 파이프라인을 실행하고 결과를 Supabase에 저장합니다.
    """
    supabase = get_supabase()
    openai_client = OpenAI()
    
    # 임시 아웃풋 디렉토리 생성
    session_output_dir = OUTPUT_DIR / session_id
    session_output_dir.mkdir(parents=True, exist_ok=True)
    
    audio_path = Path(local_audio_path)
    storage_path = f"{user_id}/{session_id}_{audio_path.name}"
    
    try:
        # 1. sessions 상태를 'processing'으로 변경
        supabase.table("sessions").update({"status": "processing"}).eq("id", session_id).execute()
        print(f"[{session_id}] 상태 변경: processing")

        # 2. Supabase Storage에 원본 오디오 파일 업로드
        print(f"[{session_id}] Supabase Storage 업로드 중... ({storage_path})")
        with open(local_audio_path, "rb") as f:
            try:
                # audio-records 버킷에 업로드
                supabase.storage.from_("audio-records").upload(
                    path=storage_path,
                    file=f,
                    file_options={"x-upsert": "true"}
                )
                # 오디오 파일의 Public URL 획득
                audio_url = supabase.storage.from_("audio-records").get_public_url(storage_path)
                # 세션에 audio_url 업데이트
                supabase.table("sessions").update({"audio_url": audio_url}).eq("id", session_id).execute()
                print(f"[{session_id}] Storage 업로드 완료. URL: {audio_url}")
            except Exception as se:
                print(f"[{session_id}] Warning: Storage upload failed ({se}). Using local reference.")
                # Storage 업로드가 실패해도 로컬에서 분석을 계속 진행함

        # 3. 오디오 전처리 (노이즈 제거 등)
        print(f"[{session_id}] 오디오 전처리 시작...")
        processed_path = process_audio(local_audio_path, str(session_output_dir))

        # 4. STT + 화자 분리 (Soniox AI API)
        print(f"[{session_id}] Soniox STT 및 화자 분리 시작...")
        soniox_key = os.getenv("SONIOX_API_KEY", "")
        if not soniox_key:
            raise ValueError("SONIOX_API_KEY is not configured in .env")
            
        stt_response = transcribe(processed_path, soniox_key)
        diarized_text = format_diarized_transcript(stt_response)

        # 5. 텍스트 보정 (GPT-4o-mini)
        print(f"[{session_id}] GPT 텍스트 보정 시작...")
        refined_text = refine_transcript(diarized_text, openai_client)

        # 6. AI 임상 차트 및 환자 가이드 생성 (GPT-4o-mini)
        print(f"[{session_id}] AI 임상 차트 및 환자 가이드 생성 시작...")
        chart = generate_chart(refined_text, openai_client, profession, memo=memo)
        guide = generate_patient_guide(refined_text, openai_client, profession, memo=memo)

        # 7. Supabase DB에 결과물 일괄 저장
        print(f"[{session_id}] Supabase DB 결과 저장 중...")
        results_data = {
            "session_id": session_id,
            "raw_transcript": diarized_text,
            "refined_transcript": refined_text,
            "chart_data": chart,
            "guide_content": guide
        }
        supabase.table("results").insert(results_data).execute()

        # 8. 세션 상태를 'completed'로 업데이트
        supabase.table("sessions").update({"status": "completed"}).eq("id", session_id).execute()

        # 9. 사용자 프로필의 quota_used를 +1 증가
        print(f"[{session_id}] 사용자 Quota 사용량 차감 중...")
        profile_res = supabase.table("profiles").select("quota_used").eq("id", user_id).execute()
        if profile_res.data:
            current_used = profile_res.data[0].get("quota_used", 0)
            supabase.table("profiles").update({"quota_used": current_used + 1}).eq("id", user_id).execute()

        print(f"[{session_id}] 전체 파이프라인 분석 완료!")

    except Exception as e:
        print(f"[{session_id}] 파이프라인 오류 발생: {e}")
        traceback.print_exc()
        try:
            # 에러 발생 시 세션 상태를 'failed'로 변경
            supabase.table("sessions").update({"status": "failed"}).eq("id", session_id).execute()
        except Exception as db_err:
            print(f"[{session_id}] DB 상태 업데이트 실패: {db_err}")
            
    finally:
        # 로컬 임시 결과물 폴더 제거 (디스크 공간 절약)
        try:
            if session_output_dir.exists():
                shutil.rmtree(session_output_dir)
            if audio_path.exists():
                audio_path.unlink()
            print(f"[{session_id}] 임시 리소스 정리 완료")
        except Exception as cleanup_err:
            print(f"[{session_id}] 임시 리소스 정리 중 오류: {cleanup_err}")
