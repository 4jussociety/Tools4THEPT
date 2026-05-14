# AI Clinical Charting Project

이 프로젝트는 음성 녹음 파일을 자동으로 전사하고, 이를 바탕으로 임상 차트 및 환자 가이드를 생성하는 웹 애플리케이션입니다.

## 주요 기능
- **음성 인식 (STT)**: Soniox API를 활용한 고정밀 한국어 음성 전사.
- **텍스트 정제**: GPT-4o-mini를 활용하여 대화 내용을 깔끔한 텍스트로 변환.
- **보고서 생성**: 전사된 내용을 바탕으로 전문적인 임상 차트 및 환자 가이드 자동 작성.
- **웹 인터페이스**: 직관적인 UI를 통한 파일 업로드 및 결과 확인.

## 설치 및 실행 방법

1. 저장소 클론:
   ```bash
   git clone [your-repository-url]
   ```

2. 필요 패키지 설치:
   ```bash
   pip install -r requirements.txt
   ```

3. 환경 변수 설정:
   `.env` 파일을 생성하고 다음 정보를 입력하세요:
   ```
   SONIOX_API_KEY=your_key
   OPENAI_API_KEY=your_key
   ```

4. 앱 실행:
   ```bash
   python app.py
   ```

## 기술 스택
- Backend: Python (Flask/FastAPI)
- Frontend: Vanilla JS, CSS, HTML
- AI: Soniox STT, OpenAI GPT-4o
