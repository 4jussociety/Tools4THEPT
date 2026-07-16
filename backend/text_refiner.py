# STT 변환 텍스트의 오역, 비문, 필러 단어를 GPT로 교정하는 텍스트 보정 모듈
import json
from openai import OpenAI


REFINE_SYSTEM_PROMPT = """\
당신은 물리치료 임상 환경에 특화된 한국어 음성 인식(STT) 교정 전문가입니다.
화자 라벨이 포함된 녹취록을 받아, 아래 규칙에 따라 보정하세요.

## 물리치료 임상 기록 교정 규칙 (핵심)
1. **전문 용어 교정**: 발음이 뭉개지거나 비슷하게 잘못 인식된 단어를 물리치료/해부학 문맥을 고려하여 교정하세요.
   - 예: "성모님 문침" → "승모근 뭉침"
   - 예: "물리집 아닌" → "물리치료 만약에"
   - 예: 통증 관련 문맥에서 "방사선" → "방사통"
   - 해부학 용어(구용어, 신용어) 및 치료 기법(도수치료, 체외충격파, TENS, 고주파 등)을 적극적으로 유추하여 복원하세요.

## 일반 교정 규칙
2. **오역 수정**: 문맥상 잘못 인식된 일반 단어를 교정하세요. (예: "숙령 월이" → "생년월일")
3. **필러 제거**: "어...", "그...", "아...", "뭐..." 등 의미 없는 단어를 제거하세요.
   **단, 환자의 통증 호소나 동의를 나타내는 짧은 감탄사("아!", "악!", "네", "아파요")는 임상적 가치가 매우 높으므로 절대 제거하지 마세요.**
4. **반복 제거**: 말을 더듬어 의미 없이 반복된 부분은 한 번만 남기세요.
5. **문장 부호**: 적절한 마침표, 쉼표, 물음표를 사용하여 가독성을 높이세요.
6. **형식 유지**: [화자명] 형식의 라벨과 줄바꿈 구조는 절대 변경하지 마세요.
7. **사실 왜곡 금지**: 발음을 기반으로 교정하되, 대화에 없는 내용을 새롭게 창작하지 마세요.

## 출력
보정된 전체 텍스트를 그대로 출력하세요. JSON이 아닌 일반 텍스트로 출력합니다.
"""


def refine_transcript(diarized_text: str, client: OpenAI | None = None) -> str:
    """화자 분리된 녹취록의 오역과 비문을 교정한다.

    Args:
        diarized_text: 화자 라벨이 포함된 녹취록 텍스트.
        client: OpenAI 클라이언트.

    Returns:
        보정된 녹취록 텍스트.
    """
    if client is None:
        client = OpenAI()

    chunks = _split_into_chunks(diarized_text, max_chars=3000)

    if len(chunks) == 1:
        refined = _refine_chunk(chunks[0], client)
        print(f"[보정] 텍스트 교정 완료")
        return refined

    refined_parts = []
    for i, chunk in enumerate(chunks):
        print(f"[보정] 청크 {i + 1}/{len(chunks)} 교정 중...")
        refined_parts.append(_refine_chunk(chunk, client))

    result = "\n\n".join(refined_parts)
    print(f"[보정] 텍스트 교정 완료 ({len(chunks)}개 청크)")
    return result


def _split_into_chunks(text: str, max_chars: int = 3000) -> list[str]:
    """텍스트를 화자 블록 단위로 청크를 나눈다.

    화자 라벨([화자명]) 사이의 블록을 기준으로 분할하여
    화자 발화가 중간에 잘리지 않도록 한다.
    """
    blocks = []
    current_block = []

    for line in text.split("\n"):
        if line.startswith("[") and line.endswith("]") and current_block:
            blocks.append("\n".join(current_block))
            current_block = [line]
        else:
            current_block.append(line)

    if current_block:
        blocks.append("\n".join(current_block))

    chunks = []
    current_chunk = []
    current_len = 0

    for block in blocks:
        block_len = len(block)
        if current_len + block_len > max_chars and current_chunk:
            chunks.append("\n".join(current_chunk))
            current_chunk = [block]
            current_len = block_len
        else:
            current_chunk.append(block)
            current_len += block_len

    if current_chunk:
        chunks.append("\n".join(current_chunk))

    return chunks


def _refine_chunk(chunk: str, client: OpenAI) -> str:
    """텍스트 청크 하나를 교정한다."""
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": REFINE_SYSTEM_PROMPT},
            {"role": "user", "content": chunk},
        ],
        temperature=0.3,
    )

    return response.choices[0].message.content.strip()
