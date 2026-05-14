# 오디오 전처리 → STT(Soniox AI API, 화자분리) → 텍스트 보정 → 리포트 생성까지의 전체 파이프라인을 실행하는 진입점 모듈
import argparse
import json
import os
import sys

from dotenv import load_dotenv
load_dotenv()
from openai import OpenAI

from audio_processor import process_audio
from stt_handler import transcribe, format_diarized_transcript
from text_refiner import refine_transcript
from report_generator import generate_chart, generate_patient_guide


def run_pipeline(audio_path: str, base_output_dir: str, profession: str = "pt", memo: str = None) -> dict:
    """전체 파이프라인을 순차적으로 실행한다.

    1단계: 오디오 전처리 (노이즈 제거 + 모노 + 무음 제거 + 볼륨 정규화)
    2단계: STT + 화자 분리 (Soniox AI Async API)
    3단계: 텍스트 보정 (GPT-4o-mini)
    4단계: 리포트 생성 (GPT-4o-mini)

    Args:
        audio_path: 원본 녹음 파일 경로.
        base_output_dir: 결과물을 저장할 기본 디렉토리.
        profession: 직군 선택 (pt, st, ot 등)
        memo: 수기 메모 텍스트 (선택 사항)
        
    Returns:
        파이프라인 실행 결과가 담긴 딕셔너리
    """
    audio_basename = os.path.splitext(os.path.basename(audio_path))[0]
    output_dir = os.path.join(base_output_dir, audio_basename)
    os.makedirs(output_dir, exist_ok=True)

    client = OpenAI()

    print("=" * 50)
    print(f"[{profession.upper()}] AI 차팅 솔루션 (메모: {'O' if memo else 'X'})")
    print("=" * 50)

    # 1단계: 오디오 전처리
    print("\n[단계 1] 오디오 전처리 중...")
    processed_path = process_audio(audio_path, output_dir)

    # 2단계: STT + 화자 분리 (Soniox AI API)
    print("\n[단계 2] 음성 → 텍스트 변환 + 화자 분리 중 (Soniox AI API)...")
    soniox_key = os.getenv("SONIOX_API_KEY", "")
    response = transcribe(processed_path, soniox_key)
    diarized_text = format_diarized_transcript(response)

    transcript_raw_path = os.path.join(output_dir, "transcript_raw.txt")
    with open(transcript_raw_path, "w", encoding="utf-8") as f:
        f.write(diarized_text)
    print(f"  원본 녹취록 저장: {transcript_raw_path}")

    # 3단계: 텍스트 보정
    print("\n[단계 3] 텍스트 보정 중...")
    refined_text = refine_transcript(diarized_text, client)

    transcript_path = os.path.join(output_dir, "transcript.txt")
    with open(transcript_path, "w", encoding="utf-8") as f:
        f.write(refined_text)
    print(f"  보정 녹취록 저장: {transcript_path}")

    # 4단계: 리포트 생성
    print("\n[단계 4] AI 리포트 생성 중...")

    chart = generate_chart(refined_text, client, profession, memo=memo)
    chart_path = os.path.join(output_dir, "chart.json")
    with open(chart_path, "w", encoding="utf-8") as f:
        json.dump(chart, f, ensure_ascii=False, indent=2)
    print(f"  임상 차트 저장: {chart_path}")

    guide = generate_patient_guide(refined_text, client, profession, memo=memo)
    guide_path = os.path.join(output_dir, "patient_guide.md")
    with open(guide_path, "w", encoding="utf-8") as f:
        f.write(guide)
    print(f"  환자 가이드 저장: {guide_path}")

    print("\n" + "=" * 50)
    print("처리 완료. 결과물 목록.")
    print(f"  - 전처리 오디오: {processed_path}")
    print(f"  - 원본 녹취록: {transcript_raw_path}")
    print(f"  - 보정 녹취록: {transcript_path}")
    print(f"  - 임상 차트: {chart_path}")
    print(f"  - 환자 가이드: {guide_path}")
    print("=" * 50)

    return {
        "transcript": refined_text,
        "chart": chart,
        "guide": guide,
        "output_dir": output_dir
    }

def main() -> None:
    parser = argparse.ArgumentParser(
        description="물리치료 녹음 → AI 차트/환자 가이드 자동 생성",
    )
    parser.add_argument("audio", help="녹음 파일 경로 (mp3, wav, m4a 등)")
    parser.add_argument(
        "-o", "--output",
        default="output",
        help="결과물 저장 기본 디렉토리 (기본: ./output, 내부에 오디오 파일명으로 폴더 생성됨)",
    )

    args = parser.parse_args()

    if not os.path.isfile(args.audio):
        print(f"오류: 파일을 찾을 수 없습니다 → {args.audio}")
        sys.exit(1)

    run_pipeline(args.audio, args.output)


if __name__ == "__main__":
    main()
