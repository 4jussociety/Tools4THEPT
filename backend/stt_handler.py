# Soniox AI 비동기 STT API를 사용하여 음성을 화자 분리 포함 텍스트로 변환하는 STT 모듈
# SonioxClient SDK를 통해 파일 업로드 → 비동기 변환 → 결과 조회 → 리소스 정리를 수행한다.
import os

from soniox import SonioxClient
from soniox.types import CreateTranscriptionConfig


def transcribe(audio_path: str, api_key: str | None = None) -> dict:
    """오디오 파일을 Soniox 비동기 STT API로 화자 분리 포함 텍스트로 변환한다.

    흐름: 파일 업로드 + 변환 요청 → 완료 대기 → 결과 조회 → 리소스 정리 → 반환

    Args:
        audio_path: 전처리된 오디오 파일 경로.
        api_key: Soniox API 키. None이면 환경변수에서 읽는다.

    Returns:
        화자별 세그먼트 리스트를 포함한 결과 딕셔너리.
        {"segments": [{"speaker": str, "text": str}, ...], "full_text": str}
    """
    if api_key is None:
        api_key = os.getenv("SONIOX_API_KEY", "")
    if not api_key:
        raise ValueError("SONIOX_API_KEY가 설정되지 않았습니다. .env 파일을 확인하세요.")

    client = SonioxClient(api_key=api_key)

    file_id = None
    transcription_id = None
    try:
        # 1) 파일 업로드 (공식 문서 권장 방식: 파일을 먼저 업로드하여 file_id 획득)
        print(f"[STT] 파일 업로드 중... ({os.path.basename(audio_path)})")
        # 업로드 시 파일 이름을 ASCII 안전한 이름으로 전달하여 인코딩 오류 방지
        uploaded_file = client.files.upload(audio_path)
        file_id = uploaded_file.id
        print(f"[STT] 파일 업로드 완료 (ID: {file_id})")

        # 2) 비동기 변환 요청 (화자 분리 + 한국어 힌트 추가)
        print("[STT] Soniox 변환 작업 생성 중...")
        config = CreateTranscriptionConfig(
            enable_speaker_diarization=True,
            language_hints=["ko"]  # 한국어 인식률 향상을 위한 힌트 추가
        )
        transcription = client.stt.create(
            model="stt-async-v4",
            file_id=file_id,
            config=config,
        )
        transcription_id = transcription.id
        print(f"[STT] 변환 작업 생성 완료 (ID: {transcription_id})")

        # 3) 완료 대기 (최대 1시간)
        print("[STT] 변환 완료 대기 중...")
        client.stt.wait(transcription_id, timeout_sec=3600)

        # 4) 결과 조회
        transcript = client.stt.get_transcript(transcription_id)

        # 5) 토큰을 화자별 세그먼트로 그룹화
        segments = _group_tokens_by_speaker(transcript)
        speakers = {seg["speaker"] for seg in segments}
        full_text = transcript.text if hasattr(transcript, "text") else ""

        print(
            f"[STT] 변환 완료 ({len(segments)}개 세그먼트, "
            f"화자 {len(speakers)}명: {', '.join(sorted(speakers))})"
        )

        return {"segments": segments, "full_text": full_text}

    finally:
        # 6) 리소스 정리 (공식 문서 권장: 작업 결과와 업로드 파일 모두 삭제)
        if transcription_id:
            try:
                client.stt.delete(transcription_id)
            except Exception:
                pass
        if file_id:
            try:
                client.files.delete(file_id)
            except Exception:
                pass
        client.close()


def format_diarized_transcript(response: dict) -> str:
    """Soniox STT 응답을 읽기 쉬운 화자 분리 텍스트로 포맷한다.

    Args:
        response: transcribe()의 반환값.

    Returns:
        화자 라벨이 포함된 포맷된 텍스트.
    """
    segments = response.get("segments", [])
    lines = []
    prev_speaker = None

    for seg in segments:
        speaker = seg.get("speaker", "알 수 없음")
        text = seg.get("text", "").strip()

        if not text:
            continue

        if speaker != prev_speaker:
            if lines:
                lines.append("")
            lines.append(f"[화자 {speaker}]")
            prev_speaker = speaker

        lines.append(text)

    return "\n".join(lines)


def _group_tokens_by_speaker(transcript) -> list[dict]:
    """Soniox 트랜스크립트의 토큰을 화자별 세그먼트로 그룹화한다."""
    tokens = getattr(transcript, "tokens", None)

    if not tokens:
        text = getattr(transcript, "text", "")
        if text:
            return [{"speaker": "1", "text": text}]
        return []

    segments = []
    current_speaker = None
    current_words = []

    for token in tokens:
        speaker = getattr(token, "speaker", None) or "1"
        text = getattr(token, "text", "")

        if speaker != current_speaker:
            if current_words:
                segments.append({
                    "speaker": current_speaker or "1",
                    "text": "".join(current_words).strip(),
                })
            current_speaker = speaker
            current_words = [text]
        else:
            current_words.append(text)

    if current_words:
        segments.append({
            "speaker": current_speaker or "1",
            "text": "".join(current_words).strip(),
        })

    return segments
