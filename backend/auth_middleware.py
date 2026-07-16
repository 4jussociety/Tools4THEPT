import os
import base64
import json
import jwt
import httpx
from jwt.algorithms import ECAlgorithm
from fastapi import HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security_scheme = HTTPBearer(auto_error=False)

# JWKS 공개키 캐시 (ES256 검증용, 서버 실행 중 1회만 가져옴)
_jwks_cache: dict | None = None

def _get_jwks_public_key():
    """Supabase JWKS 엔드포인트에서 ES256 공개키를 가져와 캐싱합니다."""
    global _jwks_cache
    if _jwks_cache is not None:
        return _jwks_cache
    
    supabase_url = os.getenv("SUPABASE_URL", "")
    if not supabase_url:
        print("Warning: SUPABASE_URL is not set. Cannot fetch JWKS.")
        return None
    
    jwks_url = f"{supabase_url}/auth/v1/.well-known/jwks.json"
    try:
        response = httpx.get(jwks_url, timeout=10)
        response.raise_for_status()
        jwks_data = response.json()
        
        keys = jwks_data.get("keys", [])
        for key_data in keys:
            if key_data.get("alg") == "ES256" and key_data.get("kty") == "EC":
                # JWK → PEM 공개키 변환
                public_key = ECAlgorithm(ECAlgorithm.SHA256).from_jwk(json.dumps(key_data))
                _jwks_cache = public_key
                print(f"JWKS: ES256 공개키 로드 완료 (kid: {key_data.get('kid', 'N/A')})")
                return _jwks_cache
        
        print("Warning: No ES256 key found in JWKS response.")
        return None
    except Exception as e:
        print(f"Warning: Failed to fetch JWKS from {jwks_url}: {e}")
        return None

def _get_decoded_jwt_secret() -> bytes | str:
    """Base64-decodes SUPABASE_JWT_SECRET if possible, falling back to the raw string."""
    secret_str = os.getenv("SUPABASE_JWT_SECRET", "")
    if not secret_str or secret_str == "your-jwt-secret":
        return secret_str
    try:
        padded = secret_str
        missing_padding = len(padded) % 4
        if missing_padding:
            padded += '=' * (4 - missing_padding)
        return base64.b64decode(padded)
    except Exception as e:
        print(f"Warning: Failed to base64-decode SUPABASE_JWT_SECRET ({e}). Using raw string.")
        return secret_str

def _extract_sub_from_jwt(token: str) -> str | None:
    """JWT 토큰에서 서명 검증 없이 sub(사용자 UUID)를 추출합니다."""
    try:
        payload = jwt.decode(token, options={"verify_signature": False}, algorithms=["HS256", "ES256"])
        return payload.get("sub")
    except Exception as e:
        print(f"Error decoding JWT without verification: {e}")
        return None

def _detect_token_algorithm(token: str) -> str | None:
    """JWT 토큰의 헤더에서 알고리즘(alg)을 추출합니다."""
    try:
        header = jwt.get_unverified_header(token)
        return header.get("alg")
    except Exception:
        return None

def get_current_user_id(credentials: HTTPAuthorizationCredentials = Security(security_scheme)) -> str:
    """
    HTTP Authorization 헤더에서 Bearer 토큰을 추출해 Supabase JWT로 검증하고 user_id(sub)를 반환합니다.
    ES256(ECDSA)과 HS256(HMAC) 두 알고리즘을 모두 지원합니다.
    """
    secret_str = os.getenv("SUPABASE_JWT_SECRET", "")
    
    # DB Foreign Key 제약조건(profiles.id -> auth.users.id)을 만족하기 위해, 
    # 로컬 개발/Mock 환경에서는 DB에 존재하는 실제 사용자 ID를 더미 ID로 사용합니다.
    DUMMY_USER_ID = "5deba64e-7549-4cd7-a903-1a395332f03a"

    if not credentials:
        # 인증 헤더가 누락된 경우
        if not secret_str or secret_str == "your-jwt-secret":
            print("Warning: Authorization header missing and JWT secret is placeholder. Using dummy_user_id for testing.")
            return DUMMY_USER_ID
        raise HTTPException(status_code=401, detail="Authorization header is missing")

    token = credentials.credentials
    
    # JWT Secret이 설정되지 않은 경우: 서명 미검증 모드 (개발용)
    if not secret_str or secret_str == "your-jwt-secret":
        print("Warning: SUPABASE_JWT_SECRET is not configured. Running in unverified mode.")
        user_id = _extract_sub_from_jwt(token)
        if user_id:
            print(f"  Extracted user_id (unverified): {user_id}")
            return user_id
        print("  Failed to extract sub from JWT. Returning dummy user_id.")
        return DUMMY_USER_ID

    # JWT Secret이 설정된 경우: 정식 검증 모드
    # 로컬 Mocking용 더미 토큰 바이패스 처리
    if token == "00000000-0000-0000-0000-000000000000":
        print("Warning: Dummy token detected. Returning dummy user_id mappings.")
        return DUMMY_USER_ID

    # 토큰 헤더의 alg 값을 확인하여 적절한 키와 알고리즘으로 검증
    alg = _detect_token_algorithm(token)
    
    try:
        if alg == "ES256":
            # ES256: Supabase JWKS 공개키로 ECDSA 서명 검증
            public_key = _get_jwks_public_key()
            if not public_key:
                print("Warning: ES256 token received but JWKS public key unavailable. Falling back to unverified mode.")
                user_id = _extract_sub_from_jwt(token)
                if user_id:
                    return user_id
                raise HTTPException(status_code=401, detail="Failed to verify ES256 token: JWKS unavailable")
            
            payload = jwt.decode(
                token,
                public_key,
                algorithms=["ES256"],
                options={"verify_aud": False}
            )
        else:
            # HS256: Base64 디코딩된 JWT Secret으로 HMAC 서명 검증
            secret = _get_decoded_jwt_secret()
            payload = jwt.decode(
                token,
                secret,
                algorithms=["HS256"],
                options={"verify_aud": False}
            )
        
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token payload: missing sub")
        return user_id
    except jwt.ExpiredSignatureError as e:
        print(f"JWT Verification Error (Expired): {e}")
        # 보안 강화: 만료된 토큰인 경우 무조건 인증을 거부하고 401 에러를 반환
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError as e:
        print(f"JWT Verification Error (Invalid): {e}, token: {token[:15]}...{token[-15:] if len(token) > 30 else ''}")
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")


