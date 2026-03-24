import React, { useEffect, useState, useRef } from "react";
import "./Game.css";

const WINNING_LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

function getWinningCells(board) {
  for (const [a, b, c] of WINNING_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return [a, b, c];
  }
  return [];
}

export default function Game({ socket, matchId, onBack, onHome }) {
  const [board, setBoard] = useState(Array(9).fill(""));
  const [currentPlayer, setCurrentPlayer] = useState("X");
  const [winner, setWinner] = useState(null);
  const [mySymbol, setMySymbol] = useState(null);
  const [players, setPlayers] = useState([]);
  const [ready, setReady] = useState(false);
  const [opponentLeft, setOpponentLeft] = useState(false);
  const [rematchPending, setRematchPending] = useState(false);
  const [myRematchVoted, setMyRematchVoted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [timedOutPlayer, setTimedOutPlayer] = useState(null);

  const joinedMatchIdRef = useRef(null);
  const readyRef = useRef(false);
  const timerRef = useRef(null);
  const username = localStorage.getItem("username");

  useEffect(() => {
    socket.onmatchdata = (msg) => {
      try {
        const decoded = typeof msg.data === "string" ? msg.data : new TextDecoder().decode(msg.data);
        const data = JSON.parse(decoded);
        console.log("op_code:", msg.op_code, "data:", data);

        if (msg.op_code === 1 && data.board) {
          setBoard(data.board);
          setCurrentPlayer(data.currentPlayer);
          setWinner(data.winner || null);
          if (data.winner && timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
          if (data.timeLeft !== undefined) {
            setTimeLeft(data.timeLeft);
            if (!data.winner) {
              if (timerRef.current) clearInterval(timerRef.current);
              timerRef.current = setInterval(() => {
                setTimeLeft(prev => (prev > 0 ? prev - 1 : 0));
              }, 1000);
            }
          }
          if (data.timeout) setTimedOutPlayer(data.timedOutPlayer);
          if (data.ready) {
            setReady(true); readyRef.current = true;
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = setInterval(() => {
              setTimeLeft(prev => (prev > 0 ? prev - 1 : 0));
            }, 1000);
          }
          if (data.rematch) {
            if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
            setRematchPending(false);
            setMyRematchVoted(false);
            setTimedOutPlayer(null);
            setTimeLeft(30);
          }
          if (data.players) {
            setPlayers(data.players);
            const me = data.players.find(p => p.username === username);
            if (me) setMySymbol(me.symbol);
          }
        }
        if (msg.op_code === 3) setOpponentLeft(true);
        if (msg.op_code === 4) setRematchPending(true);
        if (msg.op_code === 5) {
          setTimeLeft(data.timeLeft);
          setCurrentPlayer(data.currentPlayer);
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = setInterval(() => {
            setTimeLeft(prev => (prev > 0 ? prev - 1 : 0));
          }, 1000);
        }
      } catch (err) {
        console.error("onmatchdata error:", err);
      }
    };

    socket.joinMatch(matchId)
      .then((joined) => {
        joinedMatchIdRef.current = joined.match_id;
        const interval = setInterval(() => {
          if (readyRef.current) { clearInterval(interval); return; }
          if (joinedMatchIdRef.current) {
            socket.sendMatchState(joined.match_id, 10, JSON.stringify({ resync: true }));
          }
        }, 1000);
        joinedMatchIdRef.interval = interval;
      })
      .catch(err => console.error("joinMatch failed:", err));

    return () => {
      socket.onmatchdata = null;
      if (joinedMatchIdRef.interval) clearInterval(joinedMatchIdRef.interval);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [socket, matchId, username]);

  const handleClick = (index) => {
    if (!ready || board[index] !== "" || winner || mySymbol !== currentPlayer) return;
    socket.sendMatchState(joinedMatchIdRef.current, 1, JSON.stringify({ index }));
  };

  const handleRematch = () => {
    setMyRematchVoted(true);
    socket.sendMatchState(joinedMatchIdRef.current, 20, JSON.stringify({ rematch: true }));
  };

  const winningCells = winner && winner !== "Draw" ? getWinningCells(board) : [];
  const isMyTurn = ready && mySymbol === currentPlayer && !winner;

  const timerPct = (timeLeft / 30) * 100;
  const timerColor = timeLeft > 10 ? "#34d399" : timeLeft > 5 ? "#fbbf24" : "#f87171";

  const statusText = opponentLeft ? "Opponent left the match"
    : !ready ? "Waiting for opponent..."
    : winner ? (
        timedOutPlayer ? `${timedOutPlayer} ran out of time!`
        : winner === "Draw" ? "It's a Draw!"
        : winner === mySymbol ? "You Win! 🎉" : "You Lose 😔"
      )
    : isMyTurn ? "Your turn" : "Opponent's turn";

  const statusClass = opponentLeft || !ready ? "status-waiting"
    : winner ? "status-winner"
    : isMyTurn ? "status-x" : "status-o";

  return (
    <div className="game-wrapper">
      <div className="game-card">
        <div className="game-top-bar">
          <button className="back-btn" onClick={onBack}>← Lobby</button>
          <h1 className="game-title">Tic Tac Toe</h1>
          <button className="back-btn" onClick={onHome}>🚪 Home</button>
        </div>

        {players.length === 2 && (
          <div className="players-row">
            {players.map(p => (
              <div key={p.symbol} className={`player-tag ${p.symbol === "X" ? "tag-x" : "tag-o"} ${p.symbol === currentPlayer && ready && !winner ? "tag-active" : ""}`}>
                {p.symbol} · {p.username} {p.username === username ? "(you)" : ""}
              </div>
            ))}
          </div>
        )}

        <div className={`status-badge ${statusClass}`}>{statusText}</div>

        {ready && !winner && (
          <div className="timer-bar-wrap">
            <div className="timer-bar-track">
              <div className="timer-bar-fill" style={{ width: timerPct + "%", background: timerColor }} />
            </div>
            <span className="timer-label" style={{ color: timerColor }}>{timeLeft}s</span>
          </div>
        )}

        <div className="board">
          {board.map((cell, i) => (
            <div
              key={i}
              className={`cell ${cell === "X" ? "cell-x" : cell === "O" ? "cell-o" : ""} ${winningCells.includes(i) ? "cell-winning" : ""} ${!cell && !winner && isMyTurn ? "cell-hover" : ""}`}
              onClick={() => handleClick(i)}
            >
              {cell && <span className="cell-symbol">{cell}</span>}
            </div>
          ))}
        </div>

        {(winner || opponentLeft) && (
          <div className="end-actions">
            {!opponentLeft && (
              <button className="rematch-btn" onClick={handleRematch} disabled={myRematchVoted}>
                {myRematchVoted ? "Waiting for opponent..." : "🔄 Rematch"}
              </button>
            )}
            {!myRematchVoted && rematchPending && !opponentLeft && (
              <div className="rematch-notice">Opponent wants a rematch!</div>
            )}
            <button className="reset-btn" onClick={onBack}>← Back to Lobby</button>
          </div>
        )}
      </div>
    </div>
  );
}
