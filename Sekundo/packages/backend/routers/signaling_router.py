"""
Sekundo — WebRTC Signaling & Zero-Knowledge Capability Blob Relay Router

Lightweight, stateless signaling and E2EE ciphertext relay for Sekundo collaborative rooms
and v3 Capability Blobs (`/signal/share/blob/{blob_id}`).

Hardening (SEC-08):
- Sliding-window per-IP rate limiting (429 Too Many Requests)
- Strict payload ceiling <= 256 KB (413 Content Too Large)
- Configurable TTL up to 30 days with automatic expiration cleanup (404 Not Found)
- Global memory ceiling circuit breaker (503 Service Unavailable)
"""

import time
import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

router = APIRouter()

ROOM_TTL = 300
DEFAULT_BLOB_TTL_SECONDS = 7 * 24 * 3600       # 7 days default
MAX_BLOB_TTL_SECONDS = 30 * 24 * 3600          # 30 days max
MAX_ENCRYPTED_PACKETS_PER_ROOM = 500
MAX_CIPHER_PACKET_CHARS = 262_144              # 256 KB
ACTIVE_PEER_WINDOW_SECONDS = 45

MAX_TOTAL_ROOMS = 1000
MAX_TOTAL_BLOBS = 2000
RATE_LIMIT_WINDOW_SECONDS = 60
RATE_LIMIT_MAX_WRITES_PER_WINDOW = 30

_rooms: dict[str, dict] = {}
_blobs: dict[str, dict] = {}
_rate_buckets: dict[str, list[float]] = {}


def _extract_client_ip(request: Optional[Request]) -> str:
    if request is None:
        return "local"
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def _check_write_rate_limit(request: Optional[Request]) -> None:
    now = time.time()
    ip = _extract_client_ip(request)
    cutoff = now - RATE_LIMIT_WINDOW_SECONDS
    timestamps = [t for t in _rate_buckets.get(ip, []) if t > cutoff]
    if len(timestamps) >= RATE_LIMIT_MAX_WRITES_PER_WINDOW:
        _rate_buckets[ip] = timestamps
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded for relay write operations. Please retry in a minute.",
        )
    timestamps.append(now)
    _rate_buckets[ip] = timestamps


def _cleanup_expired() -> None:
    """Remove rooms and capability blobs older than their TTL."""
    now = time.time()
    expired_rooms = [rid for rid, room in _rooms.items() if now - room["created_at"] > ROOM_TTL]
    for rid in expired_rooms:
        del _rooms[rid]

    expired_blobs = [bid for bid, blob in _blobs.items() if now >= blob["expires_at"]]
    for bid in expired_blobs:
        del _blobs[bid]


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


class EncryptedCapabilityBlobPayload(BaseModel):
    cipher_blob: str
    ttl_seconds: Optional[int] = DEFAULT_BLOB_TTL_SECONDS


@router.post("/room", response_model=CreateRoomResponse)
async def create_room(request: Request):
    """Create an ephemeral signaling room. Auto-expires after TTL."""
    _cleanup_expired()
    _check_write_rate_limit(request)

    if len(_rooms) >= MAX_TOTAL_ROOMS:
        raise HTTPException(status_code=503, detail="Relay room capacity reached.")

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
async def post_offer(room_id: str, payload: SDPPayload, request: Request):
    _cleanup_expired()
    _check_write_rate_limit(request)
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
async def post_answer(room_id: str, payload: SDPPayload, request: Request):
    _cleanup_expired()
    _check_write_rate_limit(request)
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
async def post_candidate(room_id: str, role: str, candidate: ICECandidate, request: Request):
    _cleanup_expired()
    _check_write_rate_limit(request)
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
async def post_encrypted_sync_packet(
    room_id: str,
    payload: EncryptedSyncPushPayload,
    request: Request,
):
    """
    Zero-Knowledge Multi-Peer (1:N) Encrypted Relay Push.
    Accepts ONLY AES-256-GCM encrypted packets (`SEKUNDO_COLLAB_v2:`, `SEKUNDO_ENC_DELTA_v2:`, `SEKUNDO_CAP_v3:`).
    """
    _cleanup_expired()
    _check_write_rate_limit(request)

    cipher = (payload.cipher_packet or "").strip()
    if len(cipher) > MAX_CIPHER_PACKET_CHARS:
        raise HTTPException(
            status_code=413,
            detail="Encrypted packet exceeds maximum allowed relay size (256 KB).",
        )
    if not (
        cipher.startswith("SEKUNDO_COLLAB_v2:")
        or cipher.startswith("SEKUNDO_ENC_DELTA_v2:")
        or cipher.startswith("SEKUNDO_CAP_v3:")
        or cipher.startswith("v2.")
    ):
        raise HTTPException(
            status_code=400,
            detail="Zero-Knowledge violation: only AES-256-GCM encrypted packets are accepted.",
        )

    now = time.time()
    if room_id not in _rooms:
        if len(_rooms) >= MAX_TOTAL_ROOMS:
            raise HTTPException(status_code=503, detail="Relay room capacity reached.")
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


@router.put("/share/blob/{blob_id}")
async def put_capability_blob(
    blob_id: str,
    payload: EncryptedCapabilityBlobPayload,
    request: Request,
):
    """
    Stores an opaque AES-256-GCM encrypted capability blob (`SEKUNDO_CAP_v3:...`).
    The server never sees the decryption key (`#r`) or signing seed (`&w`).
    """
    _cleanup_expired()
    _check_write_rate_limit(request)

    clean_id = (blob_id or "").strip()
    if not clean_id or len(clean_id) > 64:
        raise HTTPException(status_code=400, detail="Invalid blob_id.")

    cipher = (payload.cipher_blob or "").strip()
    if len(cipher) > MAX_CIPHER_PACKET_CHARS:
        raise HTTPException(
            status_code=413,
            detail="Encrypted capability blob exceeds maximum allowed size (256 KB).",
        )
    if not (cipher.startswith("SEKUNDO_CAP_v3:") or cipher.startswith("v2.")):
        raise HTTPException(
            status_code=400,
            detail="Zero-Knowledge violation: capability blob must be encrypted (SEKUNDO_CAP_v3:).",
        )

    if clean_id not in _blobs and len(_blobs) >= MAX_TOTAL_BLOBS:
        raise HTTPException(status_code=503, detail="Relay blob storage ceiling reached.")

    raw_ttl = payload.ttl_seconds if payload.ttl_seconds is not None else DEFAULT_BLOB_TTL_SECONDS
    if raw_ttl <= 0:
        raise HTTPException(status_code=400, detail="ttl_seconds must be positive.")
    ttl = min(int(raw_ttl), MAX_BLOB_TTL_SECONDS)

    now = time.time()
    expires_at = now + ttl
    _blobs[clean_id] = {
        "blob_id": clean_id,
        "cipher_blob": cipher,
        "created_at": now,
        "expires_at": expires_at,
    }

    return {
        "status": "blob_stored",
        "blob_id": clean_id,
        "expires_at": expires_at,
        "ttl_seconds": ttl,
    }


@router.get("/share/blob/{blob_id}")
async def get_capability_blob(blob_id: str):
    """
    Retrieves an opaque encrypted capability blob if it exists and has not expired.
    """
    _cleanup_expired()
    clean_id = (blob_id or "").strip()
    blob = _blobs.get(clean_id)
    if not blob:
        raise HTTPException(status_code=404, detail="Capability blob not found or expired.")
    return blob
