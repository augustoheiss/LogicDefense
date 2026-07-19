import sys
import os
import pytest
from fastapi.testclient import TestClient

# Add packages/backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app

client = TestClient(app)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "alive"
    assert data["service"] == "sekundo-api"
    assert data["database"] == "none"

def test_signaling_room_lifecycle():
    # 1. Create a room
    response = client.post("/signal/room")
    assert response.status_code == 200
    room_data = response.json()
    assert "room_id" in room_data
    room_id = room_data["room_id"]

    # 2. Offer polling before offer is posted (should return 204)
    response = client.get(f"/signal/room/{room_id}/offer")
    assert response.status_code == 204

    # 3. Post SDP Offer
    offer_payload = {"sdp": "v=0\no=- 0 0 IN IP4 127.0.0.1...", "type": "offer"}
    response = client.post(f"/signal/room/{room_id}/offer", json=offer_payload)
    assert response.status_code == 200
    assert response.json()["status"] == "offer_stored"

    # 4. Get SDP Offer
    response = client.get(f"/signal/room/{room_id}/offer")
    assert response.status_code == 200
    assert response.json() == offer_payload

    # 5. Answer polling before answer is posted (should return 204)
    response = client.get(f"/signal/room/{room_id}/answer")
    assert response.status_code == 204

    # 6. Post SDP Answer
    answer_payload = {"sdp": "v=0\no=- 1 0 IN IP4 127.0.0.1...", "type": "answer"}
    response = client.post(f"/signal/room/{room_id}/answer", json=answer_payload)
    assert response.status_code == 200
    assert response.json()["status"] == "answer_stored"

    # 7. Get SDP Answer
    response = client.get(f"/signal/room/{room_id}/answer")
    assert response.status_code == 200
    assert response.json() == answer_payload

    # 8. Post ICE Candidates
    cand_payload = {
        "candidate": "candidate:842163049 1 udp 16777215 127.0.0.1 58739 typ host",
        "sdpMLineIndex": 0,
        "sdpMid": "0"
    }
    response = client.post(f"/signal/room/{room_id}/candidate/offer", json=cand_payload)
    assert response.status_code == 200
    assert response.json()["status"] == "candidate_stored"

    # 9. Get ICE Candidates
    response = client.get(f"/signal/room/{room_id}/candidates/offer")
    assert response.status_code == 200
    candidates = response.json()["candidates"]
    assert len(candidates) == 1
    assert candidates[0]["candidate"] == cand_payload["candidate"]
