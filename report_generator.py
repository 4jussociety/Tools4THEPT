# STT 텍스트를 분석하여 전문 차트(기록용)와 환자 가이드(환자용)를 생성하는 리포트 모듈
import json
from openai import OpenAI


def get_chart_prompt(profession: str) -> str:
    """직군에 맞는 동적 차트 프롬프트를 생성한다."""
    profession = profession.lower()
    
    if profession == "pt":
        prof_name = "물리치료"
        obj_hint = "기능 검사(ROM, MMT 등) 및 평가 결과"
        diag_hint = "물리치료적 진단명"
    elif profession == "st":
        prof_name = "언어재활"
        obj_hint = "조음, 유창성, 음성, 언어 이해/표현력, 연하 기능 등 평가 결과"
        diag_hint = "언어재활적 진단명"
    elif profession == "ot":
        prof_name = "작업치료"
        obj_hint = "ADL, 소근육 기능, 인지 기능, 감각 통합 등 평가 결과"
        diag_hint = "작업치료적 진단명"
    else:
        prof_name = "재활치료"
        obj_hint = "기능 검사 및 평가 결과"
        diag_hint = "기능적 진단명"

    return f"""\
당신은 숙련된 {prof_name} 임상 기록 전문가입니다.
{prof_name}사와 환자의 대화 녹취록(및 추가 제공된 수기 메모)을 분석하여 아래 JSON 형식으로 정리하세요.

## 출력 형식 (JSON)
{{
  "clinical_record": {{
    "subjective": {{
      "chief_complaint": "주호소 및 증상 발생 시기",
      "pain_scale": "언급된 통증 수치",
      "aggravating_easing_factors": "증상 악화 또는 완화 요인",
      "precautions_contraindications": "과거력 및 주의사항"
    }},
    "objective": {{
      "observation_posture": "시각적 관찰 소견",
      "physical_examination": "{obj_hint}"
    }},
    "assessment": {{
      "therapist_diagnosis": "녹취록 및 수기 메모에 명시된 치료사의 관점 및 진단 내용",
      "ai_diagnosis_inferred": "전체 문맥(녹취+수기)을 기반으로 AI가 자체적으로 추론한 {diag_hint} 및 분석 관점",
      "clinical_impression": "종합적인 임상 추론",
      "progress": "상태 변화 및 호전 정도"
    }},
    "plan": {{
      "treatment_performed": "오늘 실시한 치료 중재",
      "home_exercise": "지도한 자가 운동 및 교육 내용",
      "future_plan": "향후 치료 계획"
    }}
  }},
  "red_flags_detected": [
    "감지된 위험 징후 (없으면 빈 배열 [])"
  ],
  "rapport_data": {{
    "personal_background": "가족 관계, 직업, 취미, 생활 환경 등 환자를 개인적으로 이해하고 기억하는 데 도움이 되는 배경 정보",
    "patient_preferences": "치료 시 선호하는 방식, 대화 주제 등 특이사항",
    "psychosocial_factors": "심리적 상태, 사회적 지지 체계 등 심리사회적 요인",
    "compliance_attitude": "치료 순응도 및 태도",
    "upcoming_events": ["환자가 직접 언급한 향후 일정(여행, 행사 등). 없으면 빈 배열 []"],
    "follow_up_cues": ["다음 대화 시 아이스브레이킹으로 활용할 수 있는 구체적인 주제. 없으면 빈 배열 []"]
  }}
}}

## 규칙
- 의학 용어는 필요한 경우 영어 원문을 병기하세요.
- 대화나 메모에서 명시적으로 언급되지 않은 항목은 "언급 없음"으로 기록하거나 빈 배열([])로 두세요. 절대로 추측하여 내용을 채우지 마세요.
- 수기 메모에 담긴 구체적인 수치가 녹취록 내용보다 우선순위가 높습니다.
- rapport_data는 환자와의 신뢰 구축을 위해 실제 언급된 구체적인 정보를 기반으로 추출하세요.
"""


def get_guide_prompt(profession: str) -> str:
    """직군에 맞는 동적 환자 가이드 프롬프트를 생성한다."""
    profession = profession.lower()
    
    if profession == "pt":
        prof_name = "물리치료"
    elif profession == "st":
        prof_name = "언어재활"
    elif profession == "ot":
        prof_name = "작업치료"
    else:
        prof_name = "재활치료"

    return f"""\
당신은 친절한 {prof_name} 안내 도우미입니다.
{prof_name}사와 환자의 대화 녹취록 및 수기 기록을 분석하여, 환자가 쉽게 이해할 수 있는 치료 요약문을 작성하세요.

## 출력 형식 (마크다운)

### 오늘의 치료 요약
(오늘 어떤 치료를 받았는지 전문 용어 없이 쉽게 설명)

### 집에서 주의할 점
(환자가 일상에서 지켜야 할 사항을 구체적으로)

### 다음 방문 안내
(다음 치료 일정과 진행할 내용을 간략히)

## 규칙
- 존댓말을 사용하세요.
- 전문 용어는 피하고 쉽게 설명하세요.
- 언급되지 않은 내용은 절대로 추측하거나 포함하지 마세요.
"""


def generate_chart(transcript: str, client: OpenAI | None = None, profession: str = "pt", memo: str = None) -> dict:
    """STT 텍스트와 추가 메모로부터 전문 임상 차트와 라포 데이터를 생성한다."""
    if client is None:
        client = OpenAI()

    user_content = f"아래는 {profession.upper()} 세션의 녹취록입니다.\n\n{transcript}"
    if memo:
        user_content += f"\n\n[추가 수기 메모]\n{memo}"

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": get_chart_prompt(profession)},
            {"role": "user", "content": user_content},
        ],
        temperature=0.1,
        response_format={"type": "json_object"},
    )

    result = json.loads(response.choices[0].message.content)
    print(f"[차트] {profession.upper()} 임상 기록 생성 완료")
    return result


def generate_patient_guide(transcript: str, client: OpenAI | None = None, profession: str = "pt", memo: str = None) -> str:
    """STT 텍스트와 추가 메모로부터 환자용 맞춤 치료 가이드를 생성한다."""
    if client is None:
        client = OpenAI()

    user_content = f"아래는 {profession.upper()} 세션의 녹취록입니다.\n\n{transcript}"
    if memo:
        user_content += f"\n\n[추가 수기 메모]\n{memo}"

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": get_guide_prompt(profession)},
            {"role": "user", "content": user_content},
        ],
        temperature=0.3,
    )

    result = response.choices[0].message.content
    print(f"[가이드] {profession.upper()} 환자용 안내문 생성 완료")
    return result
