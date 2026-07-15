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

with httpx.Client() as client:
    res = client.get(f"{supabase_url}/rest/v1/", headers=headers)
    if res.status_code == 200:
        schema = res.json()
        definitions = schema.get("definitions", {})
        keys_def = definitions.get("spreadsheet_api_keys", {})
        print("spreadsheet_api_keys definition:")
        print(keys_def)
    else:
        print("Error fetching schema:", res.status_code, res.text)
