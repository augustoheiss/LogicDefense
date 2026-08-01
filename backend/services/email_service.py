"""
Email Delivery Service — Assistente Moeda
Sends License Keys to customers via Resend API or SMTP fallback.
"""

import os
import logging
import httpx

logger = logging.getLogger(__name__)

RESEND_API_KEY = os.getenv("RESEND_API_KEY")
FROM_EMAIL = os.getenv("FROM_EMAIL", "Assistente Moeda <onboarding@resend.dev>")

async def send_license_key_email(to_email: str, license_key: str, tier: str = "PRO") -> bool:
    """Sends license key to buyer email."""
    if not RESEND_API_KEY:
        logger.warning(f"RESEND_API_KEY not configured. License key for {to_email}: {license_key}")
        return False
        
    subject = f"🔑 Sua Chave de Acesso PRO — Assistente Moeda ({tier})"
    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #0f172a; color: #f8fafc; border-radius: 12px;">
      <h2 style="color: #38bdf8; margin-top: 0;">Sua Assinatura PRO foi Ativada! 🎉</h2>
      <p style="font-size: 16px; color: #cbd5e1;">Obrigado por apoiar o <strong>Assistente Moeda</strong>. Abaixo está a sua Chave de Licença exclusiva para acesso à Inteligência Artificial e aos recursos ilimitados:</p>
      
      <div style="background-color: #1e293b; border: 1px solid #3b82f6; border-radius: 8px; padding: 15px; margin: 20px 0; text-align: center;">
        <span style="font-size: 12px; text-transform: uppercase; color: #94a3b8; letter-spacing: 1px;">Chave de Licença</span>
        <div style="font-family: monospace; font-size: 20px; font-weight: bold; color: #4ade80; margin-top: 5px; word-break: break-all;">{license_key}</div>
      </div>
      
      <h3 style="color: #e2e8f0; font-size: 16px;">Como Ativar:</h3>
      <ol style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">
        <li>Abra o aplicativo ou site do <strong>Assistente Moeda</strong>.</li>
        <li>Vá em <strong>Configurações → Chave de Licença / IA</strong>.</li>
        <li>Cole sua chave acima e clique em <strong>Validar Chave</strong>.</li>
      </ol>
      
      <p style="font-size: 12px; color: #64748b; margin-top: 30px; border-t: 1px solid #334155; padding-top: 15px;">
        Esta chave é de uso pessoal. Guarde este e-mail para consultas futuras ou recuperação.
      </p>
    </div>
    """
    
    headers = {
        "Authorization": f"Bearer {RESEND_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "from": FROM_EMAIL,
        "to": [to_email],
        "subject": subject,
        "html": html_content
    }
    
    async with httpx.AsyncClient() as client:
        try:
            res = await client.post("https://api.resend.com/emails", headers=headers, json=payload)
            if res.status_code in (200, 201):
                logger.info(f"License key email sent successfully to {to_email}")
                return True
            else:
                logger.error(f"Resend API error ({res.status_code}): {res.text}")
                return False
        except Exception as e:
            logger.error(f"Failed to send license email: {e}")
            return False
