var WINNING_LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

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

function matchInit(ctx, logger, nk, params) {
  logger.info("Match Initialized");
  return {
    state: { board: ["","","","","","","","",""], currentPlayer: "X", winner: null, players: {}, ready: false, rematchVotes: {} },
    tickRate: 10,
  };
}

function matchJoinAttempt(ctx, logger, nk, dispatcher, tick, state, presence, metadata) {
  var playerCount = Object.keys(state.players).length;
  if (playerCount >= 2) return { state: state, accept: false };
  return { state: state, accept: true };
}

function matchJoin(ctx, logger, nk, dispatcher, tick, state, presences) {
  logger.info("matchJoin called, presences=" + presences.length + " existing players=" + JSON.stringify(Object.keys(state.players)));
  var playerCount = Object.keys(state.players).length;
  for (var i = 0; i < presences.length; i++) {
    var p = presences[i];
    logger.info("Presence keys: " + JSON.stringify(Object.keys(p)) + " values: userId=" + p.userId + " user_id=" + p.user_id + " sessionId=" + p.sessionId + " session_id=" + p.session_id + " username=" + p.username);
    var symbol = playerCount === 0 ? "X" : "O";
    var key = p.userId || p.user_id || p.sessionId || p.session_id || p.username;
    state.players[key] = { symbol: symbol, userId: p.userId || p.user_id, username: p.username };
    logger.info("Player joined: " + p.username + " as " + symbol + " key=" + key + " total=" + Object.keys(state.players).length);
    playerCount++;
  }

  var totalPlayers = Object.keys(state.players).length;
  logger.info("matchJoin done, totalPlayers=" + totalPlayers + " ready=" + state.ready);

  if (totalPlayers >= 2 && !state.ready) {
    state.ready = true;
    logger.info("Both players joined, broadcasting ready");
    var playerList = Object.values(state.players).map(function(p) {
      return { username: p.username, symbol: p.symbol };
    });
    dispatcher.broadcastMessage(1, JSON.stringify({
      board: state.board, currentPlayer: state.currentPlayer,
      winner: null, players: playerList, ready: true,
    }));
  }
  return { state: state };
}

function matchLeave(ctx, logger, nk, dispatcher, tick, state, presences) {
  for (var i = 0; i < presences.length; i++) {
    var p = presences[i];
    var key = p.userId || p.user_id || p.sessionId || p.session_id || p.username;
    delete state.players[key];
  }
  if (state.ready) {
    state.ready = false;
    dispatcher.broadcastMessage(3, JSON.stringify({ opponentLeft: true }));
  }
  return { state: state };
}

function matchLoop(ctx, logger, nk, dispatcher, tick, state, messages) {
  for (var i = 0; i < messages.length; i++) {
    var msg = messages[i];
    var data = JSON.parse(nk.binaryToString(msg.data));

    // op_code 10 = resync request — always respond with current state
    if (msg.op_code === 10 || msg.op_code === "10") {
      logger.info("Resync requested, ready=" + state.ready + " players=" + Object.keys(state.players).length);
      var playerList = Object.values(state.players).map(function(p) {
        return { username: p.username, symbol: p.symbol };
      });
      dispatcher.broadcastMessage(1, JSON.stringify({
        board: state.board,
        currentPlayer: state.currentPlayer,
        winner: state.winner,
        players: playerList,
        ready: state.ready,
      }));
      continue;
    }

    // op_code 20 = rematch vote
    if (msg.op_code === 20 || msg.op_code === "20") {
      var voterKey = msg.sender.userId || msg.sender.user_id || msg.sender.sessionId || msg.sender.session_id || msg.sender.username;
      state.rematchVotes[voterKey] = true;
      logger.info("Rematch vote from " + voterKey + " total votes=" + Object.keys(state.rematchVotes).length);
      var totalVotes = Object.keys(state.rematchVotes).length;
      var totalPlayers = Object.keys(state.players).length;
      if (totalVotes >= 2 || (totalPlayers > 0 && totalVotes >= totalPlayers)) {
        // reset game
        state.board = ["","","","","","","","",""];
        state.currentPlayer = "X";
        state.winner = null;
        state.rematchVotes = {};
        var playerList = Object.values(state.players).map(function(pl) {
          return { username: pl.username, symbol: pl.symbol };
        });
        dispatcher.broadcastMessage(1, JSON.stringify({
          board: state.board, currentPlayer: state.currentPlayer,
          winner: null, players: playerList, ready: true, rematch: true,
        }));
      } else {
        // notify both that one player wants rematch
        dispatcher.broadcastMessage(4, JSON.stringify({ rematchPending: true }));
      }
      continue;
    }

    if (!state.ready) continue;

    var index = data.index;
    var senderKey = msg.sender.userId || msg.sender.user_id || msg.sender.sessionId || msg.sender.session_id || msg.sender.username;
    var player = state.players[senderKey];

    if (!player || player.symbol !== state.currentPlayer) continue;
    if (state.board[index] !== "" || state.winner) continue;

    state.board[index] = state.currentPlayer;
    state.winner = checkWinner(state.board);
    if (!state.winner) state.currentPlayer = state.currentPlayer === "X" ? "O" : "X";

    if (state.winner && state.winner !== "Draw") {
      var players = Object.values(state.players);
      for (var j = 0; j < players.length; j++) {
        var score = players[j].symbol === state.winner ? 1 : 0;
        nk.leaderboardRecordWrite("tictactoe_wins", players[j].userId, players[j].username, score, 0);
      }
    }

    dispatcher.broadcastMessage(1, JSON.stringify({
      board: state.board, currentPlayer: state.currentPlayer,
      winner: state.winner, ready: true,
    }));
  }
  return { state: state };
}

function matchTerminate(ctx, logger, nk, dispatcher, tick, state, graceSeconds) {
  return { state: state };
}

function matchSignal(ctx, logger, nk, dispatcher, tick, state) {
  return { state: state };
}

function rpcCreateRoom(ctx, logger, nk, payload) {
  var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  var code = "";
  for (var i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];

  var matchId = nk.matchCreate("match_handler", {});

  nk.storageWrite([{
    collection: "rooms",
    key: code,
    userId: "00000000-0000-0000-0000-000000000000",
    value: { matchId: matchId },
    permissionRead: 2,
    permissionWrite: 1,
  }]);

  logger.info("Room created: " + code + " -> " + matchId);
  return JSON.stringify({ code: code, matchId: matchId });
}

function rpcJoinRoom(ctx, logger, nk, payload) {
  var data = JSON.parse(payload);
  var code = data.code;

  var result = nk.storageRead([{
    collection: "rooms",
    key: code,
    userId: "00000000-0000-0000-0000-000000000000",
  }]);

  if (!result || result.length === 0) {
    throw Error("Room not found: " + code);
  }

  var matchId = result[0].value.matchId;
  logger.info("Room joined: " + code + " -> " + matchId);
  return JSON.stringify({ matchId: matchId });
}

function InitModule(ctx, logger, nk, initializer) {
  try { nk.leaderboardCreate("tictactoe_wins", false, "desc", "incr"); } catch(e) {}

  initializer.registerMatch("match_handler", {
    matchInit: matchInit,
    matchJoinAttempt: matchJoinAttempt,
    matchJoin: matchJoin,
    matchLeave: matchLeave,
    matchLoop: matchLoop,
    matchTerminate: matchTerminate,
    matchSignal: matchSignal,
  });

  initializer.registerRpc("create_room", rpcCreateRoom);
  initializer.registerRpc("join_room", rpcJoinRoom);

  logger.info("match_handler registered");
}
