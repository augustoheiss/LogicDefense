"""
Sekundo — WebRTC Signaling & Zero-Knowledge Multi-Peer (1:N) Encrypted Relay Router

Lightweight, stateless signaling and E2EE ciphertext relay for Sekundo collaborative rooms.
Mounted at `/signal` on the LogicDefense Unified Gateway so cross-device collaboration works
out-of-the-box in production (`/signal/room/...`).
"""

import time
import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

ROOM_TTL = 300
MAX_ENCRYPTED_PACKETS_PER_ROOM = 500
MAX_CIPHER_PACKET_CHARS = 262_144
ACTIVE_PEER_WINDOW_SECONDS = 45

_rooms: dict[str, dict] = {}


def _cleanup_expired():
    """Remove rooms older than TTL. Called on every request."""
    now = time.time()
    expired = [rid for rid, room in _rooms.items() if now - room["created_at"] > ROOM_TTL]
    for rid in expired:
        del _rooms[rid]


class CreateRoomResponse(BaseModel):
    room_id: str
    ttl_seconds: int


class SDPPayload(BaseModel):
    sdp: str
    type: str


class ICECandidate(BaseModel):
    candidate: str
    sdpMLineIndex: Optional[int] = None
    sdpMid: Optional[str] = None


class EncryptedSyncPushPayload(BaseModel):
    peer_id: str
    packet_kind: str = "DELTA_MUTATION"
    cipher_packet: str


@router.post("/room", response_model=CreateRoomResponse)
async def create_room():
    """Create an ephemeral signaling room. Auto-expires after TTL."""
    _cleanup_expired()

    room_id = str(uuid.uuid4())[:8]
    _rooms[room_id] = {
        "offer": None,
        "answer": None,
        "candidates_offer": [],
        "candidates_answer": [],
        "encrypted_packets": [],
        "next_seq": 1,
        "peers": {},
        "created_at": time.time(),
    }

    return CreateRoomResponse(room_id=room_id, ttl_seconds=ROOM_TTL)


@router.post("/room/{room_id}/offer")
async def post_offer(room_id: str, payload: SDPPayload):
    _cleanup_expired()
    if room_id not in _rooms:
        raise HTTPException(status_code=404, detail="Room not found or expired.")
    _rooms[room_id]["offer"] = {"sdp": payload.sdp, "type": payload.type}
    return {"status": "offer_stored"}


@router.get("/room/{room_id}/offer")
async def get_offer(room_id: str):
    _cleanup_expired()
    if room_id not in _rooms:
        raise HTTPException(status_code=404, detail="Room not found or expired.")
    offer = _rooms[room_id].get("offer")
    if not offer:
        raise HTTPException(status_code=204, detail="No offer yet.")
    return offer


@router.post("/room/{room_id}/answer")
async def post_answer(room_id: str, payload: SDPPayload):
    _cleanup_expired()
    if room_id not in _rooms:
        raise HTTPException(status_code=404, detail="Room not found or expired.")
    _rooms[room_id]["answer"] = {"sdp": payload.sdp, "type": payload.type}
    return {"status": "answer_stored"}


@router.get("/room/{room_id}/answer")
async def get_answer(room_id: str):
    _cleanup_expired()
    if room_id not in _rooms:
        raise HTTPException(status_code=404, detail="Room not found or expired.")
    answer = _rooms[room_id].get("answer")
    if not answer:
        raise HTTPException(status_code=204, detail="No answer yet.")
    return answer


@router.post("/room/{room_id}/candidate/{role}")
@router.post("/room/{room_id}/candidates/{role}")
async def post_candidate(room_id: str, role: str, candidate: ICECandidate):
    _cleanup_expired()
    if room_id not in _rooms:
        raise HTTPException(status_code=404, detail="Room not found or expired.")
    if role not in ("offer", "answer"):
        raise HTTPException(status_code=400, detail="Role must be 'offer' or 'answer'.")
    _rooms[room_id][f"candidates_{role}"].append(candidate.model_dump())
    return {"status": "candidate_stored"}


@router.get("/room/{room_id}/candidates/{role}")
async def get_candidates(room_id: str, role: str):
    _cleanup_expired()
    if room_id not in _rooms:
        raise HTTPException(status_code=404, detail="Room not found or expired.")
    if role not in ("offer", "answer"):
        raise HTTPException(status_code=400, detail="Role must be 'offer' or 'answer'.")
    return {"candidates": _rooms[room_id].get(f"candidates_{role}", [])}


@router.post("/room/{room_id}/sync-push")
async def post_encrypted_sync_packet(room_id: str, payload: EncryptedSyncPushPayload):
    """
    Zero-Knowledge Multi-Peer (1:N) Encrypted Relay Push.
    Accepts ONLY AES-256-GCM encrypted packets (`SEKUNDO_COLLAB_v2:` or `SEKUNDO_ENC_DELTA_v2:`).
    """
    _cleanup_expired()

    cipher = (payload.cipher_packet or "").strip()
    if len(cipher) > MAX_CIPHER_PACKET_CHARS:
        raise HTTPException(
            status_code=413,
            detail="Encrypted packet exceeds maximum allowed relay size (256 KB).",
        )
    if not (
        cipher.startswith("SEKUNDO_COLLAB_v2:")
        or cipher.startswith("SEKUNDO_ENC_DELTA_v2:")
        or cipher.startswith("v2.")
    ):
        raise HTTPException(
            status_code=400,
            detail="Zero-Knowledge violation: only AES-256-GCM encrypted packets are accepted.",
        )

    now = time.time()
    if room_id not in _rooms:
        _rooms[room_id] = {
            "offer": None,
            "answer": None,
            "candidates_offer": [],
            "candidates_answer": [],
            "encrypted_packets": [],
            "next_seq": 1,
            "peers": {},
            "created_at": now,
        }

    room = _rooms[room_id]
    room["created_at"] = now
    room["peers"][payload.peer_id] = now

    seq = room["next_seq"]
    room["next_seq"] = seq + 1

    entry = {
        "seq": seq,
        "peer_id": payload.peer_id,
        "packet_kind": payload.packet_kind,
        "cipher_packet": cipher,
        "received_at": now,
    }
    room["encrypted_packets"].append(entry)
    if len(room["encrypted_packets"]) > MAX_ENCRYPTED_PACKETS_PER_ROOM:
        room["encrypted_packets"] = room["encrypted_packets"][-MAX_ENCRYPTED_PACKETS_PER_ROOM:]

    active_peers = [
        pid for pid, last_ts in room["peers"].items() if now - last_ts <= ACTIVE_PEER_WINDOW_SECONDS
    ]
    return {
        "status": "packet_relayed",
        "seq": seq,
        "active_peer_count": len(active_peers),
    }


@router.get("/room/{room_id}/sync-pull")
async def get_encrypted_sync_packets(
    room_id: str,
    since_seq: int = 0,
    peer_id: Optional[str] = None,
):
    """
    Zero-Knowledge Multi-Peer (1:N) Encrypted Relay Pull.
    """
    _cleanup_expired()

    if room_id not in _rooms:
        return {
            "packets": [],
            "latest_seq": 0,
            "active_peer_count": 0,
        }

    now = time.time()
    room = _rooms[room_id]
    room["created_at"] = now
    if peer_id:
        room["peers"][peer_id] = now

    packets = [p for p in room.get("encrypted_packets", []) if p["seq"] > since_seq]
    latest_seq = (room.get("next_seq", 1) - 1) if room.get("encrypted_packets") else 0
    active_peers = [
        pid for pid, last_ts in room.get("peers", {}).items() if now - last_ts <= ACTIVE_PEER_WINDOW_SECONDS
    ]

    return {
        "packets": packets,
        "latest_seq": latest_seq,
        "active_peer_count": len(active_peers),
    }
