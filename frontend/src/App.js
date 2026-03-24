import React, { useState, useEffect } from "react";
import { initNakama } from "./nakama";
import Login from "./Login";
import Lobby from "./Lobby";
import Game from "./Game";

export default function App() {
  const [screen, setScreen] = useState(() =>
    localStorage.getItem("username") && localStorage.getItem("deviceId") ? "reconnecting" : "login"
  );
  const [socket, setSocket] = useState(null);
  const [session, setSession] = useState(null);
  const [matchId, setMatchId] = useState(null);
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    if (screen === "reconnecting") {
      const username = localStorage.getItem("username");
      initNakama(username)
        .then(({ socket, session }) => {
          setSocket(socket);
          setSession(session);
          setScreen("lobby");
        })
        .catch(() => {
          setLoginError("Reconnection failed. Please log in again.");
          setScreen("login");
        });
    }
  }, [screen]);

  const handleLogin = async (username) => {
    setScreen("loading");
    setLoginError("");
    localStorage.removeItem("deviceId"); // force fresh identity on explicit login
    try {
      const { socket, session } = await initNakama(username);
      setSocket(socket);
      setSession(session);
      setScreen("lobby");
    } catch (e) {
      console.error("Login failed:", e);
      setLoginError("Failed to connect to server. Is Nakama running?");
      setScreen("login");
    }
  };

  const handleMatchFound = (matchId) => {
    setMatchId(matchId);
    setScreen("game");
  };

  const handleBackToLobby = () => {
    setMatchId(null);
    setScreen("lobby");
  };

  const handleHome = () => {
    const username = localStorage.getItem("username");
    localStorage.clear();
    if (username) localStorage.setItem("username", username);
    setSocket(null);
    setSession(null);
    setMatchId(null);
    setLoginError("");
    setScreen("login");
  };

  if (screen === "loading" || screen === "reconnecting") return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)" }}>
      <div style={{ color: "#a78bfa", fontSize: "1.2rem", fontFamily: "Segoe UI, sans-serif" }}>Connecting...</div>
    </div>
  );

  if (screen === "login") return <Login onLogin={handleLogin} error={loginError} />;
  if (screen === "lobby") return <Lobby socket={socket} session={session} onMatchFound={handleMatchFound} onHome={handleHome} />;
  if (screen === "game") return <Game socket={socket} matchId={matchId} onBack={handleBackToLobby} onHome={handleHome} />;
}
