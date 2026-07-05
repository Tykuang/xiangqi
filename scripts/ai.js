/* ============================================================
   TERRY KUANG Xiangqi · ai.js
   Time-limited AI with optimized evaluation
   ============================================================ */

(function (global) {
  'use strict';

  const VALUE = {
    1: 100000,
    2: 150,
    3: 150,
    4: 900,
    5: 450,
    6: 480,
    7: 100
  };

  const CENTER_COLS = [3, 4, 5];

  function isCenter(r, c) {
    return CENTER_COLS.includes(c) && r >= 3 && r <= 6;
  }

  function getKingPos(board, side) {
    const kingCode = side === 'red' ? 1 : -1;
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r][c] === kingCode) return [r, c];
      }
    }
    return null;
  }

  const OPENING_BOOK = {
    '0,4>2,4': ['8,4>6,4', '7,1>8,3', '7,2>6,2', '7,7>8,5', '7,8>6,8'],
    '0,4>3,4': ['8,4>5,4', '7,1>8,3'],
    '0,6>2,6': ['8,4>6,4', '7,7>8,5'],
    '2,0>3,2': ['8,4>6,4'],
    '2,8>3,6': ['8,4>6,4'],
    '0,2>2,2': ['8,4>6,4'],
    '8,4>6,4': ['0,4>2,4', '0,4>3,4'],
    '7,1>8,3': ['0,4>2,4'],
    '7,2>6,2': ['0,4>2,4'],
    '7,7>8,5': ['0,4>2,4'],
    '8,4>5,4': ['0,4>3,4'],
    '7,0>7,2': ['0,4>2,4'],
    '7,8>7,6': ['0,4>2,4'],
  };

  function getOpeningMove(board, side) {
    const historyKey = [];
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r][c] !== 0) {
          const origR = side === 'red' ? r + 2 : r - 2;
          if (origR >= 0 && origR < 10 && board[origR][c] === 0) {
            historyKey.push(`${origR},${c}>${r},${c}`);
          }
        }
      }
    }
    const key = historyKey.sort().join('|');
    const responses = OPENING_BOOK[key];
    if (responses) {
      const moveStr = responses[Math.floor(Math.random() * responses.length)];
      const [from, to] = moveStr.split('>');
      const [fr, fc] = from.split(',').map(Number);
      const [tr, tc] = to.split(',').map(Number);
      if (board[fr][fc] !== 0 && board[tr][tc] === 0) {
        return { from: [fr, fc], to: [tr, tc] };
      }
    }
    return null;
  }

  function evaluateFast(board, side) {
    let score = 0;
    const mySide = side;
    const oppSide = side === 'red' ? 'black' : 'red';

    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        const code = board[r][c];
        if (code === 0) continue;

        const abs = XQRules.absCode(code);
        const val = VALUE[abs];
        const isMine = XQRules.sideOf(code) === mySide;
        const sideMult = isMine ? 1 : -1;

        score += val * sideMult;

        if (isMine) {
          if (isCenter(r, c)) score += val * 0.1;

          if (abs === 7) {
            if ((mySide === 'red' && r >= 5) || (mySide === 'black' && r <= 4)) {
              score += 40;
              if (r === 4 || r === 5) score += 20;
            }
          }

          const pieceMoves = XQRules.generatePieceMoves(board, r, c);
          score += pieceMoves.length * 2;
        }
      }
    }

    const myKing = getKingPos(board, mySide);
    const oppKing = getKingPos(board, oppSide);
    if (myKing && oppKing) {
      const dist = Math.abs(myKing[0] - oppKing[0]) + Math.abs(myKing[1] - oppKing[1]);
      score -= dist * 10;
    }

    return score;
  }

  function cloneBoard(b) { return b.map(r => r.slice()); }

  function applyMove(board, move) {
    const b = cloneBoard(board);
    b[move.to[0]][move.to[1]] = b[move.from[0]][move.from[1]];
    b[move.from[0]][move.from[1]] = 0;
    return b;
  }

  let searchStartTime = 0;
  let searchTimeout = 0;

  function alphabetaLimited(board, side, depth, alpha, beta, isMax) {
    const now = Date.now();
    if (now - searchStartTime > searchTimeout) {
      return isMax ? alpha : beta;
    }

    if (depth === 0) return evaluateFast(board, side);

    const moves = XQRules.generateMoves(board, side);
    if (moves.length === 0) {
      const kingPos = getKingPos(board, side);
      if (kingPos) {
        const attackerMoves = XQRules.generateMoves(board, side === 'red' ? 'black' : 'red');
        for (const am of attackerMoves) {
          if (am.to[0] === kingPos[0] && am.to[1] === kingPos[1]) {
            return isMax ? -Infinity : Infinity;
          }
        }
      }
      return 0;
    }

    for (const m of moves) {
      const newBoard = applyMove(board, m);
      const oppSide = side === 'red' ? 'black' : 'red';
      const val = alphabetaLimited(newBoard, oppSide, depth - 1, alpha, beta, !isMax);

      if (now - searchStartTime > searchTimeout) {
        return isMax ? alpha : beta;
      }

      if (isMax) {
        if (val > alpha) alpha = val;
        if (alpha >= beta) break;
      } else {
        if (val < beta) beta = val;
        if (beta <= alpha) break;
      }
    }

    return isMax ? alpha : beta;
  }

  function pickBestMoveTimed(board, side, maxDepth, timeLimitMs) {
    const moves = XQRules.generateMoves(board, side);
    if (moves.length === 0) return null;

    searchStartTime = Date.now();
    searchTimeout = timeLimitMs;

    let bestMove = moves[0];
    let bestScore = -Infinity;

    for (const m of moves) {
      if (Date.now() - searchStartTime > searchTimeout) break;

      const newBoard = applyMove(board, m);
      const oppSide = side === 'red' ? 'black' : 'red';
      const score = alphabetaLimited(newBoard, oppSide, maxDepth - 1, -Infinity, Infinity, false);

      if (score > bestScore) {
        bestScore = score;
        bestMove = m;
      }
    }

    return bestMove;
  }

  function pickRandom(board, side) {
    const moves = XQRules.generateMoves(board, side);
    if (moves.length === 0) return null;
    return moves[Math.floor(Math.random() * moves.length)];
  }

  function pickGreedyFast(board, side) {
    const moves = XQRules.generateMoves(board, side);
    if (moves.length === 0) return null;

    let best = moves[0], bestScore = -Infinity;
    for (const m of moves) {
      const newBoard = applyMove(board, m);
      const score = evaluateFast(newBoard, side);
      if (score > bestScore) { bestScore = score; best = m; }
    }
    return best;
  }

  const TIME_LIMITS = {
    beginner: 100,
    advanced: 200,
    professional: 500,
    expert: 1000
  };

  const MAX_DEPTHS = {
    beginner: 1,
    advanced: 1,
    professional: 2,
    expert: 3
  };

  function pickByDifficulty(board, side, difficulty) {
    let emptyCount = 0;
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r][c] === 0) emptyCount++;
      }
    }
    const moveCount = 32 - emptyCount;

    if (moveCount <= 4 && difficulty !== 'beginner') {
      const openingMove = getOpeningMove(board, side);
      if (openingMove) return openingMove;
    }

    const timeLimit = TIME_LIMITS[difficulty] || 200;
    const maxDepth = MAX_DEPTHS[difficulty] || 1;

    switch (difficulty) {
      case 'beginner':
        if (Math.random() < 0.7) return pickRandom(board, side);
        return pickGreedyFast(board, side);

      case 'advanced':
        if (Math.random() < 0.15) return pickRandom(board, side);
        return pickGreedyFast(board, side);

      case 'professional':
        if (Math.random() < 0.05) return pickGreedyFast(board, side);
        return pickBestMoveTimed(board, side, maxDepth, timeLimit);

      case 'expert':
        return pickBestMoveTimed(board, side, maxDepth, timeLimit);

      default:
        return pickGreedyFast(board, side);
    }
  }

  global.XQAI = {
    pickRandom,
    pickGreedyFast,
    pickBestMoveTimed,
    pickByDifficulty,
    VALUE
  };
})(window);