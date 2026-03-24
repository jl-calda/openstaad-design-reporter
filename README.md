# OpenSTAAD Design Reporter

A web application that communicates with STAAD.Pro's OpenSTAAD API via a WebSocket bridge server. View and report structural analysis data from your browser.

## Architecture

```
┌─────────────┐    WebSocket     ┌──────────────┐    COM/ActiveX    ┌───────────┐
│   Web App   │ ◄──────────────► │ Bridge Server│ ◄────────────────► │ STAAD.Pro │
│  (Browser)  │   JSON-RPC       │  (Python)    │    OpenSTAAD API   │ (Windows) │
└─────────────┘                  └──────────────┘                    └───────────┘
```

The browser cannot directly access COM objects, so a Python bridge server runs locally on the Windows machine. It connects to STAAD.Pro via the OpenSTAAD COM API and exposes the data over WebSocket.

## Quick Start

### 1. Start the Bridge Server

**For development (mock data, no STAAD.Pro needed):**

```bash
cd bridge
pip install websockets
python mock_bridge.py
```

**For production (requires Windows + STAAD.Pro):**

```bash
cd bridge
pip install websockets pywin32
python openstaad_bridge.py
```

### 2. Start the Web App

```bash
npm install
npm run dev
```

Open `http://localhost:5173` and click **Connect**.

## Features

- Real-time connection to STAAD.Pro via WebSocket bridge
- View project info, nodes, members, load cases, and supports
- Fetch analysis results: node displacements and support reactions
- Clean dashboard UI with data tables
- Mock bridge server for development without STAAD.Pro

## Project Structure

```
├── bridge/
│   ├── openstaad_bridge.py   # Production bridge (COM + WebSocket)
│   ├── mock_bridge.py        # Mock bridge for development
│   └── requirements.txt
├── src/
│   ├── lib/
│   │   ├── bridge-client.ts  # WebSocket client
│   │   └── openstaad-api.ts  # Typed API wrapper
│   ├── hooks/
│   │   └── useBridge.ts      # React hook for bridge connection
│   ├── components/
│   │   ├── ConnectionPanel.tsx
│   │   ├── ProjectInfoCard.tsx
│   │   ├── DataTable.tsx
│   │   ├── StatsBar.tsx
│   │   └── ResultsPanel.tsx
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
└── package.json
```

## Protocol

The bridge uses a JSON-RPC style protocol over WebSocket:

```json
// Request
{ "id": 1, "method": "getNodes", "params": {} }

// Response
{ "id": 1, "result": { "count": 18, "nodes": [...] }, "error": null }
```

### Available Methods

| Method | Params | Description |
|---|---|---|
| `connect` | — | Connect to running STAAD.Pro instance |
| `disconnect` | — | Release COM connection |
| `getProjectInfo` | — | Get project name and file path |
| `getNodes` | — | Get all node coordinates |
| `getBeams` | — | Get all member incidences |
| `getMemberProperties` | `{ beamId }` | Get section and material for a member |
| `getLoadCases` | — | Get all load case titles |
| `getSupports` | — | Get support node list |
| `getNodeDisplacements` | `{ loadCase }` | Get displacements for all nodes |
| `getSupportReactions` | `{ loadCase }` | Get reactions at supports |
| `getMemberForces` | `{ beamId, loadCase }` | Get end forces for a member |

## Tech Stack

- **Web App:** React + TypeScript + Vite + Tailwind CSS
- **Bridge:** Python + websockets + pywin32
