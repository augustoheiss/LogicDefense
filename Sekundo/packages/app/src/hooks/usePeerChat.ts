/**
 * Hook: usePeerChat
 *
 * Ephemeral WebRTC P2P sync and chat engine.
 * Handles the complete signaling handshake via FastAPI, P2P lifecycle states,
 * binary/text archive fragmentation streaming, and volatile message states.
 * Also includes seamless BroadcastChannel local loopback for instant multi-tab sync.
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
  const [error, setError] = useState<string | null>(null);

  // Refs to hold WebRTC objects & channels
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const broadcastChannelRef = useRef<any>(null);
  const candidatePollIntervalRef = useRef<any>(null);
  const answerPollIntervalRef = useRef<any>(null);

  // Archive streaming reassembly storage
  const incomingChunksRef = useRef<{ [index: number]: string }>({});

  const cleanVolatileState = useCallback(() => {
    setMessages([]);
    setConnectionState('disconnected');
    incomingChunksRef.current = {};
    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.close();
      } catch (e) {
        // ignore
      }
      broadcastChannelRef.current = null;
    }
  }, []);

  const closeConnection = useCallback(() => {
    // Stop polling timers
    if (candidatePollIntervalRef.current) clearInterval(candidatePollIntervalRef.current);
    if (answerPollIntervalRef.current) clearInterval(answerPollIntervalRef.current);

    if (dataChannelRef.current) {
      try {
        dataChannelRef.current.close();
      } catch (e) {
        // ignore
      }
      dataChannelRef.current = null;
    }

    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.close();
      } catch (e) {
        // ignore
      }
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

  // Unified incoming message dispatcher (handles WebRTC and BroadcastChannel payloads)
  const handleIncomingPayload = useCallback(
    (payload: any) => {
      try {
        if (!payload || typeof payload !== 'object') return;

        if (payload.type === 'chat') {
          const newMsg: ChatMessage = {
            id: payload.id || Math.random().toString(),
            senderId: payload.senderId,
            senderName: payload.senderName,
            text: payload.text,
            timestamp: payload.timestamp || Date.now(),
          };
          setMessages((prev) => {
            // Avoid duplicates
            if (prev.some((m) => m.id === newMsg.id || (m.timestamp === newMsg.timestamp && m.text === newMsg.text && m.senderName === newMsg.senderName))) {
              return prev;
            }
            return [...prev, newMsg];
          });
        } else if (payload.type === 'state-update') {
          if (onStateUpdate && payload.skeleton) {
            onStateUpdate(payload.skeleton);
          }
        } else if (payload.type === 'archive-chunk') {
          const { index, total, chunk } = payload;
          incomingChunksRef.current[index] = chunk;

          // Check if all chunks received
          if (Object.keys(incomingChunksRef.current).length === total) {
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
        console.error('[Sekundo P2P] Payload processing error:', err);
      }
    },
    [onHistorySync, onStateUpdate]
  );

  // Initialize RTCPeerConnection with STUN configurations
  const initPeerConnection = useCallback(() => {
    if (typeof RTCPeerConnection === 'undefined') {
      console.warn('[Sekundo P2P] WebRTC is not supported on this platform.');
      return null;
    }

    try {
      const rawStun = process.env.EXPO_PUBLIC_SEKUNDO_STUN_URLS;
      const iceServers = rawStun
        ? rawStun
            .split(',')
            .map((u) => u.trim())
            .filter(Boolean)
            .map((urls) => ({ urls }))
        : [];
      const pc = new RTCPeerConnection({
        iceServers,
      });

      pc.oniceconnectionstatechange = () => {
        console.log('[Sekundo P2P] ICE state changed:', pc.iceConnectionState);
        if (pc.iceConnectionState === 'connected') {
          setConnectionState('connected');
        } else if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
          // If we also have an active BroadcastChannel, don't immediately disconnect
          if (!broadcastChannelRef.current) {
            setConnectionState('disconnected');
            closeConnection();
          }
        }
      };

      peerConnectionRef.current = pc;
      return pc;
    } catch (err: any) {
      console.error('[Sekundo P2P] RTCPeerConnection init error:', err);
      return null;
    }
  }, [closeConnection]);

  // Handle incoming data channel messages
  const handleDataChannelMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data);
        handleIncomingPayload(payload);
      } catch (err) {
        console.error('[Sekundo P2P] Message handling error:', err);
      }
    },
    [handleIncomingPayload]
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
        if (!broadcastChannelRef.current) {
          closeConnection();
        }
      };

      channel.onmessage = handleDataChannelMessage;
    },
    [closeConnection, handleDataChannelMessage]
  );

  // Setup optional BroadcastChannel for instantaneous same-browser multi-tab testing
  const setupBroadcastLoopback = useCallback(
    (rId: string) => {
      if (typeof BroadcastChannel !== 'undefined') {
        try {
          const bc = new BroadcastChannel(`sekundo_p2p_${rId}`);
          broadcastChannelRef.current = bc;
          bc.onmessage = (event) => {
            const data = event.data;
            if (!data) return;

            if (data.type === 'peer_joined') {
              console.log('[Sekundo P2P Broadcast] Peer joined loopback channel.');
              setConnectionState('connected');
              if (role === 'admin') {
                bc.postMessage({ type: 'admin_ack' });
              }
            } else if (data.type === 'admin_ack') {
              console.log('[Sekundo P2P Broadcast] Admin acknowledged loopback connection.');
              setConnectionState('connected');
            } else {
              handleIncomingPayload(data);
            }
          };

          if (role === 'viewer') {
            bc.postMessage({ type: 'peer_joined' });
            setConnectionState('connected');
          }
        } catch (e) {
          console.warn('[Sekundo P2P] BroadcastChannel initialization skipped:', e);
        }
      }
    },
    [role, handleIncomingPayload]
  );

  // ---------------------------------------------------------------------------
  // Signaling Pipeline: ADMIN ROLE
  // ---------------------------------------------------------------------------
  const startAdminHandshake = async () => {
    setError(null);
    setConnectionState('connecting');

    try {
      // 1. Create Ephemeral Room via API
      console.log('[Sekundo P2P] Requesting ephemeral room creation...');
      const roomRes = await fetch(API.signal.createRoom, {
        method: 'POST',
        headers: getHeaders(),
      });

      if (!roomRes.ok) {
        throw new Error(`Servidor de sinalização indisponível (${roomRes.status})`);
      }

      const roomData = await roomRes.json();
      const rId = roomData.room_id;
      if (!rId) {
        throw new Error('Falha ao obter ID da sala de sinalização.');
      }

      setRoomId(rId);
      setupBroadcastLoopback(rId);

      // 2. Initialize WebRTC peer connection
      const pc = initPeerConnection();
      if (!pc) {
        console.warn('[Sekundo P2P] WebRTC não suportado, operando em modo loopback.');
        return;
      }

      // 3. Create Data Channel
      const channel = pc.createDataChannel('sekundo-sync');
      configureDataChannel(channel);

      // 4. ICE Candidate gathering relay
      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          try {
            await fetch(API.signal.candidates(rId, 'offer'), {
              method: 'POST',
              headers: getHeaders(),
              body: JSON.stringify(event.candidate),
            });
          } catch (candErr) {
            console.warn('[Sekundo P2P] Falha ao enviar ICE candidate:', candErr);
          }
        }
      };

      // 5. Create and upload Offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const offerRes = await fetch(API.signal.offer(rId), {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ sdp: offer.sdp, type: 'offer' }),
      });

      if (!offerRes.ok) {
        throw new Error(`Falha ao registrar oferta SDP (${offerRes.status})`);
      }

      // 6. Poll for Answer from Guest
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
                if (candidatesRes.status === 200) {
                  const { candidates } = await candidatesRes.json();
                  for (const c of candidates || []) {
                    await pc.addIceCandidate(new RTCIceCandidate(c));
                  }
                  if (candidates && candidates.length > 0) {
                    clearInterval(candidatePollIntervalRef.current);
                  }
                }
              } catch (e) {
                // ignore candidate polling transient errors
              }
            }, 1500);
          }
        } catch (e) {
          // ignore answer polling transient errors
        }
      }, 1500);
    } catch (err: any) {
      console.error('[Sekundo P2P] Admin Handshake failed:', err);
      setError(err?.message || 'Falha ao iniciar handshake do Host.');
      setConnectionState('disconnected');
    }
  };

  // ---------------------------------------------------------------------------
  // Signaling Pipeline: VIEWER/GUEST ROLE
  // ---------------------------------------------------------------------------
  const joinViewerHandshake = async (rId: string) => {
    setError(null);
    setRoomId(rId);
    setConnectionState('connecting');

    try {
      setupBroadcastLoopback(rId);

      // 1. Fetch SDP Offer
      const offerRes = await fetch(API.signal.offer(rId));
      if (offerRes.status === 204 || offerRes.status === 404) {
        throw new Error('Sala não encontrada ou oferta do Host ainda não está pronta.');
      }
      if (!offerRes.ok) {
        throw new Error(`Erro ao buscar sala (${offerRes.status})`);
      }

      const offer = await offerRes.json();

      // 2. Setup PeerConnection
      const pc = initPeerConnection();
      if (!pc) {
        console.warn('[Sekundo P2P] WebRTC não suportado, aguardando loopback local.');
        return;
      }

      pc.ondatachannel = (event) => {
        configureDataChannel(event.channel);
      };

      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      // 3. ICE Candidate gathering relay
      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          try {
            await fetch(API.signal.candidates(rId, 'answer'), {
              method: 'POST',
              headers: getHeaders(),
              body: JSON.stringify(event.candidate),
            });
          } catch (candErr) {
            console.warn('[Sekundo P2P] Falha ao enviar candidate do guest:', candErr);
          }
        }
      };

      // 4. Create and upload Answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      const answerRes = await fetch(API.signal.answer(rId), {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ sdp: answer.sdp, type: 'answer' }),
      });

      if (!answerRes.ok) {
        throw new Error(`Falha ao registrar resposta SDP (${answerRes.status})`);
      }

      // 5. Relay Admin candidates
      try {
        const candidatesRes = await fetch(API.signal.candidates(rId, 'offer'));
        if (candidatesRes.status === 200) {
          const { candidates } = await candidatesRes.json();
          for (const c of candidates || []) {
            await pc.addIceCandidate(new RTCIceCandidate(c));
          }
        }
      } catch (candErr) {
        console.warn('[Sekundo P2P] Falha ao recuperar candidates do admin:', candErr);
      }
    } catch (err: any) {
      console.error('[Sekundo P2P] Guest Handshake failed:', err);
      setError(err?.message || 'Falha ao conectar à sala do Host.');
      setConnectionState('disconnected');
    }
  };

  // ---------------------------------------------------------------------------
  // Data Sender Actions
  // ---------------------------------------------------------------------------

  const sendMessage = (text: string, senderName: string) => {
    const senderId = role === 'admin' ? 'admin' : 'viewer';
    const timestamp = Date.now();
    const msgId = Math.random().toString();

    const payload = {
      type: 'chat',
      id: msgId,
      senderId,
      senderName,
      text,
      timestamp,
    };

    let sent = false;

    if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      try {
        dataChannelRef.current.send(JSON.stringify(payload));
        sent = true;
      } catch (e) {
        console.warn('[Sekundo P2P] WebRTC send failed:', e);
      }
    }

    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage(payload);
        sent = true;
      } catch (e) {
        console.warn('[Sekundo P2P] Broadcast send failed:', e);
      }
    }

    // Volatile self-append
    setMessages((prev) => [
      ...prev,
      {
        id: msgId,
        senderId,
        senderName,
        text,
        timestamp,
      },
    ]);
  };

  const streamHistory = (historyData: any[]) => {
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

      if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
        dataChannelRef.current.send(JSON.stringify(payload));
      }
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.postMessage(payload);
      }
    }
  };

  const broadcastState = (skeleton: any[]) => {
    const payload = {
      type: 'state-update',
      skeleton,
    };
    if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      dataChannelRef.current.send(JSON.stringify(payload));
    }
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.postMessage(payload);
    }
  };

  return {
    connectionState,
    messages,
    roomId,
    error,
    setError,
    startAdminHandshake,
    joinViewerHandshake,
    sendMessage,
    streamHistory,
    broadcastState,
    closeConnection,
  };
}
