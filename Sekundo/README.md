# Sekundo

> *"Para que você tenha o segundo necessário, para absorver toda a energia do sol que você pode receber naquele segundo."*

Agnostic skeleton engine for temporal event automation. Local-first, serverless, infinite.

## Architecture

- **100% Local-First** — All data lives in your browser. No mandatory database. No server custody.
- **Infinite Depth Skeletons** — Numeric path keys (`01-01-01-01`) create any hierarchy without code changes.
- **CSV as Source of Truth** — Edit in Excel, import, done. The system adapts.
- **Hybrid PDF Engine** — Auto-detect form fields or click-to-place coordinates on any PDF.
- **Encrypted Sharing** — AES-GCM payloads in URLs. Passphrase shared out-of-band.
- **P2P Chat** — Ephemeral WebRTC messaging. Zero server trace.

## Project Structure

```
Sekundo/
├── docs/                  # Architecture, manifesto, CSV spec
├── packages/
│   ├── core/              # Platform-agnostic brain (TypeScript)
│   └── app/               # Expo app (Web + Mobile)
├── package.json           # Monorepo root (npm workspaces)
└── README.md
```

## Quick Start

```bash
# Install all dependencies
npm install

# Run core tests
npm run test:core

# Start Expo dev server (web)
npm run dev:web
```

## License

Private — All rights reserved.
