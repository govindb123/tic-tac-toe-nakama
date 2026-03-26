import React, { useState } from "react";
import "./Login.css";

export default function Login({ onLogin, error }) {
  const [username, setUsername] = useState(localStorage.getItem("username") || "");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (username.trim()) onLogin(username.trim());
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <h1 className="login-title">Tic Tac Toe</h1>
        <p className="login-sub">Enter your username to play</p>
        {error && <p style={{ color: "#f87171", fontSize: "0.85rem", textAlign: "center" }}>{error}</p>}
        <form onSubmit={handleSubmit} className="login-form">
          <input
            className="login-input"
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={20}
            autoFocus
          />
          <button className="login-btn" type="submit" disabled={!username.trim()}>
            Let's Play →
          </button>
        </form>
      </div>
    </div>
  );
}
