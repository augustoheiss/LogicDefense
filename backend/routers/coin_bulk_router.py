"""
coin_bulk_router.py — Roteador de Entrada em Massa (Bulk Input) do Assistente Moeda
=============================================================================
Processa strings de despesas separadas por vírgula e converte em transações estruturadas.
"""

import math
import logging
from datetime import date
from typing import List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

log = logging.getLogger(__name__)

router = APIRouter(tags=["Assistente Moeda Bulk Input"])


class BulkInputRequest(BaseModel):
    """Comma-separated expense values + optional date."""
    values: str = Field(
        ...,
        min_length=1,
        description="Comma-separated numeric values, e.g. '45.50, 120, 33.90, 88'",
    )
    date: str = Field(
        default_factory=lambda: date.today().isoformat(),
        description="ISO date for all entries (default: today). Format: YYYY-MM-DD",
    )


class BulkTransaction(BaseModel):
    date: str
    value: float
    description: str
    entryType: str


class BulkInputResponse(BaseModel):
    transactions: List[BulkTransaction]
    skipped: int = Field(default=0, description="Count of non-numeric or negative values skipped")


@router.post("/api/coin/bulk-input", response_model=BulkInputResponse)
async def coin_bulk_input(request: BulkInputRequest) -> BulkInputResponse:
    """
    Parse a comma-separated string of expense values and return structured
    transaction objects ready for the frontend to commit.

    Validation rules:
      - Non-numeric tokens are skipped (counted in `skipped`)
      - Negative or zero values are skipped
      - Values are rounded to 2 decimal places
    """
    parts = [s.strip() for s in request.values.split(",") if s.strip()]
    transactions: List[BulkTransaction] = []
    skipped = 0

    for part in parts:
        try:
            value = float(part)
        except ValueError:
            skipped += 1
            continue

        if value <= 0 or not math.isfinite(value):
            skipped += 1
            continue

        transactions.append(
            BulkTransaction(
                date=request.date,
                value=round(value, 2),
                description="Sem descrição",
                entryType="expense",
            )
        )

    if not transactions:
        raise HTTPException(
            status_code=422,
            detail="Nenhum valor numérico positivo encontrado na string fornecida.",
        )

    log.info(
        "Bulk input: %d transactions parsed, %d skipped",
        len(transactions), skipped,
    )
    return BulkInputResponse(transactions=transactions, skipped=skipped)
