var WINNING_LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
var TURN_TIMEOUT_SECONDS = 30;

function checkWinner(board) {
  for (var i = 0; i < WINNING_LINES.length; i++) {
    var a = WINNING_LINES[i][0], b = WINNING_LINES[i][1], c = WINNING_LINES[i][2];
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  for (var j = 0; j < board.length; j++) {
    if (board[j] === "") return null;
  }
  return "Draw";
}

function getKey(p) {
  return p.username || p.userId || p.user_id || p.sessionId || p.session_id || "unknown";
}

function matchInit(ctx, logger, nk, params) {
  return {
    state: {
      board: ["","","","","","","","",""],
      currentPlayer: "X",
      winner: null,
      players: {},
      ready: false,
      rematchVotes: {},
      turnStartTick: 0,
      tickRate: 10,
      gameMode: (params && params.gameMode) || "timed",
    },
    tickRate: 10,
  };
}

function matchJoinAttempt(ctx, logger, nk, dispatcher, tick, state, presence, metadata) {
  var key = getKey(presence);
  // allow rejoin if player is already in the match
  if (state.players[key]) return { state: state, accept: true };
  if (Object.keys(state.players).length >= 2) return { state: state, accept: false };
  return { state: state, accept: true };
}

function matchJoin(ctx, logger, nk, dispatcher, tick, state, presences) {
  var playerCount = Object.keys(state.players).length;
  for (var i = 0; i < presences.length; i++) {
    var p = presences[i];
    var key = getKey(p);
    var userId = p.userId || p.user_id;
    logger.info("Player joining: username=" + p.username + " userId=" + userId + " sessionId=" + p.sessionId + " key=" + key);
    var symbol = playerCount === 0 ? "X" : "O";
    state.players[key] = { username: p.username, userId: userId, symbol: symbol };
    playerCount++;
  }

  var totalPlayers = Object.keys(state.players).length;
  logger.info("matchJoin done, totalPlayers=" + totalPlayers);

  if (totalPlayers >= 2 && !state.ready) {
    state.ready = true;
    state.turnStartTick = tick;
    var playerList = Object.values(state.players).map(function(pl) {
      return { username: pl.username, symbol: pl.symbol };
    });
    dispatcher.broadcastMessage(1, JSON.stringify({
      board: state.board, currentPlayer: state.currentPlayer,
      winner: null, players: playerList, ready: true,
      timeLeft: TURN_TIMEOUT_SECONDS, gameMode: state.gameMode,
    }));
  }
  return { state: state };
}

function matchLeave(ctx, logger, nk, dispatcher, tick, state, presences) {
  for (var i = 0; i < presences.length; i++) {
    var key = getKey(presences[i]);
    delete state.players[key];
  }
  if (state.ready) {
    state.ready = false;
    dispatcher.broadcastMessage(3, JSON.stringify({ opponentLeft: true }));
  }
  return { state: state };
}

function matchLoop(ctx, logger, nk, dispatcher, tick, state, messages) {
  // --- Turn timer (timed mode only) ---
  if (state.gameMode === "timed" && state.ready && !state.winner) {
    var elapsed = (tick - state.turnStartTick) / state.tickRate;
    var timeLeft = Math.max(0, Math.ceil(TURN_TIMEOUT_SECONDS - elapsed));

    // broadcast timer every second (every tickRate ticks)
    if ((tick - state.turnStartTick) % state.tickRate === 0 && elapsed > 0) {
      dispatcher.broadcastMessage(5, JSON.stringify({ timeLeft: timeLeft, currentPlayer: state.currentPlayer }));
    }

    if (timeLeft <= 0) {
      // forfeit current player's turn — switch to opponent
      var forfeiter = state.currentPlayer;
      state.currentPlayer = forfeiter === "X" ? "O" : "X";
      state.winner = state.currentPlayer; // opponent wins by timeout
      var playerList = Object.values(state.players).map(function(pl) {
        return { username: pl.username, symbol: pl.symbol };
      });
      writeLeaderboard(nk, logger, state);
      dispatcher.broadcastMessage(1, JSON.stringify({
        board: state.board, currentPlayer: state.currentPlayer,
        winner: state.winner, players: playerList, ready: true,
        timeout: true, timedOutPlayer: forfeiter,
      }));
      return { state: state };
    }
  }

  for (var i = 0; i < messages.length; i++) {
    var msg = messages[i];
    var data = JSON.parse(nk.binaryToString(msg.data));
    var senderKey = getKey(msg.sender);

    // op_code 10 = resync
    if (msg.op_code === 10 || msg.op_code === "10") {
      var playerList2 = Object.values(state.players).map(function(pl) {
        return { username: pl.username, symbol: pl.symbol };
      });
      var elapsed2 = state.ready ? (tick - state.turnStartTick) / state.tickRate : 0;
      var timeLeft2 = state.ready ? Math.max(0, Math.ceil(TURN_TIMEOUT_SECONDS - elapsed2)) : TURN_TIMEOUT_SECONDS;
      dispatcher.broadcastMessage(1, JSON.stringify({
        board: state.board, currentPlayer: state.currentPlayer,
        winner: state.winner, players: playerList2, ready: state.ready,
        timeLeft: timeLeft2,
      }));
      continue;
    }

    // op_code 20 = rematch vote
    if (msg.op_code === 20 || msg.op_code === "20") {
      var voterId = msg.sender.userId || msg.sender.user_id || senderKey;
      state.rematchVotes[voterId] = true;
      var totalVotes = Object.keys(state.rematchVotes).length;
      logger.info("Rematch vote from userId=" + voterId + " totalVotes=" + totalVotes);
      if (totalVotes >= 2) {
        state.board = ["","","","","","","","",""];
        state.currentPlayer = "X";
        state.winner = null;
        state.rematchVotes = {};
        state.turnStartTick = tick;
        var playerList3 = Object.values(state.players).map(function(pl) {
          return { username: pl.username, symbol: pl.symbol };
        });
        dispatcher.broadcastMessage(1, JSON.stringify({
          board: state.board, currentPlayer: state.currentPlayer,
          winner: null, players: playerList3, ready: true, rematch: true,
          timeLeft: TURN_TIMEOUT_SECONDS,
        }));
        logger.info("Rematch started!");
      } else {
        dispatcher.broadcastMessage(4, JSON.stringify({ rematchPending: true }));
        logger.info("Rematch pending, waiting for second vote");
      }
      continue;
    }

    if (!state.ready || state.winner) continue;

    // op_code 1 = move
    var player = state.players[senderKey];
    logger.info("Move from senderKey=" + senderKey + " player=" + JSON.stringify(player) + " currentPlayer=" + state.currentPlayer);
    if (!player || player.symbol !== state.currentPlayer) continue;
    var index = data.index;
    if (index === undefined || index === null || state.board[index] !== "") continue;

    state.board[index] = state.currentPlayer;
    state.winner = checkWinner(state.board);
    if (!state.winner) {
      state.currentPlayer = state.currentPlayer === "X" ? "O" : "X";
      state.turnStartTick = tick; // reset timer on valid move
    }

    if (state.winner) writeLeaderboard(nk, logger, state);

    var playerList4 = Object.values(state.players).map(function(pl) {
      return { username: pl.username, symbol: pl.symbol };
    });
    dispatcher.broadcastMessage(1, JSON.stringify({
      board: state.board, currentPlayer: state.currentPlayer,
      winner: state.winner, players: playerList4, ready: true,
      timeLeft: state.winner ? 0 : TURN_TIMEOUT_SECONDS,
    }));
  }
  return { state: state };
}

function writeLeaderboard(nk, logger, state) {
  if (!state.winner || state.winner === "Draw") return;
  var players = Object.values(state.players);
  for (var j = 0; j < players.length; j++) {
    var pl = players[j];
    var userId = pl.userId;
    if (!userId || userId === "unknown") continue;
    var isWinner = pl.symbol === state.winner;
    try {
      // read current streak from storage
      var streakData = { streak: 0, bestStreak: 0 };
      try {
        var stored = nk.storageRead([{ collection: "streaks", key: "streak", userId: userId }]);
        if (stored && stored.length > 0) streakData = stored[0].value;
      } catch(e) {}

      var newStreak = isWinner ? (streakData.streak > 0 ? streakData.streak + 1 : 1) : 0;
      var newBest = Math.max(streakData.bestStreak || 0, newStreak);

      nk.storageWrite([{
        collection: "streaks", key: "streak", userId: userId,
        value: { streak: newStreak, bestStreak: newBest },
        permissionRead: 2, permissionWrite: 1,
      }]);

      // winner: score+1, loser: subscore+1; metadata carries streak info
      nk.leaderboardRecordWrite("tictactoe_wins", userId, pl.username,
        isWinner ? 1 : 0, isWinner ? 0 : 1,
        { streak: newStreak, bestStreak: newBest }
      );
      logger.info("Leaderboard write: " + pl.username + " winner=" + isWinner + " streak=" + newStreak);
    } catch(e) {
      logger.error("Leaderboard write failed for " + pl.username + ": " + e);
    }
  }
}

function matchTerminate(ctx, logger, nk, dispatcher, tick, state, graceSeconds) {
  return { state: state };
}

function matchSignal(ctx, logger, nk, dispatcher, tick, state) {
  return { state: state };
}

function rpcCreateRoom(ctx, logger, nk, payload) {
  var data = payload ? JSON.parse(payload) : {};
  var gameMode = data.gameMode === "classic" ? "classic" : "timed";
  var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  var code = "";
  for (var i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  var matchId = nk.matchCreate("match_handler", {});
  nk.storageWrite([{
    collection: "rooms", key: code,
    userId: "00000000-0000-0000-0000-000000000000",
    value: { matchId: matchId, gameMode: gameMode },
    permissionRead: 2, permissionWrite: 1,
  }]);
  logger.info("Room created: " + code + " -> " + matchId + " mode=" + gameMode);
  return JSON.stringify({ code: code, matchId: matchId, gameMode: gameMode });
}

function rpcJoinRoom(ctx, logger, nk, payload) {
  var data = JSON.parse(payload);
  var result = nk.storageRead([{
    collection: "rooms", key: data.code,
    userId: "00000000-0000-0000-0000-000000000000",
  }]);
  if (!result || result.length === 0) throw Error("Room not found: " + data.code);
  var roomData = result[0].value;
  logger.info("Room joined: " + data.code + " -> " + roomData.matchId + " mode=" + roomData.gameMode);
  return JSON.stringify({ matchId: roomData.matchId, gameMode: roomData.gameMode || "timed" });
}

function InitModule(ctx, logger, nk, initializer) {
  try { nk.leaderboardCreate("tictactoe_wins", false, "desc", "incr"); logger.info("Leaderboard created"); } catch(e) { logger.info("Leaderboard already exists: " + e); }
  initializer.registerMatch("match_handler", {
    matchInit, matchJoinAttempt, matchJoin, matchLeave,
    matchLoop, matchTerminate, matchSignal,
  });
  initializer.registerRpc("create_room", rpcCreateRoom);
  initializer.registerRpc("join_room", rpcJoinRoom);
  logger.info("match_handler registered");
}
