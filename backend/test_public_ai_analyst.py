import os
import sys
import httpx
import asyncio
import uuid
import datetime
from dotenv import load_dotenv

try:
    sys.stdout.reconfigure(encoding='utf-8')
except AttributeError:
    pass

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
BACKEND_URL = "http://localhost:8000"

USER_EMAIL = os.getenv("TEST_USER_EMAIL", "")
USER_PASSWORD = os.getenv("TEST_USER_PASSWORD", "")

async def authenticate_user():
    print(f"[AUTH] Autenticando usuário {USER_EMAIL}...")
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Content-Type": "application/json"
    }
    signin_url = f"{SUPABASE_URL}/auth/v1/token?grant_type=password"
    
    async with httpx.AsyncClient() as client:
        res = await client.post(
            signin_url,
            headers=headers,
            json={"email": USER_EMAIL, "password": USER_PASSWORD}
        )
        if res.status_code != 200:
            raise RuntimeError(f"Falha ao autenticar usuário de teste: {res.text}")
        data = res.json()
        return data.get("access_token"), data.get("user", {}).get("id")

async def create_temp_table(table_id: str, user_id: str, token: str, name: str):
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    url = f"{SUPABASE_URL}/rest/v1/coin_tables"
    payload = {
        "id": table_id,
        "user_id": user_id,
        "name": name,
        "goals": {
            "dailyGoals": {"2026": 200.0},
            "weeklyGoals": {"2026": 1000.0},
            "annualCosts": {"2026": 50000.0}
        },
        "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }
    async with httpx.AsyncClient() as client:
        res = await client.post(url, json=payload, headers=headers)
        if res.status_code not in (200, 201):
            raise RuntimeError(f"Erro ao criar planilha temporária no banco: {res.text}")
        print(f"[DB] Planilha temporária criada: {table_id} ({name})")

async def insert_sample_transaction(table_id: str, token: str, desc: str, val: float, dt: str):
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    url = f"{SUPABASE_URL}/rest/v1/transactions"
    tx_id = f"tx_test_{uuid.uuid4().hex[:12]}"
    payload = {
        "id": tx_id,
        "table_id": table_id,
        "date": dt,
        "value": abs(val),
        "description": desc,
        "entry_type": "revenue" if val > 0 else "expense",
        "generated_by": "test_setup",
        "updated_at": datetime.datetime.utcnow().isoformat()
    }
    async with httpx.AsyncClient() as client:
        res = await client.post(url, json=payload, headers=headers)
        if res.status_code not in (200, 201):
            raise RuntimeError(f"Erro ao criar transação de teste: {res.text}")

async def delete_temp_table(table_id: str, token: str):
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {token}"
    }
    url = f"{SUPABASE_URL}/rest/v1/coin_tables?id=eq.{table_id}"
    async with httpx.AsyncClient() as client:
        res = await client.delete(url, headers=headers)
        if res.status_code not in (200, 204):
            print(f"[WARNING] Erro ao limpar planilha {table_id}: {res.text}")
        else:
            print(f"[DB] Planilha temporária excluída: {table_id}")

async def run_tests():
    print("======================================================================")
    print("        Assistente Moeda: Teste de Rota Pública AI Analyst            ")
    print("======================================================================\n")

    token, user_id = await authenticate_user()
    table_id = f"test_ai_{uuid.uuid4().hex[:12]}"
    
    try:
        # 1. Criar planilha e inserir dados de exemplo
        await create_temp_table(table_id, user_id, token, "Planilha IA Test")
        await insert_sample_transaction(table_id, token, "Faturamento Projeto A", 1200.0, "2026-07-10")
        await insert_sample_transaction(table_id, token, "Hospedagem Servidor", -150.0, "2026-07-12")
        
        # 2. Gerar Chave de API
        headers_auth = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        gen_url = f"{BACKEND_URL}/api/v1/api-keys/generate"
        async with httpx.AsyncClient() as client:
            res = await client.post(
                gen_url,
                json={"table_id": table_id, "permissions": "read:write"},
                headers=headers_auth
            )
            assert res.status_code == 200, f"Falha na geração: {res.status_code} - {res.text}"
            api_key = res.json().get("api_key")
            print(f"[OK] Chave de API gerada com sucesso.")
            
            # 3. Testar GET /analysis-context
            print("\n[TESTE 1] Testando endpoint de contexto público (GET /analysis-context)...")
            ctx_url = f"{BACKEND_URL}/api/v1/public/analysis-context?as_of_date=2026-07-15"
            res_ctx = await client.get(ctx_url, headers={"X-Spreadsheet-Key": api_key})
            assert res_ctx.status_code == 200, f"Falha ao obter contexto: {res_ctx.status_code} - {res_ctx.text}"
            ctx_data = res_ctx.json()
            assert "context" in ctx_data, "Faltando campo context no json."
            assert "CONTEXTO FINANCEIRO" in ctx_data["context"], "Contexto não estruturado corretamente."
            print(f"[OK] Contexto obtido com sucesso.")
            
            # 4. Testar POST /ai-analyst - Pergunta simples (Sem alteração)
            print("\n[TESTE 2] Testando POST /ai-analyst com pergunta de leitura...")
            analyst_url = f"{BACKEND_URL}/api/v1/public/ai-analyst"
            res_prompt = await client.post(
                analyst_url,
                json={"userPrompt": "Qual é o faturamento bruto operacional?", "asOfDate": "2026-07-15"},
                headers={"X-Spreadsheet-Key": api_key}
            )
            assert res_prompt.status_code == 200, f"Falha no analista público: {res_prompt.status_code} - {res_prompt.text}"
            res_data = res_prompt.json()
            assert "content" in res_data
            assert "model_used" in res_data or "modelUsed" in res_data
            print(f"[IA RESPONSE]:\n{res_data['content']}\n")
            print(f"[OK] Pergunta de leitura respondida.")
            
            # 5. Testar POST /ai-analyst - Ação executiva (God Mode Write)
            print("\n[TESTE 3] Testando POST /ai-analyst com comando de inserção (God Mode)...")
            res_action = await client.post(
                analyst_url,
                json={"userPrompt": "Adicione um gasto de R$ 180.50 com o item Alimentação no dia 2026-07-14.", "asOfDate": "2026-07-15"},
                headers={"X-Spreadsheet-Key": api_key}
            )
            assert res_action.status_code == 200, f"Falha no analista em modo escrita: {res_action.status_code} - {res_action.text}"
            action_data = res_action.json()
            print(f"[IA RESPONSE]:\n{action_data['content']}\n")
            assert "Ação executada com sucesso" in action_data["content"] or "sucesso" in action_data["content"].lower(), "O interceptor de escrita falhou."
            
            # 6. Validar no banco de dados se a transação existe
            print("\n[TESTE 4] Validando se a transação foi salva no banco de dados...")
            txs_url = f"{SUPABASE_URL}/rest/v1/transactions?table_id=eq.{table_id}"
            headers = {
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": f"Bearer {token}"
            }
            res_txs = await client.get(txs_url, headers=headers)
            print(f"[DEBUG GET TXS] status={res_txs.status_code} body={res_txs.text}")
            assert res_txs.status_code == 200
            txs = res_txs.json()
            found_tx = None
            for tx in txs:
                if tx.get("description") == "Alimentação" and abs(tx.get("value", 0.0) - 180.50) < 0.01:
                    found_tx = tx
                    break
            
            assert found_tx is not None, "Transação adicionada pela IA não localizada no banco!"
            assert (found_tx.get("entryType") or found_tx.get("entry_type")) == "expense", "Tipo de entrada incorreto."
            assert found_tx.get("date") == "2026-07-14", "Data da transação incorreta."
            assert (found_tx.get("generatedBy") or found_tx.get("generated_by")) == "public_api_ai", "Marcador de gerador inválido."
            print(f"[OK] Transação gravada com sucesso via God Mode no banco!")
            
            # 7. Testar GET /analysis-context com filtragem temporal (TESTE 5)
            print("\n[TESTE 5] Testando filtragem temporal (start_date e end_date)...")
            await insert_sample_transaction(table_id, token, "Faturamento Janeiro", 1000.0, "2026-01-15")
            await insert_sample_transaction(table_id, token, "Hospedagem Fevereiro", -200.0, "2026-02-15")
            await insert_sample_transaction(table_id, token, "Assinatura Março", -300.0, "2026-03-15")

            filtered_ctx_url = f"{BACKEND_URL}/api/v1/public/analysis-context?as_of_date=2026-07-15&start_date=2026-02-01&end_date=2026-02-28"
            res_fctx = await client.get(filtered_ctx_url, headers={"X-Spreadsheet-Key": api_key})
            assert res_fctx.status_code == 200, f"Falha na filtragem temporal: {res_fctx.status_code} - {res_fctx.text}"
            fctx_data = res_fctx.json()
            fctx_text = fctx_data["context"]

            # Verificações da filtragem temporal:
            assert "Hospedagem Fevereiro" in fctx_text, "A transação de Fevereiro deveria estar presente no contexto filtrado."
            assert "Faturamento Janeiro" not in fctx_text, "A transação de Janeiro foi incorretamente incluída no contexto temporal."
            assert "Assinatura Março" not in fctx_text, "A transação de Março foi incorretamente incluída no contexto temporal."
            print(f"[OK] Filtragem temporal validada com sucesso! Transações filtradas corretamente no ledger.")
            
    finally:
        # Cleanup
        await delete_temp_table(table_id, token)

if __name__ == "__main__":
    asyncio.run(run_tests())
