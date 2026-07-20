/**
 * Hook: usePeerChat
 *
 * Ephemeral WebRTC P2P sync and chat engine.
 * Handles the complete signaling handshake via FastAPI, P2P lifecycle states,
 * binary/text archive fragmentation streaming, and volatile message states.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { API, getHeaders } from '../config/api';
import type { ChatMessage, PeerConnectionState } from '@sekundo/core';

const CHUNK_SIZE = 16384; // 16KB standard WebRTC chunk size to avoid buffer overflow

interface UsePeerChatProps {
  eventId: string;
  role: 'admin' | 'viewer';
  onHistorySync?: (historyData: any[]) => void;
  onStateUpdate?: (skeleton: any[]) => void;
}

export function usePeerChat({ eventId, role, onHistorySync, onStateUpdate }: UsePeerChatProps) {
  const [connectionState, setConnectionState] = useState<PeerConnectionState>('disconnected');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [roomId, setRoomId] = useState<string | null>(null);

  // Refs to hold WebRTC objects
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const candidatePollIntervalRef = useRef<any>(null);
  const answerPollIntervalRef = useRef<any>(null);
  
  // Archive streaming reassembly storage
  const incomingChunksRef = useRef<{ [index: number]: string }>({});

  const cleanVolatileState = useCallback(() => {
    setMessages([]);
    setConnectionState('disconnected');
    incomingChunksRef.current = {};
  }, []);

  const closeConnection = useCallback(() => {
    // Stop polling timers
    if (candidatePollIntervalRef.current) clearInterval(candidatePollIntervalRef.current);
    if (answerPollIntervalRef.current) clearInterval(answerPollIntervalRef.current);

    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    cleanVolatileState();
  }, [cleanVolatileState]);

  // Clean state and close connection when hook unmounts (leaving route/exiting tab)
  useEffect(() => {
    return () => {
      closeConnection();
    };
  }, [closeConnection]);

  // Initialize RTCPeerConnection with STUN configurations
  const initPeerConnection = useCallback(() => {
    if (typeof RTCPeerConnection === 'undefined') {
      console.warn('[Sekundo P2P] WebRTC is not supported on this platform.');
      return null;
    }

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    pc.oniceconnectionstatechange = () => {
      console.log('[Sekundo P2P] ICE state changed:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'connected') {
        setConnectionState('connected');
      } else if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        setConnectionState('disconnected');
        closeConnection();
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  }, [closeConnection]);

  // Handle incoming data channel messages
  const handleDataChannelMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data);

        if (payload.type === 'chat') {
          const newMsg: ChatMessage = {
            id: Math.random().toString(),
            senderId: payload.senderId,
            senderName: payload.senderName,
            text: payload.text,
            timestamp: payload.timestamp,
          };
          setMessages((prev) => [...prev, newMsg]);
        } else if (payload.type === 'state-update') {
          if (onStateUpdate) {
            onStateUpdate(payload.skeleton);
          }
        } else if (payload.type === 'archive-chunk') {
          const { index, total, chunk } = payload;
          incomingChunksRef.current[index] = chunk;

          // Check if all chunks received
          if (Object.keys(incomingChunksRef.current).length === total) {
            // Reassemble
            let reassembledString = '';
            for (let i = 0; i < total; i++) {
              reassembledString += incomingChunksRef.current[i];
            }

            try {
              const archiveData = JSON.parse(reassembledString);
              if (onHistorySync) {
                onHistorySync(archiveData);
              }
              console.log('[Sekundo P2P] Historical archive synced and reassembled.');
            } catch (parseErr) {
              console.error('[Sekundo P2P] Failed to parse reassembled archive:', parseErr);
            }
          }
        }
      } catch (err) {
        console.error('[Sekundo P2P] Message handling error:', err);
      }
    },
    [onHistorySync]
  );

  // Configure Data Channel events
  const configureDataChannel = useCallback(
    (channel: RTCDataChannel) => {
      dataChannelRef.current = channel;
      setConnectionState('connecting');

      channel.onopen = () => {
        console.log('[Sekundo P2P] P2P channel established.');
        setConnectionState('connected');
      };

      channel.onclose = () => {
        console.log('[Sekundo P2P] P2P channel closed.');
        closeConnection();
      };

      channel.onmessage = handleDataChannelMessage;
    },
    [closeConnection, handleDataChannelMessage]
  );

  // ---------------------------------------------------------------------------
  // Signaling Pipeline: ADMIN ROLE
  // ---------------------------------------------------------------------------
  const startAdminHandshake = async () => {
    const pc = initPeerConnection();
    if (!pc) return;

    setConnectionState('connecting');

    try {
      // 1. Create Data Channel
      const channel = pc.createDataChannel('sekundo-sync');
      configureDataChannel(channel);

      // 2. Create Ephemeral Room
      const roomRes = await fetch(API.signal.createRoom, { method: 'POST' });
      const roomData = await roomRes.json();
      const rId = roomData.room_id;
      setRoomId(rId);

      // 3. ICE Candidate gathering relay
      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          await fetch(API.signal.candidates(rId, 'offer'), {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(event.candidate),
          });
        }
      };

      // 4. Create and upload Offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await fetch(API.signal.offer(rId), {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ sdp: offer.sdp, type: 'offer' }),
      });

      // 5. Poll for Answer
      answerPollIntervalRef.current = setInterval(async () => {
        try {
          const res = await fetch(API.signal.answer(rId));
          if (res.status === 200) {
            const answer = await res.json();
            clearInterval(answerPollIntervalRef.current);
            await pc.setRemoteDescription(new RTCSessionDescription(answer));

            // Poll for Guest ICE Candidates
            candidatePollIntervalRef.current = setInterval(async () => {
              try {
                const candidatesRes = await fetch(API.signal.candidates(rId, 'answer'));
                const { candidates } = await candidatesRes.json();
                for (const c of candidates) {
                  await pc.addIceCandidate(new RTCIceCandidate(c));
                }
                if (candidates.length > 0) {
                  clearInterval(candidatePollIntervalRef.current);
                }
              } catch (e) {
                // ignore polling errors
              }
            }, 2000);
          }
        } catch (e) {
          // ignore polling errors
        }
      }, 2000);
    } catch (err) {
      console.error('[Sekundo P2P] Admin Handshake failed:', err);
      setConnectionState('disconnected');
    }
  };

  // ---------------------------------------------------------------------------
  // Signaling Pipeline: VIEWER/GUEST ROLE
  // ---------------------------------------------------------------------------
  const joinViewerHandshake = async (rId: string) => {
    const pc = initPeerConnection();
    if (!pc) return;

    setRoomId(rId);
    setConnectionState('connecting');

    try {
      // 1. Setup Data Channel Listener
      pc.ondatachannel = (event) => {
        configureDataChannel(event.channel);
      };

      // 2. Fetch SDP Offer
      const offerRes = await fetch(API.signal.offer(rId));
      if (offerRes.status !== 200) {
        throw new Error('Offer not available yet.');
      }
      const offer = await offerRes.json();
      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      // 3. ICE Candidate gathering relay
      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          await fetch(API.signal.candidates(rId, 'answer'), {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(event.candidate),
          });
        }
      };

      // 4. Create and upload Answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await fetch(API.signal.answer(rId), {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ sdp: answer.sdp, type: 'answer' }),
      });

      // 5. Relay Admin candidates
      const candidatesRes = await fetch(API.signal.candidates(rId, 'offer'));
      const { candidates } = await candidatesRes.json();
      for (const c of candidates) {
        await pc.addIceCandidate(new RTCIceCandidate(c));
      }
    } catch (err) {
      console.error('[Sekundo P2P] Guest Handshake failed:', err);
      setConnectionState('disconnected');
    }
  };

  // ---------------------------------------------------------------------------
  // Data Sender Actions
  // ---------------------------------------------------------------------------

  const sendMessage = (text: string, senderName: string) => {
    if (!dataChannelRef.current || dataChannelRef.current.readyState !== 'open') return;

    const senderId = role === 'admin' ? 'admin' : 'viewer';
    const timestamp = Date.now();

    const payload = {
      type: 'chat',
      senderId,
      senderName,
      text,
      timestamp,
    };

    dataChannelRef.current.send(JSON.stringify(payload));

    // Volatile self-append
    setMessages((prev) => [
      ...prev,
      {
        id: Math.random().toString(),
        senderId,
        senderName,
        text,
        timestamp,
      },
    ]);
  };

  const streamHistory = (historyData: any[]) => {
    if (!dataChannelRef.current || dataChannelRef.current.readyState !== 'open') return;

    const serialized = JSON.stringify(historyData);
    const totalChunks = Math.ceil(serialized.length / CHUNK_SIZE);

    console.log(`[Sekundo P2P] Streaming history: ${serialized.length} bytes in ${totalChunks} chunks.`);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, serialized.length);
      const chunk = serialized.substring(start, end);

      const payload = {
        type: 'archive-chunk',
        index: i,
        total: totalChunks,
        chunk,
      };

      dataChannelRef.current.send(JSON.stringify(payload));
    }
  };

  const broadcastState = (skeleton: any[]) => {
    if (!dataChannelRef.current || dataChannelRef.current.readyState !== 'open') return;
    const payload = {
      type: 'state-update',
      skeleton,
    };
    dataChannelRef.current.send(JSON.stringify(payload));
  };

  return {
    connectionState,
    messages,
    roomId,
    startAdminHandshake,
    joinViewerHandshake,
    sendMessage,
    streamHistory,
    broadcastState,
    closeConnection,
  };
}
