import os
import jwt
from fastapi import HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security_scheme = HTTPBearer(auto_error=False)

SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")

def get_current_user_id(credentials: HTTPAuthorizationCredentials = Security(security_scheme)) -> str:
    """
    HTTP Authorization 헤더에서 Bearer 토큰을 추출해 Supabase JWT Secret으로 검증하고 user_id(sub)를 반환합니다.
    """
    if not credentials:
        # 인증 헤더가 누락된 경우
        # 로컬 테스트 편의를 위해 환경변수가 설정되지 않은 경우 더미 유저 사용 허용
        if not SUPABASE_JWT_SECRET or SUPABASE_JWT_SECRET == "your-jwt-secret":
            print("Warning: Authorization header missing and JWT secret is placeholder. Using dummy_user_id for testing.")
            return "00000000-0000-0000-0000-000000000000"
        raise HTTPException(status_code=401, detail="Authorization header is missing")

    token = credentials.credentials
    
    # 디버그 모드나 설정이 안 된 경우의 예외 처리
    if not SUPABASE_JWT_SECRET or SUPABASE_JWT_SECRET == "your-jwt-secret":
        print("Warning: SUPABASE_JWT_SECRET is placeholder or missing. Skipping verification and using token content as user_id or dummy.")
        # 만약 토큰 형식이 UUID 규격이면 그대로 쓰고, 아니면 더미 반환
        if len(token) > 10:
            return token
        return "00000000-0000-0000-0000-000000000000"

    try:
        # Supabase Auth JWT 검증 (HS256, aud는 기본적으로 'authenticated'임)
        payload = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False}
        )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token payload: missing sub")
        return user_id
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
