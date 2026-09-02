"""
auth_helpers.py — Extração unificada de chaves de autenticação para o CV Maker 2.0.

Centraliza a lógica de resolução de chave de todos os headers aceitos,
priorizando `Authorization: Bearer <token>` como padrão primário.

Headers legados (X-API-Key, X-License-Key, X-CV-Key, X-Spreadsheet-Key) são
aceitos como fallback silencioso para retrocompatibilidade durante a transição.
"""

import logging
from typing import Optional

log = logging.getLogger(__name__)


def extract_auth_key(
    authorization: Optional[str] = None,
    x_api_key: Optional[str] = None,
    x_license_key: Optional[str] = None,
    x_cv_key: Optional[str] = None,
    x_spreadsheet_key: Optional[str] = None,
) -> Optional[str]:
    """
    Retorna a chave de autenticação limpa a partir dos headers recebidos.

    Prioridade:
      1. Authorization: Bearer <token>  (padrão primário)
      2. X-License-Key                  (legado, compatibilidade)
      3. X-API-Key                      (legado, compatibilidade)
      4. X-CV-Key                       (legado, compatibilidade)
      5. X-Spreadsheet-Key              (legado, compatibilidade)

    Se um header legado for utilizado, um warning é logado para rastrear
    clientes que ainda não migraram para Authorization: Bearer.
    """
    # 1. Caminho primário: Authorization: Bearer
    if authorization:
        clean = authorization.strip()
        if clean.startswith("Bearer "):
            return clean[7:].strip()
        # Aceita chave direta sem prefixo Bearer por tolerância
        return clean

    # 2. Fallbacks legados (com aviso de deprecação no log)
    legacy_key = x_license_key or x_api_key or x_cv_key or x_spreadsheet_key
    if legacy_key:
        source = (
            "X-License-Key" if x_license_key else
            "X-API-Key" if x_api_key else
            "X-CV-Key" if x_cv_key else
            "X-Spreadsheet-Key"
        )
        log.info(
            "[Auth] Chave recebida via header legado '%s'. "
            "Migre para 'Authorization: Bearer <token>' para compatibilidade futura.",
            source,
        )
        return legacy_key.strip()

    return None
