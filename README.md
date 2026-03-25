# Multiplayer Tic-Tac-Toe with Nakama

A production-ready, server-authoritative multiplayer Tic-Tac-Toe game built with React (frontend) and Nakama (backend).

🎮 **Live Demo:** 

Frontend:-  https://tic-tac-toe-nakama-govind.vercel.app 

Backend:-  https://unfreezable-cushily-leoma.ngrok-free.dev

> Note: The backend is exposed using ngrok (free tier). If the backend is not accessible, please contact me to restart the server.
---

## Features

- **Server-authoritative game logic** — all moves validated on the server, no client-side cheating possible
- **Room-code matchmaking** — create a room, share the 6-character code, friend joins instantly
- **Real-time game state** — WebSocket-based live updates via Nakama match engine
- **Rematch system** — both players vote to rematch without leaving the match
- **Turn timer** — 30-second countdown per turn; auto-forfeit on timeout
- **Leaderboard** — global win rankings persisted in PostgreSQL via Nakama, displayed in lobby
- **Graceful disconnect handling** — opponent-left notification broadcast on leave
- **Concurrent game support** — each room is an isolated Nakama authoritative match
- **Responsive UI** — optimized for both desktop and mobile devices
- **Session persistence** — auto-reconnects on page refresh using stored device identity

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, nakama-js |
| Backend | Nakama (heroiclabs/nakama) |
| Database | PostgreSQL 16 |
| Containerization | Docker / Docker Compose |
| Backend Tunnel | ngrok (free tier) |
| Frontend Hosting | Vercel |

---

## Project Structure

```
tic-tac-toe-nakama/
├── backend/
│   ├── docker-compose.yml       # Nakama + PostgreSQL services
│   └── modules/
│       └── match_handler.js     # All server-side game logic
└── frontend/
    ├── src/
    │   ├── App.js               # Screen router (Login → Lobby → Game)
    │   ├── nakama.js            # Nakama client + auth + env config
    │   ├── Login.js             # Username entry screen
    │   ├── Lobby.js             # Room create/join + leaderboard
    │   └── Game.js              # Game board + timer + rematch
    └── package.json
```

---

## Setup & Installation

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) + Docker Compose
- [Node.js](https://nodejs.org/) 16+
- [ngrok](https://ngrok.com/) (for public backend access)

### 1. Start the Backend

```bash
cd backend
docker compose up -d
```

- Nakama API available at `http://localhost:7350`
- Nakama console at `http://localhost:7351` (admin / password)
- PostgreSQL starts with a health check — Nakama waits until it's ready automatically

### 2. Expose Backend via ngrok

```bash
ngrok http 7350
```

Copy the HTTPS URL shown (e.g. `https://xxxx-xx-xx.ngrok-free.app`)

### 3. Start the Frontend

```bash
cd frontend
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000)

To connect to the ngrok backend locally, create a `.env` file in the `frontend/` folder:

```
REACT_APP_NAKAMA_HOST=xxxx-xx-xx.ngrok-free.app
REACT_APP_NAKAMA_PORT=443
REACT_APP_NAKAMA_SSL=true
```

---

## How to Test Multiplayer

1. Open two browser tabs (or two different browsers) at [https://tic-tac-toe-nakama-govind.vercel.app](https://tic-tac-toe-nakama-govind.vercel.app)
2. In **Tab 1**: enter a username → click **Create Room** → copy the 6-character code → click **Enter Game Room**
3. In **Tab 2**: enter a different username → click **Join Room** → paste the code → click **Join**
4. Both tabs enter the game screen and the match starts automatically
5. Take turns clicking cells — only the current player's clicks are accepted by the server
6. After the game ends, both players can click **Rematch** to play again in the same room
7. Check the **Leaderboard** in the lobby to see win rankings update after each game

---

## Architecture & Design Decisions

### Server-Authoritative Match Engine

All game logic runs inside Nakama's JavaScript runtime match handler (`match_handler.js`). The client only sends:

| op_code | Direction | Payload |
|---------|-----------|---------|
| 1 | Client → Server | `{ index: 0-8 }` — player move |
| 10 | Client → Server | `{ resync: true }` — request current state |
| 20 | Client → Server | `{ rematch: true }` — rematch vote |

The server validates every move and broadcasts the authoritative state back to all clients. Clients cannot manipulate game state — any invalid move (wrong turn, occupied cell, out of range) is silently rejected.

### Player Identity & Authentication

Players authenticate via Nakama's device authentication using a unique `deviceId` generated from their username + timestamp + random string. This is stored in `localStorage` for session persistence across page refreshes. Players are identified by `username` throughout the match lifecycle.

### Turn Timer

The server tracks `turnStartTick` on every valid move. Each `matchLoop` tick (running at 10 ticks/second) calculates elapsed time:

- Every second, the server broadcasts `op_code 5` with `{ timeLeft, currentPlayer }`
- At 30 seconds, the server auto-forfeits the current player, the opponent wins, leaderboard is updated, and result is broadcast
- The client also runs a local `setInterval` countdown synced to server ticks for smooth UI updates

### Room-Code Matchmaking

- `rpcCreateRoom` — creates a Nakama authoritative match, stores `{ matchId }` in Nakama storage under a random 6-character alphanumeric code
- `rpcJoinRoom` — reads the storage entry by code and returns the `matchId`
- Both players call `socket.joinMatch(matchId)` independently
- Rooms are isolated — each match has its own state, players, and timer

### Concurrent Game Support

Each room creates a separate Nakama authoritative match instance. Match state is fully isolated — multiple games can run simultaneously without interference. The `matchJoinAttempt` handler rejects a third player from joining an active room.

### Leaderboard

Uses Nakama's built-in leaderboard (`tictactoe_wins`) with `operator: incr`:

- Each win increments the player's score by 1
- Writes happen server-side in `writeLeaderboard()` after every game conclusion (win or timeout)
- Draw results in 0 points for both players
- Top 10 players are displayed in the lobby, refreshable on demand
- Data is persisted in PostgreSQL — survives server restarts

### Rematch System

After a game ends, either player can vote for a rematch via `op_code 20`. The server tracks votes — when both players vote, the board resets, timer resets to 30s, and a new game starts in the same match without reconnecting.

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
| 1 | Server → Client | Full game state `{ board, currentPlayer, winner, players, ready, timeLeft }` |
| 3 | Server → Client | Opponent left `{ opponentLeft: true }` |
| 4 | Server → Client | Rematch pending `{ rematchPending: true, votes, needed }` |
| 5 | Server → Client | Timer tick `{ timeLeft, currentPlayer }` |
| 1 | Client → Server | Player move `{ index: 0-8 }` |
| 10 | Client → Server | Resync request `{ resync: true }` |
| 20 | Client → Server | Rematch vote `{ rematch: true }` |

### Nakama Configuration (docker-compose)

```
--runtime.js_entrypoint match_handler.js
--logger.level DEBUG
--database.address postgres@postgres:5432/nakama
```

---

## Deployment

| Service | URL |
|---------|-----|
| Frontend (Vercel) | https://tic-tac-toe-nakama-govind.vercel.app |
| Backend (ngrok) | Active when server is running — contact me for current URL |

### Backend — Local + ngrok

The backend runs locally via Docker and is exposed publicly using **ngrok** (free tier).

```bash
# Step 1: Start backend services (Nakama + PostgreSQL)
cd backend
docker compose up -d

# Step 2: Expose Nakama port publicly
ngrok http 7350
```

Copy the ngrok HTTPS URL and update the Vercel environment variables.

### Frontend — Vercel

The frontend is deployed on **Vercel** with the following environment variables set in project settings:

```
REACT_APP_NAKAMA_HOST = xxxx-xx-xx.ngrok-free.app
REACT_APP_NAKAMA_PORT = 443
REACT_APP_NAKAMA_SSL  = true
```

Push to GitHub — Vercel auto-deploys on every commit.

---

## ⚠️ Important Note

The backend is exposed using **ngrok (free tier)**.

- Please ensure to access the project within the **active time window**
- The ngrok URL changes every time the server restarts
- If the backend is not reachable, please **contact me to restart the server**

---

## Environment Notes

- Default Nakama server key: `defaultkey` (change in production via `--server-key` flag)
- PostgreSQL data is persisted via Docker volume (`postgres_data`) — leaderboard and sessions survive restarts
- SSL/WSS is controlled via `REACT_APP_NAKAMA_SSL` environment variable
- `REACT_APP_NAKAMA_HOST` and `REACT_APP_NAKAMA_PORT` allow zero-code-change environment switching
