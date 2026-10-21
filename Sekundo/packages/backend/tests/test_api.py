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

def test_zero_egress_no_state_cache():
    # Verify that server-side state cache endpoints are removed (Zero-Egress Sovereignty)
    response = client.post("/signal/room")
    assert response.status_code == 200
    room_id = response.json()["room_id"]

    response = client.get(f"/signal/room/{room_id}/state")
    assert response.status_code == 404


def test_multi_peer_zero_knowledge_encrypted_sync():
    # 1. Create room
    response = client.post("/signal/room")
    assert response.status_code == 200
    room_id = response.json()["room_id"]

    # 2. Reject plaintext packets (Zero-Knowledge enforcement)
    bad_res = client.post(
        f"/signal/room/{room_id}/sync-push",
        json={
            "peer_id": "peer_admin_1",
            "packet_kind": "DELTA_MUTATION",
            "cipher_packet": '{"plaintext":"forbidden"}',
        },
    )
    assert bad_res.status_code == 400

    # 3. Push encrypted packets from 3 simultaneous peers (Admin + 2 Viewers)
    for idx, pid in enumerate(["peer_admin_1", "peer_viewer_2", "peer_viewer_3"], start=1):
        push_res = client.post(
            f"/signal/room/{room_id}/sync-push",
            json={
                "peer_id": pid,
                "packet_kind": "ACTIVITY_LOG" if idx > 1 else "SNAPSHOT_SYNC",
                "cipher_packet": f"SEKUNDO_COLLAB_v2:v2.salt_{idx}.iv_{idx}.cipher_{idx}",
            },
        )
        assert push_res.status_code == 200
        data = push_res.json()
        assert data["seq"] == idx
        assert data["active_peer_count"] == idx

    # 4. Pull all packets from seq=0 for a 4th peer joining the link
    pull_res = client.get(f"/signal/room/{room_id}/sync-pull?since_seq=0&peer_id=peer_viewer_4")
    assert pull_res.status_code == 200
    pull_data = pull_res.json()
    assert len(pull_data["packets"]) == 3
    assert pull_data["latest_seq"] == 3
    assert pull_data["active_peer_count"] == 4

    # 5. Incremental pull (since_seq=2 returns only seq=3)
    inc_res = client.get(f"/signal/room/{room_id}/sync-pull?since_seq=2&peer_id=peer_viewer_4")
    assert inc_res.status_code == 200
    inc_data = inc_res.json()
    assert len(inc_data["packets"]) == 1
    assert inc_data["packets"][0]["seq"] == 3


