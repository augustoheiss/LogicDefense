import os
import sys
import secrets
import hashlib
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv

# Load environment
env_path = os.path.join(os.path.dirname(__file__), "backend", ".env")
load_dotenv(env_path)
sys.path.append(os.path.join(os.path.dirname(__file__), "backend"))

from db.license_db import get_connection, hash_key, is_turso_configured

def generate_key_batch(tier_name: str, token_amount: int, count: int, valid_days: int | None = None, prefix: str = "am_pro"):
    keys = []
    now_dt = datetime.now(timezone.utc)
    now_str = now_dt.isoformat()
    expires_str = (now_dt + timedelta(days=valid_days)).isoformat() if valid_days else None

    conn = get_connection()
    cursor = conn.cursor()

    for i in range(count):
        hex_token = secrets.token_hex(16)
        raw_key = f"{prefix}_{hex_token}"
        key_h = hash_key(raw_key)

        # Insert into DB
        cursor.execute("""
            INSERT INTO license_keys (license_key, key_hash, email, tier, token_balance, token_cap, expires_at, stripe_customer_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (raw_key, key_h, None, tier_name, token_amount, token_amount, expires_str, 'manual_pix_batch', now_str, now_str))

        keys.append({
            "index": i + 1,
            "key": raw_key,
            "tier": tier_name,
            "tokens": token_amount,
            "expires_at": expires_str or "Sem expiração"
        })

    conn.commit()
    return keys

def main():
    print(f"Iniciando geracao de lotes no banco (Turso Cloud: {is_turso_configured()})...")

    # 1. 100 Chaves de Recarga 100k
    print("Gerando 100 chaves de Recarga Avulsa (100.000 tokens)...")
    recargas = generate_key_batch("recarga", 100_000, 100, valid_days=None, prefix="am_token")

    # 2. 100 Chaves Mensais 1M
    print("Gerando 100 chaves do Plano Mensal (1.000.000 tokens)...")
    mensais = generate_key_batch("pro", 1_000_000, 100, valid_days=365, prefix="am_pro")

    # 3. 100 Chaves Anuais 12M
    print("Gerando 100 chaves do Plano Anual (12.000.000 tokens)...")
    anuais = generate_key_batch("pro_yearly", 12_000_000, 100, valid_days=730, prefix="am_year")

    # Criar documento formatado
    doc_lines = []
    doc_lines.append("# 🔑 Catálogo de Chaves de Licença Pro — CV Maker & Assistente Moeda")
    doc_lines.append(f"*Gerado em: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}*\n")
    doc_lines.append("> 💡 **Como Usar:** Quando um cliente fizer o pagamento via **Pix / WhatsApp**, copie uma das chaves abaixo e envie para ele. Ele só precisa colar no campo **'Ativar Chave'** no site para desbloquear a IA instantaneamente!\n")
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

    print(f"Sucesso! 300 chaves geradas e gravadas no banco de dados e salvas em:\n- {target_file_1}\n- {target_file_2}")

if __name__ == "__main__":
    main()
