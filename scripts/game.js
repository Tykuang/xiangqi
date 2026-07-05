/* ============================================================
   TERRY KUANG Xiangqi · game.js
   Game state machine + history + capture tracking.
   Mediates between board.js (rendering) and rules.js (logic).
   ============================================================ */

(function (global) {
  'use strict';

  const State = {
    board: null,           // 10x9 array
    turn: 'red',           // 'red' | 'black'
    mode: 'pvp',           // 'pvp' | 'pve'
    difficulty: 'advanced', // 'beginner' | 'advanced' | 'professional' | 'expert'
    selected: null,        // [r, c] or null
    legalMoves: [],        // [[r, c], ...]
    history: [],           // [{n, red, black, redFrom, redTo, blackFrom, blackTo, redCap, blackCap}]
    lastMove: null,        // {from, to, side}
    inCheck: null,         // 'red' | 'black' | null
    winner: null,          // 'red' | 'black' | 'draw' | null
    moveCount: 0,          // total plies
    undoStack: []          // snapshots for undo
  };

  function snapshot() {
    return {
      board: State.board.map(r => r.slice()),
      turn: State.turn,
      mode: State.mode,
      difficulty: State.difficulty,
      history: State.history.slice(),
      lastMove: State.lastMove ? { from: State.lastMove.from.slice(), to: State.lastMove.to.slice(), side: State.lastMove.side } : null,
      inCheck: State.inCheck,
      winner: State.winner,
      moveCount: State.moveCount
    };
  }
  function restore(snap) {
    State.board = snap.board;
    State.turn = snap.turn;
    State.mode = snap.mode;
    State.difficulty = snap.difficulty;
    State.history = snap.history;
    State.lastMove = snap.lastMove;
    State.inCheck = snap.inCheck;
    State.winner = snap.winner;
    State.moveCount = snap.moveCount;
  }

  function newGame(mode) {
    State.mode = mode || State.mode;
    XQBoard.init();
    State.board = XQBoard.getBoard();
    State.turn = 'red';
    State.selected = null;
    State.legalMoves = [];
    State.history = [];
    State.lastMove = null;
    State.inCheck = null;
    State.winner = null;
    State.moveCount = 0;
    State.undoStack = [];
    XQBoard.setBoard(State.board);
    XQBoard.setLastMove(null);
    XQBoard.setSelected(null);
    XQBoard.setLegalMoves([]);
    XQBoard.setInCheck(null);
    XQBoard.renderBoard();
    return State;
  }

  function setDifficulty(d) {
    State.difficulty = d || State.difficulty;
  }

  // Try to select a piece. Returns:
  //   'move'    — a move was executed
  //   'select'  — selected a new piece (or switched to another own piece)
  //   'deselect'— cleared current selection
  //   'noop'    — click did not change state (illegal square, own-piece re-click, etc.)
  function select(r, c) {
    if (State.winner) return 'noop';
    const code = State.board[r][c];
    // Click on own piece: select it (or switch selection)
    if (code !== 0 && XQRules.sideOf(code) === State.turn) {
      const sameAsBefore = State.selected && State.selected[0] === r && State.selected[1] === c;
      State.selected = [r, c];
      State.legalMoves = XQRules.generatePieceMoves(State.board, r, c);
      XQBoard.setSelected(State.selected);
      XQBoard.setLegalMoves(State.legalMoves);
      XQBoard.renderPieces();
      return sameAsBefore ? 'noop' : 'select';
    }
    // Click on a legal target square: move
    if (State.selected && State.legalMoves.some(([lr, lc]) => lr === r && lc === c)) {
      return makeMove(State.selected, [r, c]) ? 'move' : 'noop';
    }
    // Click on a non-legal square: deselect
    if (State.selected) {
      State.selected = null;
      State.legalMoves = [];
      XQBoard.setSelected(null);
      XQBoard.setLegalMoves([]);
      XQBoard.renderPieces();
      return 'deselect';
    }
    return 'noop';
  }

  // Execute a move. Returns true if move was made.
  function makeMove(from, to) {
    if (State.winner) return false;
    const code = State.board[from[0]][from[1]];
    if (code === 0) return false;
    if (XQRules.sideOf(code) !== State.turn) return false;
    if (!XQRules.isLegalMove(State.board, from, to)) return false;

    // Save snapshot for undo (max 10)
    if (State.undoStack.length >= 10) State.undoStack.shift();
    State.undoStack.push(snapshot());

    const captured = State.board[to[0]][to[1]];
    const movingSide = XQRules.sideOf(code);
    const notation = XQRules.moveToNotation(State.board, from, to);

    // Apply
    State.board = XQRules.applyMove(State.board, from, to);
    XQBoard.setBoard(State.board);
    State.moveCount++;

    // Switch turn
    State.turn = movingSide === 'red' ? 'black' : 'red';
    State.selected = null;
    State.legalMoves = [];
    XQBoard.setSelected(null);
    XQBoard.setLegalMoves([]);

    // Last move
    State.lastMove = { from, to, side: movingSide };
    XQBoard.setLastMove(State.lastMove);

    // History: append notation (pair red/black per round)
    if (movingSide === 'red') {
      State.history.push({ n: State.history.length + 1, red: notation, black: '', redCap: captured !== 0 ? { code: captured, side: XQRules.sideOf(captured) } : null, redFrom: from, redTo: to });
    } else {
      const last = State.history[State.history.length - 1];
      if (last && last.black === '') { last.black = notation; last.blackCap = captured !== 0 ? { code: captured, side: XQRules.sideOf(captured) } : null; last.blackFrom = from; last.blackTo = to; }
      else { State.history.push({ n: State.history.length + 1, red: '', black: notation, blackCap: captured !== 0 ? { code: captured, side: XQRules.sideOf(captured) } : null, blackFrom: from, blackTo: to }); }
    }

    // Check / game over
    const oppInCheck = XQRules.isInCheck(State.board, State.turn);
    State.inCheck = oppInCheck ? State.turn : null;
    XQBoard.setInCheck(State.inCheck);
    if (oppInCheck) {
      // Checkmate: opponent has no legal response
      if (!XQRules.hasAnyLegalMoveFast(State.board, State.turn)) {
        State.winner = movingSide;
      }
    } else if (!XQRules.hasAnyLegalMoveFast(State.board, State.turn)) {
      // Stalemate = 困斃 (no legal moves, not in check) = loss for side to move
      State.winner = movingSide;
    }

    XQBoard.renderPieces({ from, to });
    return true;
  }

  function undo() {
    if (State.undoStack.length === 0) return false;
    const snap = State.undoStack.pop();
    restore(snap);
    XQBoard.setBoard(State.board);
    XQBoard.setLastMove(State.lastMove);
    XQBoard.setInCheck(State.inCheck);
    State.selected = null;
    State.legalMoves = [];
    XQBoard.setSelected(null);
    XQBoard.setLegalMoves([]);
    XQBoard.renderBoard();
    return true;
  }

  function setMode(mode) {
    State.mode = mode;
  }

  // Restore a previously serialized state (used for cross-device sync).
  function restoreState(saved) {
    if (!saved || !saved.board) return false;
    State.board = saved.board.map(r => r.slice());
    State.turn = saved.turn || 'red';
    State.history = (saved.history || []).slice();
    State.lastMove = saved.lastMove ? { from: saved.lastMove.from.slice(), to: saved.lastMove.to.slice(), side: saved.lastMove.side } : null;
    State.inCheck = saved.inCheck || null;
    State.winner = saved.winner || null;
    State.moveCount = saved.moveCount || 0;
    State.undoStack = []; // can't restore undo across sessions
    State.mode = saved.mode || State.mode;
    State.selected = null;
    State.legalMoves = [];
    XQBoard.setBoard(State.board);
    XQBoard.setLastMove(State.lastMove);
    XQBoard.setSelected(null);
    XQBoard.setLegalMoves([]);
    XQBoard.setInCheck(State.inCheck);
    XQBoard.renderBoard();
    XQBoard.renderPieces();
    return true;
  }

  function resign() {
    if (State.winner) return null;
    State.winner = State.turn === 'red' ? 'black' : 'red';
    return State.winner;
  }

  // Public API
  global.XQGame = {
    State,
    newGame,
    select,
    makeMove,
    undo,
    setMode,
    setDifficulty,
    resign,
    restoreState,
    snapshot
  };
})(window);
