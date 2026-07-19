# Sekundo — Architecture Decision Record

> Last updated: 2026-07-19

---

## 1. Core Philosophy

Sekundo is a **Local-First, serverless, agnostic skeleton engine** for temporal event automation.
It stores all state in the client's browser (localStorage / AsyncStorage) and never requires a
centralized database. The system is designed to be invisible — it plays the background melody
so the user can write their own music.

---

## 2. Locked-In Decisions

### 2.1 Technology Stack
| Layer | Choice | Rationale |
|---|---|---|
| **UI Framework** | Expo SDK 56 + React Native (Option C) | Single codebase for Web + Mobile. Proven in Assistente-Moeda-App. |
| **Routing** | Expo Router v4 | File-based routing with group layouts `(admin)/`, `(viewer)/`. |
| **State** | React hooks + localStorage | No external state library. "Menos é mais". |
| **CSV Parsing** | PapaParse | Header-based parsing. Never positional. |
| **PDF** | pdf-lib (JS) | Pure JS, works in browser AND React Native. |
| **Encryption** | Web Crypto API (AES-GCM) | Native browser crypto, zero dependencies. |
| **WebRTC** | Native RTCPeerConnection | Built into browsers. `react-native-webrtc` for mobile. |
| **Backend** | FastAPI (Python) | Stateless microservice for PDF processing + WebRTC signaling. Deployed independently on Render. |
| **Testing** | Vitest (core) | Fast, TypeScript-native. |

### 2.2 Workspace Isolation (CRITICAL)
**Decision:** Complete independence from Assistente-Moeda.

🚨 **Non-Negotiable Rules:**
- Sekundo has its **own backend** at `packages/backend/` (FastAPI, deployed as `https://sekundo-api.onrender.com`).
- Sekundo has its **own environment variables** (`EXPO_PUBLIC_SEKUNDO_API_URL`, `SEKUNDO_CORS_ORIGINS`, `SEKUNDO_ADMIN_KEY`).
- Sekundo **NEVER** references `VITE_API_URL`, `X-Spreadsheet-Key`, or any Assistente-Moeda middleware.
- Sekundo's backend has **ZERO** database connections — all endpoints are stateless.
- The two projects share the same Git repository but have **ZERO code dependencies** on each other.

| Boundary | Assistente-Moeda | Sekundo |
|---|---|---|
| Backend URL | `ocorrencias-pdf-writer.onrender.com` | `sekundo-api.onrender.com` |
| Auth Header | `X-Spreadsheet-Key` | `X-Sekundo-Admin-Key` |
| Database | Supabase (financial data) | **None** (stateless) |
| Env var prefix | `VITE_*` | `EXPO_PUBLIC_SEKUNDO_*` / `SEKUNDO_*` |
| Backend dir | `LogicDefense/backend/` | `LogicDefense/Sekundo/packages/backend/` |
| Frontend dir | `LogicDefense/Assistente-Moeda-App/` | `LogicDefense/Sekundo/packages/app/` |

### 2.3 Passphrase Key Management
**Decision:** Out-of-band distribution.
- The URL carries the encrypted payload in the fragment (`#/view?data=...`).
- The passphrase is shared via a secondary channel (WhatsApp, face-to-face, verbal).
- The encrypted link and the decryption key **never travel through the same channel**.

### 2.4 CSV Conflict Resolution
**Decision:** Last import wins, with visual diff preview.
- Before overwriting localStorage, the UI renders a side-by-side diff comparing current vs incoming nodes.
- The admin explicitly confirms after reviewing changes.
- No merge logic — intentional simplicity.

### 2.5 Mobile PDF Scope
**Decision:** Web-only interactive canvas mapping.
- `pdf-mapper.web.tsx` provides the click-to-place coordinate editor with HTML5 Canvas.
- Mobile apps render PDFs in read-only mode and perform automated field injection using pre-mapped coordinates.
- The coordinate map (stored in localStorage) is portable across platforms.

### 2.6 Path Key Flexibility
**Decision:** Digit-width agnostic.
- The parser splits on `-` and parses each segment as an **integer**.
- `01`, `001`, and `1` all resolve to index `1` in the tree.
- Comparison and sorting operate on integer arrays, not strings.

### 2.7 Auto-Rollover Catch-Up
**Decision:** Sequential gap computation.
- On app open, the engine calculates ALL missing rollovers between `lastRolloverDate` and `now`.
- Each missed period is processed in sequence: freeze → archive → clear → advance.
- This prevents data loss even if the app stays closed for weeks.

---

## 3. Hybrid Data Transport Architecture

Two-tier serverless sharing pipeline for deep history without URL size limits.

### 3.1 Tier 1: Link-Container (Horizon Window — Default)

```
[Admin Browser] → compress(gzip) → base64url → URL fragment
                                                     ↓
[Viewer Browser] ← inflate ← base64url decode ← URL fragment
```

**Payload contents (Horizon Window):**
- Event configuration (name, frequency, skeletons)
- Last 2 weeks of history (archived rollover data)
- All future scheduled skeletons

**Compression pipeline:**
1. `JSON.stringify(horizonPayload)`
2. Compress with `CompressionStream('gzip')` (browser-native) or `pako`/`lz-string` fallback
3. Encode to `Base64URL` (URL-safe, no `+/=`)
4. Append to URL fragment: `https://sekundo.app/#/view?data=<base64url_blob>`

**Why the fragment (`#`)?** Fragments are never sent to the server. Even if the app is
hosted on a CDN, the encrypted payload stays 100% client-side.

### 3.2 Tier 2: Deep History Streaming (WebRTC Backup)

```
[Viewer Browser] --request--> [STUN Server] --signal--> [Admin Browser]
                                                              |
[Viewer Browser] <-------- RTCDataChannel (P2P) -------------|
                    (archive arrays streamed from localStorage)
```

**When triggered:** Viewer clicks "Load full history" or requests territory records
outside the Horizon Window.

**Signaling:** Public STUN server (e.g., `stun:stun.l.google.com:19302`).
The offer/answer SDP exchange happens via a one-time token embedded in the
original shared link or scanned via QR code.

**Data flow:** Admin's browser streams archive arrays directly from its localStorage
to the viewer's active memory session. Nothing persists on the viewer side after tab close.

---

## 4. Data Models

### 4.1 Path Key System (Infinite Depth Addressing)

```
Depth 1:  01                    → Event Group
Depth 2:  01-01                 → Specific Event
Depth 3:  01-01-01              → Primary Role/Slot
Depth 4:  01-01-01-01           → Sub-task under that role
Depth N:  01-01-01-01-...-NN    → Infinite nesting
```

**Territory variant:**
```
03-01          → Territory category 03, territory #01
03-01-01       → City #03, neighborhood #01, territory #01
```

**Rules:**
- Split on `-`, parse each segment as integer.
- Sibling = same prefix, different last segment.
- Parent = key with last segment removed.
- Sorting: lexicographic on integer arrays (not string comparison).

### 4.2 CSV Schema

| Column | Required | Description |
|---|---|---|
| `_key` | ✅ | Path key string (always first column) |
| `_type` | ✅ | `slot`, `territory`, `header`, `note` |
| `label` | ✅ | Human-readable name |
| `value` | ❌ | Assigned person or data |
| `email` | ❌ | For notification dispatch |
| `_meta_json` | ❌ | Arbitrary JSON metadata |

**Parsing rule:** Always by header name, never by column index. The `_key` column
is the only column with a reserved name that must not be renamed.

### 4.3 PDF Coordinate Map (localStorage)

```json
{
  "template_<sha256_first8>": {
    "01-01-01": {
      "x": 120,
      "y": 350,
      "page": 1,
      "printMode": "valueOnly",
      "label": "Presidente"
    }
  }
}
```

**Print modes:**
- `valueOnly` — Writes only the assigned value (for pre-printed forms).
- `keyAndValue` — Writes `label: value` (for blank-page reports).

---

## 5. Security Model

### 5.1 Encryption
- **Algorithm:** AES-256-GCM via Web Crypto API.
- **Key derivation:** PBKDF2 (passphrase → 256-bit key, 100k iterations, SHA-256).
- **IV:** Random 12-byte nonce generated per encryption.
- **Payload format:** `<iv_base64>.<ciphertext_base64>` (dot-separated).

### 5.2 Sharing Flow
1. Admin clicks "Share Event".
2. System serializes the Horizon Window payload.
3. Compresses with gzip.
4. Encrypts with AES-GCM using the admin-chosen passphrase.
5. Encodes to Base64URL.
6. Generates URL: `https://sekundo.app/#/view?data=<blob>`.
7. Admin shares the URL via email/link.
8. Admin shares the passphrase via WhatsApp/verbal (separate channel).

### 5.3 Viewer Decryption
1. Viewer opens URL.
2. App extracts `data` param from fragment (never touches the server).
3. Viewer enters passphrase.
4. App derives key via PBKDF2, decrypts with AES-GCM.
5. Inflates gzip payload.
6. Renders schedule in read-only mode, entirely in browser memory.
7. Tab close = all data evaporates.

---

## 6. Chat Architecture (WebRTC P2P)

- **Protocol:** RTCDataChannel over WebRTC.
- **Signaling:** QR code (co-located) or token exchange via shared link + public STUN.
- **Persistence:** Zero. Messages live only in RAM.
- **Lifecycle:** Chat room exists only while both peers have the event open.
- **Encryption:** DTLS (built into WebRTC by default).

---

## 7. Auto-Rollover Engine

```
On app open:
  1. Read lastRolloverDate from localStorage
  2. Calculate gap = periods between lastRolloverDate and now
  3. For each missed period (chronologically):
     a. Freeze current skeleton data → push to archive[]
     b. Clear all `value` fields in the active skeleton
     c. Advance date pointers
     d. Update lastRolloverDate
  4. Save updated state to localStorage
```

**Edge cases handled:**
- App closed for 1 day → no rollover (within same period).
- App closed for 3 weeks (weekly event) → 3 sequential rollovers.
- App closed for 2 months (monthly event) → 2 sequential rollovers.
- Annual event → rollover only if a full year has passed.

---

## 8. Backend Architecture (Stateless Microservice)

### 8.1 Overview

The Sekundo backend is a **stateless FastAPI microservice** with zero database
connections. It provides three capabilities that cannot run purely client-side:

| Capability | Why Server-Side? |
|---|---|
| **PDF Processing** | PyMuPDF (C-based) is far more reliable than client-side JS PDF parsing for AcroForm extraction and text anchor detection. |
| **WebRTC Signaling** | P2P connections require an initial rendezvous point for SDP exchange. The server holds ephemeral rooms (5-min TTL, in-memory only). |
| **Email Dispatch** | API keys for Resend/SendGrid cannot be exposed in client-side code. |

### 8.2 Directory Structure

```
Sekundo/packages/backend/
├── main.py                     # FastAPI app factory + CORS config
├── requirements.txt            # Python dependencies
├── .env.example                # Isolated env vars (SEKUNDO_* prefix)
└── routers/
    ├── __init__.py
    ├── health_router.py        # GET /health (liveness probe)
    ├── pdf_router.py           # POST /pdf/extract-fields
    │                           # POST /pdf/detect-anchors
    │                           # POST /pdf/fill
    └── signaling_router.py     # POST /signal/room (create)
                                # GET/POST /signal/room/:id/offer
                                # GET/POST /signal/room/:id/answer
                                # GET/POST /signal/room/:id/candidates/:role
```

### 8.3 Deployment

- **Platform:** Render (separate service from Assistente-Moeda)
- **URL:** `https://sekundo-api.onrender.com`
- **Build command:** `pip install -r requirements.txt`
- **Start command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
- **Environment variables:** Set in Render dashboard (never in shared `.env`)

### 8.4 Signaling Room Lifecycle

```
t=0s    Admin creates room     → room_id: "a1b2c3d4"
t=1s    Admin posts SDP offer  → stored in memory
t=3s    Viewer polls offer     → receives SDP offer
t=4s    Viewer posts answer    → stored in memory
t=5s    Admin polls answer     → receives SDP answer
t=6s    P2P connection established (direct browser-to-browser)
t=300s  Room auto-expires      → memory freed (even if never used)
```

Zero persistent storage. Zero database writes. Zero audit trail.
