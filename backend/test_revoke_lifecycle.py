"""
Ponta a ponta: Teste de Geração -> Validação -> Revogação Instantânea (Kill-Switch) -> Bloqueio 401 -> Idempotência
"""
import sys
import os

# Adjust path so backend modules can be imported
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_full_revoke_lifecycle():
    print("\n========================================================")
    print("[TEST] INICIANDO TESTE DO KILL-SWITCH & CICLO DE REVOGACAO")
    print("========================================================")

    test_table_id = "test_sheet_kill_switch_999"

    # 1. GERAÇÃO DA CHAVE
    print("\n[Passo 1] Gerando nova chave de API temporaria (TTL: 1 dia)...")
    gen_res = client.post("/api/v1/api-keys/generate", json={
        "table_id": test_table_id,
        "ttl_days": 1,
        "permissions": "read:write"
    })
    assert gen_res.status_code == 200, f"Falha ao gerar chave: {gen_res.text}"
    gen_data = gen_res.json()
    api_key = gen_data["apiKey"]
    hint = gen_data["keyHint"]
    print(f"  [OK] Chave gerada com sucesso: {api_key[:20]}... (Hint: {hint})")
    assert api_key.startswith("am_sheet_live_")

    # 2. VALIDAÇÃO ATIVA (200 OK)
    print("\n[Passo 2] Validando chave ativa...")
    val_res = client.post("/api/v1/api-keys/validate", json={"apiKey": api_key})
    assert val_res.status_code == 200, f"Falha ao validar chave: {val_res.text}"
    print("  [OK] Validacao /api/v1/api-keys/validate: 200 OK (Chave Ativa)")

    # 2b. Teste de Acesso à Rota Pública de Contexto de Análise
    ctx_res = client.get("/api/v1/public/analysis-context", headers={"X-Spreadsheet-Key": api_key})
    assert ctx_res.status_code == 200, f"Falha ao acessar analysis-context: {ctx_res.text}"
    print(f"  [OK] Acesso a /analysis-context autorizado: 200 OK ({len(ctx_res.text)} chars)")

    # 3. REVOGAÇÃO IMEDIATA (KILL-SWITCH)
    print("\n[Passo 3] Disparando Kill-Switch (POST /api/v1/api-keys/revoke)...")
    rev_res = client.post("/api/v1/api-keys/revoke", json={
        "tableId": test_table_id,
        "apiKey": api_key
    }, headers={"X-Spreadsheet-Key": api_key})
    assert rev_res.status_code == 200, f"Falha ao revogar: {rev_res.text}"
    rev_data = rev_res.json()
    print(f"  [OK] Resposta da revogacao: {rev_data}")
    assert rev_data["success"] is True
    assert rev_data["alreadyInactive"] is False

    # 4. TESTE DE BLOQUEIO ABSOLUTO (401 UNAUTHORIZED)
    print("\n[Passo 4] Validando que a chave revogada e IMEDIATAMENTE bloqueada...")
    
    # 4a. Rota de Validação
    val_blocked = client.post("/api/v1/api-keys/validate", json={"apiKey": api_key})
    assert val_blocked.status_code == 401, f"Deveria ser 401, obteve: {val_blocked.status_code}"
    print(f"  [OK] /api/v1/api-keys/validate -> 401 Unauthorized ({val_blocked.json()})")

    # 4b. Rota /analysis-context
    ctx_blocked = client.get("/api/v1/public/analysis-context", headers={"X-Spreadsheet-Key": api_key})
    assert ctx_blocked.status_code == 401, f"Deveria ser 401, obteve: {ctx_blocked.status_code}"
    print(f"  [OK] /api/v1/public/analysis-context -> 401 Unauthorized ({ctx_blocked.json()})")

    # 4c. Rota /summary
    sum_blocked = client.get("/api/v1/public/summary", headers={"X-Spreadsheet-Key": api_key})
    assert sum_blocked.status_code == 401, f"Deveria ser 401, obteve: {sum_blocked.status_code}"
    print(f"  [OK] /api/v1/public/summary -> 401 Unauthorized ({sum_blocked.json()})")

    # 4d. Rota Root / com Header
    root_blocked = client.get("/", headers={"X-Spreadsheet-Key": api_key})
    assert root_blocked.status_code == 401, f"Deveria ser 401, obteve: {root_blocked.status_code}"
    print(f"  [OK] GET / -> 401 Unauthorized ({root_blocked.json()})")

    # 5. TESTE DE IDEMPOTÊNCIA (REVOGAÇÃO DUPLA)
    print("\n[Passo 5] Testando idempotencia (revogacao repetida)...")
    rev_repeat = client.post("/api/v1/api-keys/revoke", json={
        "tableId": test_table_id,
        "apiKey": api_key
    })
    assert rev_repeat.status_code == 200, f"Deveria ser 200 OK na segunda revogacao, obteve: {rev_repeat.status_code}"
    rev_repeat_data = rev_repeat.json()
    print(f"  [OK] Resposta de revogacao repetida: {rev_repeat_data}")
    assert rev_repeat_data["success"] is True
    assert rev_repeat_data["alreadyInactive"] is True

    print("\n========================================================")
    print("[SUCESSO] TODOS OS 5 TESTES DO KILL-SWITCH PASSARAM!")
    print("========================================================\n")

if __name__ == "__main__":
    test_full_revoke_lifecycle()
