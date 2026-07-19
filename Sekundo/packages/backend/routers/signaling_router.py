"""
Sekundo — WebRTC Signaling Router

Lightweight, stateless signaling relay for P2P chat establishment.
This is NOT a persistent messaging server — it only brokers the
initial SDP offer/answer exchange between two peers.

Flow:
  1. Admin creates a room → receives a room_id
  2. Admin posts SDP offer → stored in ephemeral memory (TTL: 5 min)
  3. Viewer polls for offer → receives it → posts SDP answer
  4. Admin polls for answer → receives it → P2P connection established
  5. Room auto-expires after TTL (zero permanent storage)

🚨 ISOLATION: This router exists ONLY within Sekundo.
   Assistente-Moeda has no WebRTC, no signaling, no P2P features.
"""

import time
import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


# ---------------------------------------------------------------------------
# Ephemeral In-Memory Store (TTL-based, no database)
# ---------------------------------------------------------------------------

# Room TTL in seconds (5 minutes — enough for handshake)
ROOM_TTL = 300

# In-memory rooms: { room_id: { offer, answer, candidates, created_at } }
_rooms: dict[str, dict] = {}


def _cleanup_expired():
    """Remove rooms older than TTL. Called on every request."""
    now = time.time()
    expired = [rid for rid, room in _rooms.items() if now - room["created_at"] > ROOM_TTL]
    for rid in expired:
        del _rooms[rid]


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class CreateRoomResponse(BaseModel):
    room_id: str
    ttl_seconds: int


class SDPPayload(BaseModel):
    sdp: str
    type: str  # "offer" or "answer"


class ICECandidate(BaseModel):
    candidate: str
    sdpMLineIndex: Optional[int] = None
    sdpMid: Optional[str] = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/room", response_model=CreateRoomResponse)
async def create_room():
    """Create an ephemeral signaling room. Auto-expires after TTL."""
    _cleanup_expired()

    room_id = str(uuid.uuid4())[:8]  # Short ID for easy sharing
    _rooms[room_id] = {
        "offer": None,
        "answer": None,
        "candidates_offer": [],
        "candidates_answer": [],
        "created_at": time.time(),
    }

    return CreateRoomResponse(room_id=room_id, ttl_seconds=ROOM_TTL)


@router.post("/room/{room_id}/offer")
async def post_offer(room_id: str, payload: SDPPayload):
    """Admin posts their SDP offer to the room."""
    _cleanup_expired()

    if room_id not in _rooms:
        raise HTTPException(status_code=404, detail="Room not found or expired.")

    _rooms[room_id]["offer"] = {"sdp": payload.sdp, "type": payload.type}
    return {"status": "offer_stored"}


@router.get("/room/{room_id}/offer")
async def get_offer(room_id: str):
    """Viewer polls for the admin's SDP offer."""
    _cleanup_expired()

    if room_id not in _rooms:
        raise HTTPException(status_code=404, detail="Room not found or expired.")

    offer = _rooms[room_id].get("offer")
    if not offer:
        raise HTTPException(status_code=204, detail="No offer yet.")

    return offer


@router.post("/room/{room_id}/answer")
async def post_answer(room_id: str, payload: SDPPayload):
    """Viewer posts their SDP answer to the room."""
    _cleanup_expired()

    if room_id not in _rooms:
        raise HTTPException(status_code=404, detail="Room not found or expired.")

    _rooms[room_id]["answer"] = {"sdp": payload.sdp, "type": payload.type}
    return {"status": "answer_stored"}


@router.get("/room/{room_id}/answer")
async def get_answer(room_id: str):
    """Admin polls for the viewer's SDP answer."""
    _cleanup_expired()

    if room_id not in _rooms:
        raise HTTPException(status_code=404, detail="Room not found or expired.")

    answer = _rooms[room_id].get("answer")
    if not answer:
        raise HTTPException(status_code=204, detail="No answer yet.")

    return answer


@router.post("/room/{room_id}/candidate/{role}")
async def post_candidate(room_id: str, role: str, candidate: ICECandidate):
    """Post an ICE candidate (role = 'offer' or 'answer')."""
    _cleanup_expired()

    if room_id not in _rooms:
        raise HTTPException(status_code=404, detail="Room not found or expired.")

    if role not in ("offer", "answer"):
        raise HTTPException(status_code=400, detail="Role must be 'offer' or 'answer'.")

    _rooms[room_id][f"candidates_{role}"].append(candidate.model_dump())
    return {"status": "candidate_stored"}


@router.get("/room/{room_id}/candidates/{role}")
async def get_candidates(room_id: str, role: str):
    """Get all ICE candidates for a role."""
    _cleanup_expired()

    if room_id not in _rooms:
        raise HTTPException(status_code=404, detail="Room not found or expired.")

    if role not in ("offer", "answer"):
        raise HTTPException(status_code=400, detail="Role must be 'offer' or 'answer'.")

    return {"candidates": _rooms[room_id].get(f"candidates_{role}", [])}
