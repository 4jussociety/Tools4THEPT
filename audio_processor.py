# 오디오 파일의 노이즈 제거, 대역통과 필터, 모노 변환, 무음 제거, 볼륨 정규화, 1.3배속 압축을 수행하는 전처리 모듈
import json
import os
import subprocess


def process_audio(input_path: str, output_dir: str) -> str:
    """오디오 파일을 전처리한다.

    처리 순서 (필터 체인):
      1. 노이즈 제거 (afftdn) — 배경 소음/전화 회선 잡음 제거
      2. 대역통과 필터 (highpass/lowpass) — 80Hz~3000Hz 외 불필요 주파수 컷
      3. 무음 제거 (silenceremove) — 0.7초 이상 무음 구간 삭제
      4. 속도 조절 (atempo) — 1.3배속 적용
      5. 볼륨 정규화 (loudnorm) — EBU R128 기준으로 음량 일정하게
      + 모노 변환, 16kHz 리샘플링

    Args:
        input_path: 원본 오디오 파일 경로.
        output_dir: 결과 파일을 저장할 디렉토리.

    Returns:
        전처리된 오디오 파일 경로.
    """
    original_duration = _get_duration(input_path)
    print(f"  원본 길이: {original_duration:.1f}초 ({original_duration / 60:.1f}분)")

    base_name = os.path.splitext(os.path.basename(input_path))[0]
    # 파일명을 ASCII 안전하게 고정하여 업로드 시 인코딩 문제 방지
    output_path = os.path.join(output_dir, "processed_audio.mp3")

    filters = ",".join([
        "afftdn=nf=-25",
        "highpass=f=80",
        "lowpass=f=3000",
        "silenceremove=stop_periods=-1:stop_duration=0.7:stop_threshold=-40dB",
        "atempo=1.3",  # 처리 속도 향상을 위해 1.3배속 적용
        "loudnorm",
    ])

    cmd = [
        "ffmpeg", "-y",
        "-i", input_path,
        "-af", filters,
        "-ac", "1",
        "-ar", "16000",
        "-b:a", "64k",
        output_path,
    ]

    result = subprocess.run(cmd, capture_output=True, encoding="utf-8", errors="replace")
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg 전처리 실패:\n{result.stderr[-500:]}")

    processed_duration = _get_duration(output_path)
    ratio = processed_duration / original_duration * 100 if original_duration > 0 else 0
    print(f"  전처리 후 길이: {processed_duration:.1f}초 (원본 대비 {ratio:.1f}%)")

    return output_path


def _get_duration(file_path: str) -> float:
    """ffprobe로 오디오 파일의 길이(초)를 구한다."""
    cmd = [
        "ffprobe", "-v", "quiet",
        "-print_format", "json",
        "-show_format",
        file_path,
    ]
    result = subprocess.run(cmd, capture_output=True, encoding="utf-8", errors="replace")
    if result.returncode != 0:
        return 0.0

    info = json.loads(result.stdout)
    return float(info.get("format", {}).get("duration", 0))
