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
    # Use original file extension directly
    ext = audio_path.suffix.lstrip('.') if audio_path.suffix else "mp3"
    storage_path = f"{user_id}/{session_id}_processed_audio.{ext}"
    
    try:
        # 1. sessions 상태를 'processing'으로 변경
        supabase.table("sessions").update({"status": "processing"}).eq("id", session_id).execute()
        print(f"[{session_id}] 상태 변경: processing")

        # 2. Supabase Storage에 오디오 파일 업로드 (전처리 없이 원본 파일 그대로 업로드)
        print(f"[{session_id}] Supabase Storage 업로드 중... ({storage_path})")
        with open(audio_path, "rb") as f:
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

        # 3. STT + 화자 분리 (Soniox AI API) - 전처리된 오디오 대신 원본 오디오 전달
        print(f"[{session_id}] Soniox STT 및 화자 분리 시작...")
        soniox_key = os.getenv("SONIOX_API_KEY", "")
        if not soniox_key:
            raise ValueError("SONIOX_API_KEY is not configured in .env")
            
        stt_response = transcribe(str(audio_path), soniox_key)
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

        # 9. 사용자 프로필의 quota_used를 +1 증가 (선차감되었으므로 성공 시에는 유지)
        print(f"[{session_id}] 분석 성공 - 선차감된 크레딧 유지")

        print(f"[{session_id}] 전체 파이프라인 분석 완료!")

    except Exception as e:
        print(f"[{session_id}] 파이프라인 오류 발생: {e}")
        traceback.print_exc()
        try:
            # 에러 발생 시 세션 상태를 'failed'로 변경
            supabase.table("sessions").update({"status": "failed"}).eq("id", session_id).execute()
        except Exception as db_err:
            print(f"[{session_id}] DB 상태 업데이트 실패: {db_err}")

        # [Credit Refund] 선차감된 크레딧 환불 (quota_used - 1)
        print(f"[{session_id}] 파이프라인 실패로 인한 크레딧 환불 처리 시작...")
        try:
            max_retries = 3
            refunded = False
            for attempt in range(max_retries):
                profile_res = supabase.table("profiles").select("quota_used").eq("id", user_id).execute()
                if not profile_res.data:
                    print(f"[{session_id}] 환불 오류: 프로필을 찾을 수 없음")
                    break
                
                current_used = profile_res.data[0].get("quota_used", 0)
                if current_used <= 0:
                    print(f"[{session_id}] 환불 건너뜀: 이미 quota_used가 0 이하임 ({current_used})")
                    break
                    
                update_res = supabase.table("profiles")\
                    .update({"quota_used": current_used - 1})\
                    .eq("id", user_id)\
                    .eq("quota_used", current_used)\
                    .execute()
                    
                if update_res.data:
                    refunded = True
                    print(f"[{session_id}] [Credit] 환불 성공. quota_used: {current_used} -> {current_used - 1}")
                    break
            
            if not refunded:
                print(f"[{session_id}] [Credit Warning] 환불 실패: 동시 업데이트 충돌 또는 최대 시도 횟수 초과")
        except Exception as refund_err:
            print(f"[{session_id}] [Credit Error] 환불 중 데이터베이스 오류 발생: {refund_err}")
            
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

        # Supabase Storage에서 임시 오디오 파일 삭제 및 DB audio_url 초기화
        try:
            supabase.storage.from_("audio-records").remove([storage_path])
            supabase.table("sessions").update({"audio_url": None}).eq("id", session_id).execute()
            print(f"[{session_id}] Supabase Storage 임시 오디오 파일 삭제 완료")
        except Exception as storage_cleanup_err:
            print(f"[{session_id}] Supabase Storage 임시 오디오 파일 삭제 중 오류: {storage_cleanup_err}")


def run_local_edge_mimic_pipeline(
    session_id: str,
    user_id: str,
    profession: str,
    memo: str = None
):
    """
    Deno Edge Function의 로컬 동작을 모방하여, Storage에서 오디오를 다운로드받아
    STT/GPT 분석을 수행하고 결과를 DB에 저장한 후 오디오를 삭제합니다.
    """
    supabase = get_supabase()
    openai_client = OpenAI()
    
    # Find the processed audio file in storage with dynamic extension
    ext = "wav"
    try:
        files = supabase.storage.from_("audio-records").list(user_id)
        prefix = f"{session_id}_processed_audio."
        for f in files:
            name = f.get("name", "")
            if name.startswith(prefix):
                ext = name.split(".")[-1]
                print(f"[LocalEdge] Found processed audio file with extension: {ext}")
                break
    except Exception as list_err:
        print(f"[LocalEdge] Warning: Failed to list storage directory ({list_err}). Falling back to .wav")

    storage_path = f"{user_id}/{session_id}_processed_audio.{ext}"
    local_temp_path = OUTPUT_DIR / f"{session_id}_temp.{ext}"
    
    try:
        # 1. 스토리지에서 오디오 다운로드
        print(f"[LocalEdge] Downloading audio from storage: {storage_path}")
        try:
            res = supabase.storage.from_("audio-records").download(storage_path)
            OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
            with open(local_temp_path, "wb") as f:
                f.write(res)
        except Exception as se:
            print(f"[LocalEdge] Failed to download audio from storage: {se}")
            raise RuntimeError(f"Storage download failed: {se}")

        # 2. Soniox STT 및 화자 분리
        print(f"[LocalEdge] Soniox STT starts...")
        soniox_key = os.getenv("SONIOX_API_KEY", "")
        stt_response = transcribe(str(local_temp_path), soniox_key)
        diarized_text = format_diarized_transcript(stt_response)

        # 3. GPT 텍스트 보정
        print(f"[LocalEdge] GPT Refine starts...")
        refined_text = refine_transcript(diarized_text, openai_client)

        # 4. 임상 차트 및 환자 가이드 생성
        print(f"[LocalEdge] GPT SOAP & Guide generation starts...")
        chart = generate_chart(refined_text, openai_client, profession, memo=memo)
        guide = generate_patient_guide(refined_text, openai_client, profession, memo=memo)

        # 5. DB 저장
        print(f"[LocalEdge] Saving results to DB...")
        results_data = {
            "session_id": session_id,
            "raw_transcript": diarized_text,
            "refined_transcript": refined_text,
            "chart_data": chart,
            "guide_content": guide
        }
        supabase.table("results").insert(results_data).execute()

        # 6. 세션 상태를 'completed'로 변경
        supabase.table("sessions").update({"status": "completed"}).eq("id", session_id).execute()
        print(f"[LocalEdge] Pipeline success for session {session_id}")

    except Exception as e:
        print(f"[LocalEdge] Pipeline error: {e}")
        traceback.print_exc()
        try:
            supabase.table("sessions").update({"status": "failed"}).eq("id", session_id).execute()
        except Exception as db_err:
            print(f"[LocalEdge] DB state update failed: {db_err}")

        # 환불 처리
        try:
            profile_res = supabase.table("profiles").select("quota_used").eq("id", user_id).execute()
            if profile_res.data:
                current_used = profile_res.data[0].get("quota_used", 0)
                if current_used > 0:
                    supabase.table("profiles").update({"quota_used": current_used - 1}).eq("id", user_id).execute()
                    print(f"[LocalEdge] Credit refunded. Used: {current_used} -> {current_used - 1}")
        except Exception as refund_err:
            print(f"[LocalEdge] Refund error: {refund_err}")

    finally:
        # 임시 로컬 파일 삭제
        if local_temp_path.exists():
            try:
                local_temp_path.unlink()
            except Exception:
                pass
        
        # 스토리지 파일 삭제
        try:
            supabase.storage.from_("audio-records").remove([storage_path])
            print(f"[LocalEdge] Temp audio deleted from storage: {storage_path}")
        except Exception as se:
            print(f"[LocalEdge] Failed to delete audio from storage: {se}")

