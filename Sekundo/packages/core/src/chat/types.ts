/**
 * Sekundo — Chat Type Definitions (WebRTC P2P)
 */

// ---------------------------------------------------------------------------
// Peer State
// ---------------------------------------------------------------------------

/** Connection state of a WebRTC peer. */
export type PeerConnectionState =
  | 'new'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'failed'
  | 'closed';

/** Information about a connected peer. */
export interface PeerInfo {
  /** Display name (shared during signaling). */
  displayName: string;

  /** Unique peer ID for this session. */
  peerId: string;

  /** Current connection state. */
  state: PeerConnectionState;

  /** Timestamp of last received message. */
  lastSeen?: number;
}

// ---------------------------------------------------------------------------
// Chat Messages
// ---------------------------------------------------------------------------

/** A single chat message (ephemeral — lives only in RAM). */
export interface ChatMessage {
  /** Unique message ID. */
  id: string;

  /** Sender peer ID. */
  senderId: string;

  /** Sender display name. */
  senderName: string;

  /** Message text content. */
  text: string;

  /** Timestamp (Date.now()). */
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Signaling
// ---------------------------------------------------------------------------

/** SDP offer/answer for WebRTC signaling. */
export interface SignalPayload {
  type: 'offer' | 'answer' | 'candidate';
  sdp?: string;
  candidate?: RTCIceCandidateInit;
}

/**
 * The signaling token embedded in QR codes or shared links.
 * Contains the initial SDP offer and ICE candidates.
 */
export interface SignalingToken {
  /** Event ID this chat belongs to. */
  eventId: string;

  /** The admin's peer info. */
  host: PeerInfo;

  /** SDP offer from the host. */
  offer: RTCSessionDescriptionInit;

  /** ICE candidates gathered during offer creation. */
  candidates: RTCIceCandidateInit[];
}
