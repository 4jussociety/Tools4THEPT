import os
import shutil
from pathlib import Path
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import traceback

from dotenv import load_dotenv
load_dotenv()

from main import run_pipeline

# 현재 파일(app.py)의 위치를 기준으로 절대 경로 설정
BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
OUTPUT_DIR = BASE_DIR / "output"

app = FastAPI(title="재활치료 AI 차팅 솔루션 API")

# 정적 파일 서빙 디렉토리 설정 (절대 경로 사용)
STATIC_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

@app.get("/")
async def read_index():
    index_path = STATIC_DIR / "index.html"
    return FileResponse(str(index_path))

@app.post("/api/analyze")
async def analyze_audio(
    file: UploadFile = File(...),
    profession: str = Form("pt"),
    memo: str = Form(None)
):
    """
    업로드된 오디오 파일과 추가 메모를 분석하여 차트, 가이드, 녹취록을 반환합니다.
    """
    try:
        # 1. 파일 임시 저장 (절대 경로 사용)
        upload_dir = OUTPUT_DIR / "uploads"
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        # 오디오 파일 저장
        file_path = str(upload_dir / file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # 2. 파이프라인 실행 (절대 경로 전달)
        print(f"\n[{profession.upper()}] API 분석 시작: {file.filename}")
        results = run_pipeline(file_path, str(OUTPUT_DIR), profession, memo=memo)
        
        return {
            "status": "success",
            "data": results
        }
        
    except Exception as e:
        print(f"\n오류 발생: {type(e).__name__}: {e}")
        traceback.print_exc()
        return {
            "status": "error",
            "message": str(e)
        }
