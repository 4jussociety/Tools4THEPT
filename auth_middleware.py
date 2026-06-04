import os
import jwt
from fastapi import HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security_scheme = HTTPBearer(auto_error=False)

SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")

def _extract_sub_from_jwt(token: str) -> str | None:
    """JWT 토큰에서 서명 검증 없이 sub(사용자 UUID)를 추출합니다."""
    try:
        payload = jwt.decode(token, options={"verify_signature": False}, algorithms=["HS256"])
        return payload.get("sub")
    except Exception as e:
        print(f"Error decoding JWT without verification: {e}")
        return None

def get_current_user_id(credentials: HTTPAuthorizationCredentials = Security(security_scheme)) -> str:
    """
    HTTP Authorization 헤더에서 Bearer 토큰을 추출해 Supabase JWT Secret으로 검증하고 user_id(sub)를 반환합니다.
    """
    if not credentials:
        # 인증 헤더가 누락된 경우
        if not SUPABASE_JWT_SECRET or SUPABASE_JWT_SECRET == "your-jwt-secret":
            print("Warning: Authorization header missing and JWT secret is placeholder. Using dummy_user_id for testing.")
            return "00000000-0000-0000-0000-000000000000"
        raise HTTPException(status_code=401, detail="Authorization header is missing")

    token = credentials.credentials
    
    # JWT Secret이 설정되지 않은 경우: 서명 미검증 모드 (개발용)
    if not SUPABASE_JWT_SECRET or SUPABASE_JWT_SECRET == "your-jwt-secret":
        print("Warning: SUPABASE_JWT_SECRET is not configured. Running in unverified mode.")
        user_id = _extract_sub_from_jwt(token)
        if user_id:
            print(f"  Extracted user_id (unverified): {user_id}")
            return user_id
        # JWT 디코딩에 실패한 경우 (더미 토큰 등)
        print("  Failed to extract sub from JWT. Returning dummy user_id.")
        return "00000000-0000-0000-0000-000000000000"

    # JWT Secret이 설정된 경우: 정식 검증 모드
    try:
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
        # 토큰 만료 시에도 sub를 추출하여 로그아웃은 가능하게 함
        user_id = _extract_sub_from_jwt(token)
        if user_id:
            print(f"Warning: Token expired but extracted user_id for graceful handling: {user_id}")
            return user_id
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
