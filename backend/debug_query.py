import os
import httpx
from dotenv import load_dotenv

load_dotenv()
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

headers = {
    "apikey": supabase_key,
    "Authorization": f"Bearer {supabase_key}"
}

print("URL:", supabase_url)
print("KEY exists:", bool(supabase_key))

with httpx.Client() as client:
    res = client.get(f"{supabase_url}/rest/v1/coin_tables?select=*", headers=headers)
    print("STATUS:", res.status_code)
    try:
        print("BODY:", res.json()[:5])
    except Exception:
        print("BODY:", res.text)
