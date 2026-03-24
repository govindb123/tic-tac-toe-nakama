# Multiplayer Tic-Tac-Toe with Nakama

A production-ready, server-authoritative multiplayer Tic-Tac-Toe game built with React (frontend) and Nakama (backend).

---

## Features

- **Server-authoritative game logic** — all moves validated on the server, no client-side cheating possible
- **Room-code matchmaking** — create a room, share the 6-character code, friend joins instantly
- **Real-time game state** — WebSocket-based live updates via Nakama match engine
- **Rematch system** — both players vote to rematch without leaving the match
- **Turn timer** — 30-second countdown per turn; auto-forfeit on timeout
- **Leaderboard** — global win rankings persisted in Nakama, displayed in lobby
- **Graceful disconnect handling** — opponent-left notification broadcast on leave
- **Concurrent game support** — each room is an isolated Nakama authoritative match

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, nakama-js |
| Backend | Nakama (heroiclabs/nakama) |
| Database | CockroachDB (bundled with Nakama docker-compose) |
| Containerization | Docker / Docker Compose |

---

## Project Structure

```
tic-tac-toe-nakama/
├── backend/
│   ├── docker-compose.yml       # Nakama + CockroachDB services
│   └── modules/
│       └── match_handler.js     # All server-side game logic
└── frontend/
    ├── src/
    │   ├── App.js               # Screen router (Login → Lobby → Game)
    │   ├── nakama.js            # Nakama client + auth
    │   ├── Login.js             # Username entry
    │   ├── Lobby.js             # Room create/join + leaderboard
    │   └── Game.js              # Game board + timer + rematch
    └── package.json
```

---

## Setup & Installation

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) + Docker Compose
- [Node.js](https://nodejs.org/) 16+

### 1. Start the Backend

```bash
cd backend
docker compose up -d
```

Nakama will be available at `http://localhost:7350`  
Nakama console at `http://localhost:7351` (admin / password)

Wait ~15 seconds for CockroachDB to initialize before the first request.

### 2. Start the Frontend

```bash
cd frontend
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000)

---

## How to Test Multiplayer

1. Open two browser tabs (or two different browsers) at `http://localhost:3000`
2. In **Tab 1**: enter a username → click **Create Room** → copy the 6-character code → click **Enter Game Room**
3. In **Tab 2**: enter a different username → click **Join Room** → paste the code → click **Join**
4. Both tabs enter the game screen and the match starts automatically
5. Take turns clicking cells — only the current player's clicks are accepted by the server
6. After the game ends, both players can click **Rematch** to play again in the same room

---

## Architecture & Design Decisions

### Server-Authoritative Match Engine

All game logic runs inside Nakama's JavaScript runtime match handler (`match_handler.js`). The client only sends:
- `op_code 1` — move (cell index)
- `op_code 10` — resync request (polling until both players join)
- `op_code 20` — rematch vote

The server validates every move and broadcasts the authoritative state back to all clients.

### Player Identity

Players are identified by `username` as the consistent key throughout the match lifecycle (`matchJoin`, `matchLeave`, `matchLoop` sender lookup). Nakama's JS runtime presence objects expose `username` reliably.

### Turn Timer

The server tracks `turnStartTick` on every valid move. Each `matchLoop` tick calculates elapsed time. At 30 seconds the server auto-forfeits the current player, writes the leaderboard, and broadcasts the result. The client receives `op_code 5` timer ticks every second for the countdown UI.

### Room-Code Matchmaking

`rpcCreateRoom` creates a Nakama authoritative match and stores `{ matchId }` in Nakama storage under a random 6-character code. `rpcJoinRoom` reads that storage entry and returns the `matchId`. Both players then call `socket.joinMatch(matchId)` independently.

### Leaderboard

Uses Nakama's built-in leaderboard (`tictactoe_wins`) with `operator: incr` — each win increments the player's score. Writes happen server-side in `writeLeaderboard()` after every game conclusion (win or timeout). Draw results in 0 points for both players.

---

## API / Server Configuration

### Nakama RPC Endpoints

| RPC ID | Payload | Response |
|--------|---------|----------|
| `create_room` | `{}` | `{ code: "ABC123", matchId: "uuid.nakama1" }` |
| `join_room` | `{ code: "ABC123" }` | `{ matchId: "uuid.nakama1" }` |

### Match op_codes

| op_code | Direction | Description |
|---------|-----------|-------------|
| 1 | Server → Client | Full game state broadcast |
| 3 | Server → Client | Opponent left |
| 4 | Server → Client | Rematch pending (one player voted) |
| 5 | Server → Client | Timer tick `{ timeLeft, currentPlayer }` |
| 1 | Client → Server | Player move `{ index: 0-8 }` |
| 10 | Client → Server | Resync request |
| 20 | Client → Server | Rematch vote |

### Nakama Configuration (docker-compose)

```
--runtime.js_entrypoint match_handler.js
--logger.level DEBUG
```

---

## Deployment

### Deploy Backend (example: DigitalOcean Droplet / any VPS)

```bash
# On your server
git clone <repo>
cd tic-tac-toe-nakama/backend
docker compose up -d
```

Open ports `7350` (API) and `7349` (gRPC) in your firewall/security group.

### Deploy Frontend

Update `nakama.js` with your server's public IP or domain:

```js
const client = new Client("defaultkey", "YOUR_SERVER_IP", 7350, false);
```

Then build and deploy:

```bash
cd frontend
npm run build
# deploy the build/ folder to Netlify / Vercel / S3 / any static host
```

---

## Environment Notes

- Default Nakama server key: `defaultkey` (change in production via `--server-key` flag)
- CockroachDB runs in single-node insecure mode — use a managed DB in production
- For HTTPS/WSS deployments, set `useSSL: true` in `nakama.js` and configure a reverse proxy (nginx + certbot)
