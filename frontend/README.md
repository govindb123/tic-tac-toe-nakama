# Multiplayer Tic-Tac-Toe — Frontend

React 18 frontend for the multiplayer Tic-Tac-Toe game powered by Nakama backend.

🎮 **Live Demo:** [https://tic-tac-toe-nakama-govind.vercel.app](https://tic-tac-toe-nakama-govind.vercel.app)

🖥️ **Backend:** [https://tic-tac-toe-nakama-o8hr.onrender.com](https://tic-tac-toe-nakama-o8hr.onrender.com)

The render server may take **~30 or 60 seconds to wake up** after inactivity

---

## Tech Stack

| | |
|---|---|
| Framework | React 18 |
| Nakama SDK | nakama-js |
| Hosting | Vercel |
| Styling | Plain CSS (responsive, mobile-optimized) |

---

## Project Structure

```
frontend/
├── public/
└── src/
    ├── App.js        # Screen router: Login → Lobby → Game
    ├── nakama.js     # Nakama client, device auth, socket connection
    ├── Login.js      # Username entry screen
    ├── Lobby.js      # Create/join room + leaderboard
    ├── Game.js       # Game board, timer, rematch
    ├── Login.css
    ├── Lobby.css
    └── Game.css
```

---

## Setup & Installation

### Prerequisites

- Node.js 16+
- Backend running (see `/backend/README` or root `README.md`)

### Install & Run

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000)

### Environment Variables

Create a `.env` file in this folder to point to your backend:

```
REACT_APP_NAKAMA_HOST=tic-tac-toe-nakama-o8hr.onrender.com
REACT_APP_NAKAMA_PORT=443
REACT_APP_NAKAMA_SSL=true
```

For local backend (default):

```
REACT_APP_NAKAMA_HOST=127.0.0.1
REACT_APP_NAKAMA_PORT=7350
REACT_APP_NAKAMA_SSL=false
```

---

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Run in development mode at `http://localhost:3000` |
| `npm run build` | Build for production into the `build/` folder |
| `npm test` | Launch test runner in interactive watch mode |

---

## Screens

### Login
- Enter a username to authenticate
- Uses Nakama device authentication
- Session is persisted in `localStorage` — auto-reconnects on page refresh

### Lobby
- Create a room → get a 6-character code → share with friend
- Join a room → enter the code → enter the game
- Leaderboard shows top 10 players by wins (refreshable)

### Game
- Real-time board updated via WebSocket
- Turn indicator shows whose move it is
- 30-second countdown timer per turn (auto-forfeit on timeout)
- Rematch button after game ends — both players must vote
- Back to Lobby / Home buttons available at all times

---

## Deployment (Vercel)

1. Push this folder (or the full repo) to GitHub
2. Import the project on [vercel.com](https://vercel.com)
3. Set root directory to `frontend`
4. Add environment variables in Vercel project settings:

```
REACT_APP_NAKAMA_HOST = tic-tac-toe-nakama-o8hr.onrender.com
REACT_APP_NAKAMA_PORT = 443
REACT_APP_NAKAMA_SSL  = true
```

5. Deploy — Vercel auto-deploys on every push to main

---

## ⚠️ Important Note

The backend is hosted on **Render (free tier)**.

- The server may take **~30 seconds to wake up** after inactivity
- If the backend is unreachable, please wait a moment and refresh
