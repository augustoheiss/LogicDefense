import asyncio
import json
import logging
from typing import Dict, Set

logger = logging.getLogger(__name__)

class SyncBroadcaster:
    """
    In-memory Real-Time SSE Broadcaster indexed by key_hash.
    Manages active SSE streaming connections to browser tabs.
    """
    def __init__(self):
        # Maps key_hash -> set of active asyncio.Queue instances
        self._listeners: Dict[str, Set[asyncio.Queue]] = {}

    def subscribe(self, key_hash: str) -> asyncio.Queue:
        q = asyncio.Queue()
        if key_hash not in self._listeners:
            self._listeners[key_hash] = set()
        self._listeners[key_hash].add(q)
        logger.info(f"SSE listener subscribed for key_hash={key_hash[:8]}... (Total: {len(self._listeners[key_hash])})")
        return q

    def unsubscribe(self, key_hash: str, q: asyncio.Queue):
        if key_hash in self._listeners:
            self._listeners[key_hash].discard(q)
            if not self._listeners[key_hash]:
                del self._listeners[key_hash]
            logger.info(f"SSE listener unsubscribed for key_hash={key_hash[:8]}...")

    def has_subscribers(self, key_hash: str) -> bool:
        return bool(self._listeners.get(key_hash))

    def broadcast(self, key_hash: str, event_data: dict) -> bool:
        """Broadcasts event_data to all active SSE queues for key_hash."""
        queues = self._listeners.get(key_hash)
        if not queues:
            return False
        
        payload_str = json.dumps(event_data)
        for q in list(queues):
            try:
                q.put_nowait(payload_str)
            except Exception as err:
                logger.warning(f"Failed to push SSE event to queue: {err}")
        return True

    def disconnect_key(self, key_hash: str):
        """Notifies active SSE connections of Key Rotation and closes them."""
        queues = self._listeners.get(key_hash)
        if queues:
            rotation_payload = json.dumps({"event": "KEY_ROTATED", "message": "Chave API revogada ou rotacionada."})
            for q in list(queues):
                try:
                    q.put_nowait(rotation_payload)
                except Exception:
                    pass
            del self._listeners[key_hash]

# Global Singleton instance
broadcaster = SyncBroadcaster()
