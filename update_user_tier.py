# 임시 사용자 등급 승격 스크립트
# 4jussociety@gmail.com 사용자의 프로필 등급을 pro로 수동 업데이트합니다.

import os
from supabase import create_client
import jwt
from dotenv import load_dotenv

load_dotenv("c:/Tools4thept/.env")

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_ANON_KEY")
jwt_secret = os.getenv("SUPABASE_JWT_SECRET")

decoded_anon = jwt.decode(key, options={"verify_signature": False})
payload = decoded_anon.copy()
payload["role"] = "service_role"
service_role_token = jwt.encode(payload, jwt_secret, algorithm="HS256")

supabase = create_client(url, service_role_token)

user_id = "a26393f0-8e11-497f-80d0-656b11d6ab93"

print(f"Updating user profile tier to 'pro' for ID: {user_id}...")
try:
    res = supabase.table("profiles").update({
        "tier": "pro",
        "quota_limit": 1800000, # 30,000분
        "quota_used": 0
    }).eq("id", user_id).execute()
    print("Update result:")
    print(res.data)
except Exception as e:
    print(f"Failed to update user profile: {e}")
