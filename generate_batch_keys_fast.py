import os
import sys
import secrets
import hashlib
import httpx
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv

# Load environment
env_path = os.path.join(os.path.dirname(__file__), "backend", ".env")
load_dotenv(env_path)
sys.path.append(os.path.join(os.path.dirname(__file__), "backend"))

from db.license_db import hash_key, get_turso_http_url, get_turso_token, is_turso_configured

def generate_key_list(tier_name: str, token_amount: int, count: int, valid_days: int | None = None, prefix: str = "am_pro"):
    keys = []
    now_dt = datetime.now(timezone.utc)
    now_str = now_dt.isoformat()
    expires_str = (now_dt + timedelta(days=valid_days)).isoformat() if valid_days else None

    for i in range(count):
        hex_token = secrets.token_hex(16)
        raw_key = f"{prefix}_{hex_token}"
        key_h = hash_key(raw_key)

        keys.append({
            "index": i + 1,
            "key": raw_key,
            "key_hash": key_h,
            "tier": tier_name,
            "tokens": token_amount,
            "expires_at": expires_str,
            "created_at": now_str
        })
    return keys

def insert_all_into_turso(all_keys: list[dict]):
    if not is_turso_configured():
        print("Turso nao configurado. Usando DB local.")
        return

    url = get_turso_http_url()
    token = get_turso_token()
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    # Quebrar em chunks de 50 para o pipeline
    chunk_size = 50
    for idx in range(0, len(all_keys), chunk_size):
        chunk = all_keys[idx:idx + chunk_size]
        requests_payload = []
        for k in chunk:
            args = [
                {"type": "text", "value": k["key"]},
                {"type": "text", "value": k["key_hash"]},
                {"type": "null"},
                {"type": "text", "value": k["tier"]},
                {"type": "integer", "value": str(k["tokens"])},
                {"type": "integer", "value": str(k["tokens"])},
                {"type": "text", "value": k["expires_at"]} if k["expires_at"] else {"type": "null"},
                {"type": "text", "value": "manual_pix_batch"},
                {"type": "text", "value": k["created_at"]},
                {"type": "text", "value": k["created_at"]}
            ]
            requests_payload.append({
                "type": "execute",
                "stmt": {
                    "sql": """INSERT OR IGNORE INTO license_keys (license_key, key_hash, email, tier, token_balance, token_cap, expires_at, stripe_customer_id, created_at, updated_at)
                              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    "args": args
                }
            })

        requests_payload.append({"type": "close"})
        payload = {"requests": requests_payload}

        with httpx.Client(timeout=30.0) as client:
            res = client.post(url, headers=headers, json=payload)
            if res.status_code not in (200, 201):
                print(f"Erro ao inserir chunk {idx}: {res.text}")
            else:
                print(f"Chunk {idx // chunk_size + 1}/{(len(all_keys) + chunk_size - 1) // chunk_size} gravado com sucesso no Turso Cloud!")

def main():
    print("Gerando 300 chaves de licença...")

    # 1. 100 Chaves de Recarga 100k
    recargas = generate_key_list("recarga", 100_000, 100, valid_days=None, prefix="am_token")

    # 2. 100 Chaves Mensais 1M
    mensais = generate_key_list("pro", 1_000_000, 100, valid_days=365, prefix="am_pro")

    # 3. 100 Chaves Anuais 12M
    anuais = generate_key_list("pro_yearly", 12_000_000, 100, valid_days=730, prefix="am_year")

    all_keys = recargas + mensais + anuais

    print(f"Gravando {len(all_keys)} chaves no banco de dados Turso Cloud...")
    insert_all_into_turso(all_keys)

    # Gerar Catálogo Markdown
    doc_lines = []
    doc_lines.append("# 🔑 Catálogo de Chaves de Licença Pro — CV Maker & Assistente Moeda")
    doc_lines.append(f"*Gerado em: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}*\n")
    doc_lines.append("> 💡 **Como Usar:** Quando um cliente pagar via **Pix / WhatsApp**, copie uma das chaves abaixo e envie para ele. Ele só precisa colar no campo **'Ativar Chave'** no site para desbloquear a IA instantaneamente!\n")
    doc_lines.append("---\n")

    # Seção 1
    doc_lines.append("## ⚡ Lote 1: Recarga Avulsa (100.000 Tokens) — R$ 9,90")
    doc_lines.append("*(Cota: 100.000 tokens | Validade: Vitalício/Sem Expiração)*\n")
    doc_lines.append("```text")
    for r in recargas:
        doc_lines.append(f"{r['index']:03d}. {r['key']}")
    doc_lines.append("```\n")
    doc_lines.append("---\n")

    # Seção 2
    doc_lines.append("## 💎 Lote 2: Plano Mensal Pro (1.000.000 Tokens) — R$ 20,00")
    doc_lines.append("*(Cota: 1.000.000 tokens | Gemini 3.7 + Todas as Personas)*\n")
    doc_lines.append("```text")
    for m in mensais:
        doc_lines.append(f"{m['index']:03d}. {m['key']}")
    doc_lines.append("```\n")
    doc_lines.append("---\n")

    # Seção 3
    doc_lines.append("## 👑 Lote 3: Plano Anual Pro (12.000.000 Tokens) — R$ 120,00 (50% OFF)")
    doc_lines.append("*(Cota: 12.000.000 tokens | Máxima Prioridade + Acesso Ilimitado)*\n")
    doc_lines.append("```text")
    for a in anuais:
        doc_lines.append(f"{a['index']:03d}. {a['key']}")
    doc_lines.append("```\n")

    output_text = "\n".join(doc_lines)

    target_file_1 = r"c:\Users\Usuario\Desktop\AHeiss_GoogleDrive\02-Programacao\projetos-IA\cv-yaml\CHAVES_PRO_CV_MAKER_E_MOEDA.md"
    target_file_2 = os.path.join(os.path.dirname(__file__), "CHAVES_PRO_CV_MAKER_E_MOEDA.md")

    with open(target_file_1, "w", encoding="utf-8") as f:
        f.write(output_text)

    with open(target_file_2, "w", encoding="utf-8") as f:
        f.write(output_text)

    print(f"\n🎉 SUCESSO TOTAL! 300 chaves geradas e gravadas no Turso Cloud!")
    print(f"Salvo em:\n1. {target_file_1}\n2. {target_file_2}")

if __name__ == "__main__":
    main()
