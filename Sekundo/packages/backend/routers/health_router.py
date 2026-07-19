"""
Sekundo — Health Check Router

Simple liveness and readiness probes for Render deployment.
Zero state. Zero database. Just a heartbeat.
"""

from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health_check():
    """Liveness probe — confirms the service is running."""
    return {
        "status": "alive",
        "service": "sekundo-api",
        "version": "0.1.0",
        "database": "none",  # Stateless by design
    }
