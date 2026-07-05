/* ============================================================
   TERRY KUANG Xiangqi · rules.js
   Pure move-generation engine.
   No DOM access. Exposes:
     - generateMoves(board, side)         : all legal moves for side
     - generatePieceMoves(board, r, c)    : legal moves for piece at (r,c)
     - isInCheck(board, side)             : is `side`'s king attacked?
     - isLegalMove(board, from, to)       : is move legal (incl. self-check rule)?
     - applyMove(board, from, to)         : returns new board (pure)
     - moveToNotation(board, from, to)    : Chinese notation e.g. '炮二平五'
   Conventions: row 0 = top = BLACK home; row 9 = bottom = RED home.
   ============================================================ */

(function (global) {
  'use strict';

  const ROWS = 10, COLS = 9;
  const RED = 'red', BLACK = 'black';
  // red palace: rows 7-9, cols 3-5
  // black palace: rows 0-2, cols 3-5
  const isInRedPalace   = (r, c) => r >= 7 && r <= 9 && c >= 3 && c <= 5;
  const isInBlackPalace = (r, c) => r >= 0 && r <= 2 && c >= 3 && c <= 5;
  const isInPalace = (r, c, side) => side === RED ? isInRedPalace(r, c) : isInBlackPalace(r, c);
  // has NOT crossed river: red when r >= 5, black when r <= 4
  const isOnOwnHalf = (r, side) => side === RED ? r >= 5 : r <= 4;
  // HAS crossed river: red when r <= 4, black when r >= 5
  const hasCrossedRiver = (r, side) => side === RED ? r <= 4 : r >= 5;

  function onBoard(r, c) { return r >= 0 && r < ROWS && c >= 0 && c < COLS; }
  function sideOf(code) { return code > 0 ? RED : (code < 0 ? BLACK : null); }
  function absCode(code) { return Math.abs(code); }
  function inBounds(r, c) { return onBoard(r, c); }

  // ----- Find king position for a side -----
  function findKing(board, side) {
    const code = side === RED ? 1 : -1;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (board[r][c] === code) return [r, c];
      }
    }
    return null;
  }

  // ----- Pseudo-move generation (no self-check filter) -----
  function rawMoves(board, r, c) {
    const code = board[r][c];
    if (code === 0) return [];
    const side = sideOf(code);
    const type = absCode(code);
    const moves = [];

    const tryAdd = (nr, nc) => {
      if (!inBounds(nr, nc)) return false;
      const t = board[nr][nc];
      if (t === 0) { moves.push([nr, nc]); return true; }
      if (sideOf(t) !== side) { moves.push([nr, nc]); return true; }
      return false; // own piece
    };

    switch (type) {
      case 1: { // KING (帥/將) — one step in palace
        const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
        for (const [dr, dc] of dirs) {
          const nr = r + dr, nc = c + dc;
          if (inBounds(nr, nc) && isInPalace(nr, nc, side) && (board[nr][nc] === 0 || sideOf(board[nr][nc]) !== side)) {
            moves.push([nr, nc]);
          }
        }
        // Flying king (對將) — capture opposing king on same file with no blocker
        const oppCode = side === RED ? -1 : 1;
        for (let dr = side === RED ? -1 : 1; ;) {
          const nr = r + dr;
          if (!inBounds(nr, c)) break;
          if (board[nr][c] === 0) { /* continue */ }
          else if (board[nr][c] === oppCode) { moves.push([nr, c]); break; }
          else break;
          dr += side === RED ? -1 : 1;
          if (Math.abs(dr) > ROWS) break;
        }
        break;
      }
      case 2: { // ADVISOR (仕/士) — diagonal one step in palace
        const dirs = [[-1,-1],[-1,1],[1,-1],[1,1]];
        for (const [dr, dc] of dirs) {
          const nr = r + dr, nc = c + dc;
          if (inBounds(nr, nc) && isInPalace(nr, nc, side) && (board[nr][nc] === 0 || sideOf(board[nr][nc]) !== side)) {
            moves.push([nr, nc]);
          }
        }
        break;
      }
      case 3: { // ELEPHANT (相/象) — 田 (2 diagonal), no cross, no blocked eye
        const dirs = [[-2,-2],[-2,2],[2,-2],[2,2]];
        const eyes = [[-1,-1],[-1,1],[1,-1],[1,1]];
        for (let i = 0; i < 4; i++) {
          const [dr, dc] = dirs[i];
          const [er, ec] = eyes[i];
          const nr = r + dr, nc = c + dc;
          if (!inBounds(nr, nc)) continue;
          if (!isOnOwnHalf(nr, side)) continue; // can't cross river: must stay on own half
          if (board[r + er][c + ec] !== 0) continue; // blocked eye
          if (board[nr][nc] === 0 || sideOf(board[nr][nc]) !== side) moves.push([nr, nc]);
        }
        break;
      }
      case 4: { // CHARIOT (俥/車) — any distance straight
        const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
        for (const [dr, dc] of dirs) {
          let nr = r + dr, nc = c + dc;
          while (inBounds(nr, nc)) {
            const t = board[nr][nc];
            if (t === 0) { moves.push([nr, nc]); }
            else { if (sideOf(t) !== side) moves.push([nr, nc]); break; }
            nr += dr; nc += dc;
          }
        }
        break;
      }
      case 5: { // HORSE (傌/馬) — 日, with leg-block check
        // 8 destinations, each with a corresponding leg square
        const steps = [
          { dr: -2, dc: -1, leg: [-1,  0] },
          { dr: -2, dc:  1, leg: [-1,  0] },
          { dr:  2, dc: -1, leg: [ 1,  0] },
          { dr:  2, dc:  1, leg: [ 1,  0] },
          { dr: -1, dc: -2, leg: [ 0, -1] },
          { dr:  1, dc: -2, leg: [ 0, -1] },
          { dr: -1, dc:  2, leg: [ 0,  1] },
          { dr:  1, dc:  2, leg: [ 0,  1] }
        ];
        for (const s of steps) {
          const nr = r + s.dr, nc = c + s.dc;
          const lr = r + s.leg[0], lc = c + s.leg[1];
          if (!inBounds(nr, nc)) continue;
          if (board[lr][lc] !== 0) continue; // leg blocked
          if (board[nr][nc] === 0 || sideOf(board[nr][nc]) !== side) moves.push([nr, nc]);
        }
        break;
      }
      case 6: { // CANNON (炮/砲) — like chariot but capture needs exactly 1 screen
        const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
        for (const [dr, dc] of dirs) {
          let nr = r + dr, nc = c + dc;
          let screen = 0;
          while (inBounds(nr, nc)) {
            const t = board[nr][nc];
            if (screen === 0) {
              if (t === 0) { moves.push([nr, nc]); }
              else { screen = 1; }
            } else {
              if (t !== 0) {
                if (sideOf(t) !== side) moves.push([nr, nc]);
                break;
              }
            }
            nr += dr; nc += dc;
          }
        }
        break;
      }
      case 7: { // SOLDIER (兵/卒) — forward before river, forward+sideways after
        const forward = side === RED ? -1 : 1;
        const fr = r + forward, fc = c;
        if (inBounds(fr, fc) && (board[fr][fc] === 0 || sideOf(board[fr][fc]) !== side)) moves.push([fr, fc]);
        // Sideways only after crossing river
        const crossed = hasCrossedRiver(r, side);
        if (crossed) {
          for (const dc of [-1, 1]) {
            const sr = r, sc = c + dc;
            if (inBounds(sr, sc) && (board[sr][sc] === 0 || sideOf(board[sr][sc]) !== side)) moves.push([sr, sc]);
          }
        }
        break;
      }
    }
    return moves;
  }

  // ----- Clone board (for move simulation) -----
  function cloneBoard(b) { return b.map(row => row.slice()); }

  // ----- Apply move (returns new board, original unchanged) -----
  function applyMove(board, from, to) {
    const b = cloneBoard(board);
    const [fr, fc] = from, [tr, tc] = to;
    b[tr][tc] = b[fr][fc];
    b[fr][fc] = 0;
    return b;
  }

  // ----- Self-check filter: is `side`'s king in check on this board? -----
  function isInCheck(board, side) {
    const kingPos = findKing(board, side);
    if (!kingPos) return false;
    const [kr, kc] = kingPos;
    const opp = side === RED ? BLACK : RED;
    // Find any opposing piece that attacks (kr, kc)
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (board[r][c] === 0) continue;
        if (sideOf(board[r][c]) !== opp) continue;
        const moves = rawMoves(board, r, c);
        for (const [mr, mc] of moves) {
          if (mr === kr && mc === kc) return true;
        }
      }
    }
    return false;
  }

  // ----- Full legal move set for a piece (with self-check filter) -----
  function generatePieceMoves(board, r, c) {
    const code = board[r][c];
    if (code === 0) return [];
    const side = sideOf(code);
    const raw = rawMoves(board, r, c);
    const legal = [];
    for (const [nr, nc] of raw) {
      const newBoard = applyMove(board, [r, c], [nr, nc]);
      if (!isInCheck(newBoard, side)) legal.push([nr, nc]);
    }
    return legal;
  }

  // ----- All legal moves for a side -----
  function generateMoves(board, side) {
    const all = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (board[r][c] !== 0 && sideOf(board[r][c]) === side) {
          const moves = generatePieceMoves(board, r, c);
          for (const m of moves) all.push({ from: [r, c], to: m });
        }
      }
    }
    return all;
  }

  // ----- Is the move legal (including self-check rule)? -----
  function isLegalMove(board, from, to) {
    const [fr, fc] = from;
    const code = board[fr][fc];
    if (code === 0) return false;
    const side = sideOf(code);
    const legal = generatePieceMoves(board, fr, fc);
    return legal.some(([r, c]) => r === to[0] && c === to[1]);
  }

  // ----- Has the side any legal move? (stalemate = 困斃 = loss in xiangqi) -----
  function hasAnyLegalMove(board, side) {
    return generateMoves(board, side).length > 0;
  }

  // ----- Has the side any legal move? (short-circuit, ~10x faster on cold board) -----
  // Used in the hot path of makeMove — we only need a yes/no, not the full list.
  function hasAnyLegalMoveFast(board, side) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (board[r][c] === 0 || sideOf(board[r][c]) !== side) continue;
        const raw = rawMoves(board, r, c);
        for (const [nr, nc] of raw) {
          const newBoard = applyMove(board, [r, c], [nr, nc]);
          if (!isInCheck(newBoard, side)) return true;
        }
      }
    }
    return false;
  }

  // ----- Notation: convert (from, to) to Chinese notation -----
  // Format: 炮二平五, 馬8進7, 前車進一, 後馬退三
  // Files: red uses 一二三四五六七八九 (col 0→一), black uses 1-9 Arabic (col 8→1, col 0→9)
  function moveToNotation(board, from, to) {
    const code = board[from[0]][from[1]];
    if (code === 0) return '';
    const side = sideOf(code);
    const type = absCode(code);
    const pieceNames = { 1: '將帥', 2: '仕士', 3: '相象', 4: '俥車', 5: '傌馬', 6: '炮砲', 7: '兵卒' };
    // Pick proper char by side
    const pieceName = side === RED
      ? { 1: '帥', 2: '仕', 3: '相', 4: '俥', 5: '傌', 6: '炮', 7: '兵' }[type]
      : { 1: '將', 2: '士', 3: '象', 4: '車', 5: '馬', 6: '砲', 7: '卒' }[type];
    const [fr, fc] = from, [tr, tc] = to;

    // File label: red uses 一-九 (col 0→一), black uses 1-9 (col 0→9, col 8→1)
    let fileLabel;
    if (side === RED) {
      fileLabel = '一二三四五六七八九'[fc];
    } else {
      fileLabel = String(9 - fc);
    }

    // Action: 平 (horizontal) / 進 (advance) / 退 (retreat)
    const dr = tr - fr, dc = tc - fc;
    let action, count;
    if (dc === 0) {
      action = side === RED ? (dr < 0 ? '進' : '退') : (dr > 0 ? '進' : '退');
      count = String(Math.abs(dr));
    } else if (dr === 0) {
      action = '平';
      count = side === RED ? '一二三四五六七八九'[tc] : String(9 - tc);
    } else {
      // Diagonal (advisor/elephant/horse): 用目的地的「進/退」+ 步数或文件
      // For advisor/elephant: 平 can't apply; use 進/退 + count steps
      // For horse: 進/退 + target file
      if (type === 5) { // horse
        action = side === RED ? (dr < 0 ? '進' : '退') : (dr > 0 ? '進' : '退');
        count = side === RED ? '一二三四五六七八九'[tc] : String(9 - tc);
      } else { // advisor / elephant
        action = side === RED ? (dr < 0 ? '進' : '退') : (dr > 0 ? '進' : '退');
        count = String(Math.abs(dr));
      }
    }
    return `${pieceName}${fileLabel}${action}${count}`;
  }

  // ----- Public API -----
  global.XQRules = {
    ROWS, COLS, RED, BLACK,
    sideOf, absCode, onBoard, findKing,
    rawMoves, generatePieceMoves, generateMoves,
    isInCheck, isLegalMove, hasAnyLegalMove, hasAnyLegalMoveFast,
    applyMove, cloneBoard, moveToNotation
  };
})(window);
