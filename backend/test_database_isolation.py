import os
import random
import httpx
import asyncio
from dotenv import load_dotenv

# Load env variables from backend/.env
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
BACKEND_URL = "http://localhost:8000"

USER_A_ID = "19a9721b-00e5-4427-a3af-88a0d75b8734"  # Victim ID from database
USER_A_TABLE_ID = "1782659472010-iobwzh0"           # Victim Table ID

# Use confirmed test credentials for the Attacker (USER_B)
USER_B_EMAIL = "augustoheiss02@gmail.com"
USER_B_PASSWORD = "Link1703@"

async def authenticate_attacker():
    """Sign up and sign in a new attacker user account to obtain their JWT token."""
    print(f"Creating mock Attacker (USER_B) account: {USER_B_EMAIL}...")
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Content-Type": "application/json"
    }
    
    async with httpx.AsyncClient() as client:
        # Step 1: Sign up the attacker
        signup_url = f"{SUPABASE_URL}/auth/v1/signup"
        try:
            signup_res = await client.post(
                signup_url, 
                headers=headers, 
                json={"email": USER_B_EMAIL, "password": USER_B_PASSWORD}
            )
            if signup_res.status_code in (200, 201):
                print("[INFO] Attacker signup successful.")
            else:
                print(f"[INFO] Attacker signup returned code {signup_res.status_code} (User might already exist).")
        except Exception as e:
            print(f"[WARNING] Signup exception: {e}")

        # Step 2: Sign in to get JWT token
        signin_url = f"{SUPABASE_URL}/auth/v1/token?grant_type=password"
        signin_res = await client.post(
            signin_url,
            headers=headers,
            json={"email": USER_B_EMAIL, "password": USER_B_PASSWORD}
        )
        if signin_res.status_code != 200:
            raise RuntimeError(f"Failed to authenticate Attacker: {signin_res.text}")
        
        data = signin_res.json()
        jwt_token = data.get("access_token")
        user_id = data.get("user", {}).get("id")
        print(f"[SUCCESS] Attacker authenticated. UUID: {user_id}")
        return jwt_token, user_id

async def test_scenario_1_rls_bypass(attacker_jwt):
    """Scenario 1: Attacker tries to query USER_A's financial tables directly via Supabase client REST API."""
    print("\n----------------------------------------------------------------------")
    print("SCENARIO 1: Direct Table Bypassing via Supabase Client (RLS Test)")
    print("----------------------------------------------------------------------")
    
    # We query Supabase REST API acting as the Attacker (using Attacker's JWT)
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {attacker_jwt}",
        "Content-Type": "application/json"
    }
    
    # Try to fetch coin_tables filtering directly for USER_A's UUID
    query_url_1 = f"{SUPABASE_URL}/rest/v1/coin_tables?user_id=eq.{USER_A_ID}&select=*"
    # Try to fetch specific table owned by USER_A
    query_url_2 = f"{SUPABASE_URL}/rest/v1/coin_tables?id=eq.{USER_A_TABLE_ID}&select=*"
    
    async with httpx.AsyncClient() as client:
        # Check target 1: All tables of User A
        res1 = await client.get(query_url_1, headers=headers)
        assert res1.status_code == 200, f"Expected 200, got {res1.status_code}"
        data1 = res1.json()
        print(f"Attacker queried USER_A's tables. Result: {data1}")
        assert len(data1) == 0, f"SECURITY VIOLATION! Attacker read USER_A's tables: {data1}"
        print("[SUCCESS] RLS successfully blocked direct query of USER_A's tables (returned empty list).")

        # Check target 2: Specific table of User A
        res2 = await client.get(query_url_2, headers=headers)
        assert res2.status_code == 200, f"Expected 200, got {res2.status_code}"
        data2 = res2.json()
        print(f"Attacker queried specific Table {USER_A_TABLE_ID}. Result: {data2}")
        assert len(data2) == 0, f"SECURITY VIOLATION! Attacker read USER_A's specific table: {data2}"
        print("[SUCCESS] RLS successfully blocked direct access to Table ID 1782659472010-iobwzh0.")

async def test_scenario_2_endpoint_leak(attacker_jwt):
    """Scenario 2: Attacker queries FastAPI ai-analyst endpoint passing USER_A's table_id in the body payload."""
    print("\n----------------------------------------------------------------------")
    print("SCENARIO 2: API Endpoint Data Leaking (FastAPI Layer Check)")
    print("----------------------------------------------------------------------")
    
    analyst_url = f"{BACKEND_URL}/api/coin/ai-analyst"
    
    # Construct payload with User A's table ID
    payload = {
        "userPrompt": "Analyze my monthly cashflow trend and suggest optimizations.",
        "tables": [{"id": USER_A_TABLE_ID, "name": "Planilah Confidencial", "user_id": USER_A_ID}],
        "transactions": []
    }
    
    # Authenticate header with Attacker's JWT
    headers = {
        "Authorization": f"Bearer {attacker_jwt}",
        "Content-Type": "application/json"
    }
    
    async with httpx.AsyncClient() as client:
        res = await client.post(analyst_url, headers=headers, json=payload)
        print(f"FastAPI Response Code: {res.status_code}")
        print(f"FastAPI Response Body: {res.text}")
        
        # We expect a strict 403 Forbidden response
        assert res.status_code == 403, f"Expected 403 Forbidden, got {res.status_code}"
        assert "Acesso negado" in res.json().get("detail", ""), "Expected 'Acesso negado' message in response detail."
        print("[SUCCESS] FastAPI successfully blocked cross-user analysis, returning 403 Forbidden.")

async def run_penetration_test():
    print("======================================================================")
    print("               LogicDefense Data Isolation PenTest Suite               ")
    print("======================================================================\n")
    
    try:
        # Pre-requisite checks
        if not SUPABASE_URL or not SUPABASE_ANON_KEY or not SUPABASE_SERVICE_ROLE_KEY:
            raise ValueError("Missing Supabase credentials in environment variables.")

        # Authenticate USER_B (Attacker)
        attacker_jwt, attacker_uid = await authenticate_attacker()
        
        # Run tests
        await test_scenario_1_rls_bypass(attacker_jwt)
        await test_scenario_2_endpoint_leak(attacker_jwt)
        
        print("\n======================================================================")
        print("               [SUCCESS] ALL DATA ISOLATION TESTS PASSED              ")
        print("======================================================================")
        
    except AssertionError as ae:
        print("\n======================================================================")
        print(f"               [FAILURE] SECURITY BREACH DETECTED: {ae}               ")
        print("======================================================================")
        exit(2)
    except Exception as e:
        print(f"\n[ERROR] Test suite execution aborted due to unexpected error: {e}")
        exit(1)

if __name__ == "__main__":
    asyncio.run(run_penetration_test())
