import React, { useEffect, useState, useCallback, useRef } from "react";
import { client } from "./nakama";
import "./Lobby.css";

export default function Lobby({ socket, session, onMatchFound, onHome }) {
  const [mode, setMode] = useState(null);
  const [roomCode, setRoomCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const matchIdRef = useRef(null);

  const username = localStorage.getItem("username") || "Player";

  const fetchLeaderboard = useCallback(async () => {
    try {
      const result = await client.listLeaderboardRecords(session, "tictactoe_wins", [], 10);
      setLeaderboard(result.records || []);
    } catch (e) { console.error("fetchLeaderboard error:", e); }
  }, [session]);

  useEffect(() => { fetchLeaderboard(); }, [fetchLeaderboard]);

  const createRoom = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await client.rpc(session, "create_room", {});
      const payload = typeof res.payload === "string" ? JSON.parse(res.payload) : res.payload;
      const { code, matchId } = payload;
      setRoomCode(code);
      setMode("create");
      matchIdRef.current = matchId;
    } catch (e) {
      console.error("createRoom error:", e);
      setError("Failed to create room: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = async () => {
    if (!joinCode.trim()) return;
    setError("");
    setWaiting(true);
    try {
      const code = joinCode.trim().toUpperCase();
      const res = await client.rpc(session, "join_room", { code });
      const payload = typeof res.payload === "string" ? JSON.parse(res.payload) : res.payload;
      const { matchId } = payload;
      onMatchFound(matchId);
    } catch (e) {
      console.error("joinRoom error:", e);
      setError("Room not found. Check the code and try again.");
      setWaiting(false);
    }
  };

  const reset = () => {
    setMode(null);
    setRoomCode("");
    setJoinCode("");
    setWaiting(false);
    setError("");
  };

  return (
    <div className="lobby-wrapper">
      <div className="lobby-card">
        <div className="lobby-header">
          <h1 className="lobby-title">Tic Tac Toe</h1>
          <span className="lobby-user">👤 {username}</span>
          <button className="cancel-btn" onClick={onHome} style={{fontSize:"0.8rem"}}>🚪 Logout</button>
        </div>

        <div className="matchmaking-section">
          {error && <p className="error-msg" style={{marginBottom: "12px"}}>{error}</p>}

          {!mode && (
            <div className="mode-btns">
              <button className="find-btn" onClick={createRoom} disabled={loading}>
                {loading ? "Creating..." : "🎮 Create Room"}
              </button>
              <button className="join-btn" onClick={() => setMode("join")} disabled={loading}>🔗 Join Room</button>
            </div>
          )}

          {mode === "create" && (
            <div className="room-info">
              <p className="room-label">Share this code with your friend:</p>
              <div className="room-code">{roomCode}</div>
              <p className="room-label">Then click below to enter the game and wait</p>
              <button className="find-btn" onClick={() => onMatchFound(matchIdRef.current)} style={{ marginTop: "8px" }}>
                ▶ Enter Game Room
              </button>
              <button className="cancel-btn" onClick={reset}>Cancel</button>
            </div>
          )}

          {mode === "join" && (
            <div className="join-form">
              <p className="room-label">Enter room code:</p>
              <input
                className="code-input"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                placeholder="AB12CD"
                maxLength={6}
                autoFocus
              />
              {error && <p className="error-msg">{error}</p>}
              <div className="join-actions">
                <button className="find-btn" onClick={joinRoom} disabled={waiting || !joinCode.trim()}>
                  {waiting ? "Joining..." : "Join →"}
                </button>
                <button className="cancel-btn" onClick={reset}>Back</button>
              </div>
            </div>
          )}
        </div>

        <div className="leaderboard-section">
          <div className="leaderboard-header">
            <h2>🏆 Leaderboard</h2>
            <button className="refresh-btn" onClick={fetchLeaderboard}>↻</button>
          </div>
          {leaderboard.length === 0 ? (
            <p className="no-records">No records yet. Play a game!</p>
          ) : (
            <ul className="leaderboard-list">
              {leaderboard.map((record, i) => (
                <li key={record.owner_id} className={`leaderboard-item ${i === 0 ? "gold" : i === 1 ? "silver" : i === 2 ? "bronze" : ""}`}>
                  <span className="rank">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}</span>
                  <span className="lb-username">{record.username}</span>
                  <span className="lb-score">{record.score} wins</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
