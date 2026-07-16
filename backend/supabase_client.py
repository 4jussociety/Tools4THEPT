import os
import jwt
from supabase import create_client, Client

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")

supabase_client: Client = None

if SUPABASE_URL and SUPABASE_ANON_KEY:
    # 플레이스홀더 값이 아닐 때만 실제 클라이언트 생성
    if not (SUPABASE_URL.startswith("https://your-project") or SUPABASE_ANON_KEY == "your-anon-key"):
        try:
            # Generate service role token if JWT secret is available to run backend operations with full privilege
            if SUPABASE_JWT_SECRET:
                try:
                    decoded_anon = jwt.decode(SUPABASE_ANON_KEY, options={"verify_signature": False})
                    payload = decoded_anon.copy()
                    payload["role"] = "service_role"
                    service_role_token = jwt.encode(payload, SUPABASE_JWT_SECRET, algorithm="HS256")
                    supabase_client = create_client(SUPABASE_URL, service_role_token)
                    print("Supabase client initialized with dynamic service_role token.")
                except Exception as jwt_err:
                    print(f"Error generating service_role token, falling back to anon key: {jwt_err}")
                    supabase_client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
            else:
                supabase_client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
        except Exception as e:
            print(f"Error initializing Supabase client: {e}")
    else:
        print("Warning: Supabase credentials are placeholder values in .env. Supabase client is not initialized.")
else:
    print("Warning: Supabase URL or Anon Key is missing in .env.")

def get_supabase() -> Client:
    if supabase_client is None:
        raise ValueError("Supabase client is not initialized. Please configure valid SUPABASE_URL and SUPABASE_ANON_KEY in .env.")
    return supabase_client

