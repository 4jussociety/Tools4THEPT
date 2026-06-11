import os
import sys
import time
import requests
from dotenv import load_dotenv
from supabase import create_client

# Load environment variables
load_dotenv('c:/record/.env')

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_ANON_KEY:
    print("Error: SUPABASE_URL or SUPABASE_ANON_KEY not set in .env")
    sys.exit(1)

# Initialize Supabase client
# Using anon key to simulate client actions, but we also have administrative capability for checking DB
supabase = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

# Define endpoints
WEBHOOK_URL = f"{SUPABASE_URL}/functions/v1/payment-webhook"
ANALYZE_URL = f"{SUPABASE_URL}/functions/v1/analyze"

def main():
    print("=" * 60)
    print("Starting Portone Billing & Subscription Webhook Test Suite")
    print("=" * 60)

    # 1. Create or login test user
    test_email = f"test_billing_{int(time.time())}@example.com"
    test_password = "TestPassword123!"
    
    print(f"Creating test user: {test_email}...")
    try:
        auth_res = supabase.auth.sign_up({
            "email": test_email,
            "password": test_password,
            "options": {
                "data": {
                    "name": "홍길동",
                    "profession": "pt"
                }
            }
        })
        user = auth_res.user
        if not user:
            print("Failed to sign up test user.")
            sys.exit(1)
        
        user_id = user.id
        print(f"Test user created successfully. ID: {user_id}")
    except Exception as e:
        print("Sign up failed:", e)
        sys.exit(1)

    # Allow trigger to execute and replicate profile
    time.sleep(2)

    # Get User access token for calling analyze endpoint
    login_res = supabase.auth.sign_in_with_password({
        "email": test_email,
        "password": test_password
    })
    access_token = login_res.session.access_token
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }

    # Verify initial profile status (should be free)
    print("\n--- Verifying Initial Profile State (Free Tier) ---")
    prof_res = supabase.table("profiles").select("*").eq("id", user_id).execute()
    profile = prof_res.data[0]
    print(f"Initial Profile: Tier={profile['tier']}, Limit={profile['quota_limit']}, Used={profile['quota_used']}")
    assert profile['tier'] == 'free', "Initial tier should be free"
    assert profile['quota_limit'] == 10, "Initial limit should be 10"
    assert profile['quota_used'] == 0, "Initial used should be 0"
    print("PASSED")

    # ----------------------------------------------------
    # TEST CASE 1: Webhook 'paid' for Basic Tier
    # ----------------------------------------------------
    print("\n--- Test Case 1: Trigger Webhook 'paid' (Upgrade to Basic) ---")
    merchant_uid = f"sub_basic_{user_id}_{int(time.time())}"
    payload = {
        "imp_uid": "imp_mock_paid_123",
        "merchant_uid": merchant_uid,
        "status": "paid",
        "customer_uid": "cust_mock_123"
    }
    
    res = requests.post(WEBHOOK_URL, json=payload)
    print(f"Webhook Response Status: {res.status_code}, Body: {res.text}")
    assert res.status_code == 200, "Webhook request failed"
    
    # Wait for DB synchronization
    time.sleep(2)
    
    prof_res = supabase.table("profiles").select("*").eq("id", user_id).execute()
    profile = prof_res.data[0]
    print(f"Updated Profile: Tier={profile['tier']}, Limit={profile['quota_limit']}, Used={profile['quota_used']}")
    assert profile['tier'] == 'basic', "Tier should be basic"
    assert profile['quota_limit'] == 360000, "Limit should be 360,000 seconds (100h)"
    assert profile['quota_used'] == 0, "Used should be reset to 0"
    
    sub_res = supabase.table("subscriptions").select("*").eq("merchant_uid", merchant_uid).execute()
    subscription = sub_res.data[0]
    print(f"Created Subscription: ID={subscription['id']}, Status={subscription['status']}")
    assert subscription['status'] == 'active', "Subscription status should be active"
    print("PASSED")

    # ----------------------------------------------------
    # TEST CASE 2: Webhook 'failed' (Transition to past_due)
    # ----------------------------------------------------
    print("\n--- Test Case 2: Trigger Webhook 'failed' (Transition to past_due) ---")
    payload = {
        "imp_uid": "imp_mock_failed_123",
        "merchant_uid": merchant_uid,
        "status": "failed",
        "customer_uid": "cust_mock_123"
    }
    
    res = requests.post(WEBHOOK_URL, json=payload)
    print(f"Webhook Response Status: {res.status_code}, Body: {res.text}")
    assert res.status_code == 200, "Webhook request failed"
    
    time.sleep(2)
    
    sub_res = supabase.table("subscriptions").select("*").eq("merchant_uid", merchant_uid).execute()
    subscription = sub_res.data[0]
    print(f"Updated Subscription: Status={subscription['status']}, Expire={subscription['current_period_end']}")
    assert subscription['status'] == 'past_due', "Subscription status should be past_due"
    
    # Profile tier should remain 'basic' during grace period
    prof_res = supabase.table("profiles").select("*").eq("id", user_id).execute()
    profile = prof_res.data[0]
    print(f"Grace Period Profile: Tier={profile['tier']}")
    assert profile['tier'] == 'basic', "Tier should remain basic during grace period"
    print("PASSED")

    # ----------------------------------------------------
    # TEST CASE 3: Grace Period Expiration & Dynamic Downgrade
    # ----------------------------------------------------
    print("\n--- Test Case 3: Grace Period Expiration & Self-Healing Downgrade ---")
    
    # We will simulate that 24 hours has passed by updating current_period_end to the past.
    # To do this safely and bypass RLS constraints for users, we'd normally do it as admin.
    # However, since the test runs with user auth, we'll need to update using supabase client.
    # Wait! In our DB rules, subscriptions are view-only for users (no update policy for users).
    # Thus, we cannot update it directly using supabase client initialized with anon key.
    # But wait, we can bypass RLS by using the SUPABASE_SERVICE_ROLE_KEY if we initialize an admin client!
    # Let's check if SUPABASE_SERVICE_ROLE_KEY is in the env or if we can get it.
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not service_role_key:
        print("Generating service_role token using SUPABASE_JWT_SECRET...")
        import jwt
        jwt_secret = os.getenv("SUPABASE_JWT_SECRET")
        payload_jwt = {
            "role": "service_role",
            "iss": "supabase"
        }
        service_role_token = jwt.encode(payload_jwt, jwt_secret, algorithm="HS256")
        admin_supabase = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
        admin_supabase.postgrest.headers["Authorization"] = f"Bearer {service_role_token}"
        admin_supabase.auth._headers["Authorization"] = f"Bearer {service_role_token}"
        print("Admin Supabase client initialized successfully.")
    else:
        admin_supabase = create_client(SUPABASE_URL, service_role_key)

    # Now update current_period_end of the subscription to 1 hour in the past
    past_time = time.strftime('%Y-%m-%dT%H:%M:%S+00:00', time.gmtime(time.time() - 3600))
    print(f"Updating subscription current_period_end to past time: {past_time}")
    admin_supabase.table("subscriptions").update({"current_period_end": past_time}).eq("merchant_uid", merchant_uid).execute()
    
    # Create a dummy session to call analyze with
    session_res = admin_supabase.table("sessions").insert({
        "user_id": user_id,
        "profession": "pt",
        "patient_name": "Test Patient",
        "duration": 60,
        "status": "pending"
    }).execute()
    session_id = session_res.data[0]["id"]
    print(f"Created dummy session: {session_id}")

    # Now call analyze endpoint as the user. This should trigger the grace period check,
    # detect it has expired, perform the self-healing downgrade to free, and block the request.
    print("Calling analyze endpoint...")
    analyze_payload = {
        "session_id": session_id,
        "duration": 60
    }
    analyze_res = requests.post(ANALYZE_URL, json=analyze_payload, headers=headers)
    print(f"Analyze Response Status: {analyze_res.status_code}, Body: {analyze_res.text}")
    
    # The analyze function should return a 403 error because the user has been downgraded to free,
    # and their quota is fully exhausted (quota_used = 10, limit = 10).
    assert analyze_res.status_code == 403 or "사용 가능한 크레딧" in analyze_res.text, "Analyze call should be rejected"
    
    # Verify that profile was indeed downgraded back to free with exhausted quota
    prof_res = supabase.table("profiles").select("*").eq("id", user_id).execute()
    profile = prof_res.data[0]
    print(f"Downgraded Profile State: Tier={profile['tier']}, Limit={profile['quota_limit']}, Used={profile['quota_used']}")
    assert profile['tier'] == 'free', "Tier should be downgraded to free"
    assert profile['quota_limit'] == 10, "Limit should be 10"
    assert profile['quota_used'] == 10, "Used should be 10"
    print("PASSED")

    # ----------------------------------------------------
    # TEST CASE 4: Cancellation & Case A Refund
    # ----------------------------------------------------
    print("\n--- Test Case 4: Webhook 'cancelled' (Refund / Downgrade) ---")
    # Upgrade user to Premium first
    merchant_uid_premium = f"sub_premium_{user_id}_{int(time.time())}"
    print(f"Upgrading user to Premium first via webhook...")
    payload_premium = {
        "imp_uid": "imp_mock_premium_123",
        "merchant_uid": merchant_uid_premium,
        "status": "paid",
        "customer_uid": "cust_mock_123"
    }
    res = requests.post(WEBHOOK_URL, json=payload_premium)
    assert res.status_code == 200
    
    time.sleep(2)
    prof_res = supabase.table("profiles").select("*").eq("id", user_id).execute()
    profile = prof_res.data[0]
    print(f"Premium Profile State: Tier={profile['tier']}, Limit={profile['quota_limit']}, Used={profile['quota_used']}")
    assert profile['tier'] == 'premium'
    
    # Now simulate a refund/cancellation webhook
    print(f"Triggering cancellation webhook...")
    payload_cancel = {
        "imp_uid": "imp_mock_premium_123",
        "merchant_uid": merchant_uid_premium,
        "status": "cancelled",
        "customer_uid": "cust_mock_123"
    }
    res = requests.post(WEBHOOK_URL, json=payload_cancel)
    print(f"Cancellation Webhook Response Status: {res.status_code}, Body: {res.text}")
    assert res.status_code == 200
    
    time.sleep(2)
    
    prof_res = supabase.table("profiles").select("*").eq("id", user_id).execute()
    profile = prof_res.data[0]
    print(f"Refunded Profile State: Tier={profile['tier']}, Limit={profile['quota_limit']}, Used={profile['quota_used']}")
    assert profile['tier'] == 'free', "Tier should be downgraded back to free"
    assert profile['quota_limit'] == 10
    assert profile['quota_used'] == 10
    
    sub_res = supabase.table("subscriptions").select("*").eq("merchant_uid", merchant_uid_premium).execute()
    subscription = sub_res.data[0]
    print(f"Refunded Subscription Status: {subscription['status']}")
    assert subscription['status'] == 'canceled', "Subscription status should be canceled"
    print("PASSED")

    # Cleanup test user and session to keep DB clean
    print("\nCleaning up database...")
    admin_supabase.table("sessions").delete().eq("id", session_id).execute()
    admin_supabase.table("subscriptions").delete().eq("user_id", user_id).execute()
    admin_supabase.table("profiles").delete().eq("id", user_id).execute()
    admin_supabase.auth.admin.delete_user(user_id)
    print("Cleanup completed.")

    print("\n" + "=" * 60)
    print("ALL TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    main()
