/* ============================================================
   TERRY KUANG Xiangqi · board.js
   Pure rendering layer: SVG board + 32 pieces in initial position
   Exposes:
     - BoardState   : 10x9 array of piece codes (0 = empty)
     - renderBoard(): draw board + pieces to #boardSvg
     - renderPieces(): redraw pieces from current state
     - clearMarks()  : clear all dynamic marks (selection, legal, last, check)
   Piece codes: positive = red, negative = black
     +1 帥 (general)    -1 將
     +2 仕 (advisor)    -2 士
     +3 相 (elephant)   -3 象
     +4 俥 (chariot)    -4 車
     +5 傌 (horse)      -5 馬
     +6 炮 (cannon)     -6 砲
     +7 兵 (soldier)    -7 卒
   ============================================================ */

(function (global) {
  'use strict';

  // ----- Geometry constants -----
  const CELL = 60;          // pixels per cell
  const COLS = 9;
  const ROWS = 10;
  const PADDING = 30;       // outer padding from svg edge to first/last line
  const PIECE_R = 24;       // piece outer circle radius
  const SVG_W = COLS * CELL + PADDING * 2;  // 9*60 + 60 = 600
  const SVG_H = ROWS * CELL + PADDING * 2;  // 10*60 + 60 = 660

  // ----- Board state -----
  // board[row][col]: row 0 = top (black side), row 9 = bottom (red side)
  // col 0 = left (red 一 file), col 8 = right (red 九 file)
  let BoardState = createInitialBoard();
  let LastMove = null;        // {from:[r,c], to:[r,c]}  for yellow underline
  let Selected = null;        // [r, c] or null
  let LegalMoves = [];        // [[r, c], ...] for current selection
  let InCheck = null;         // 'red' | 'black' | null  for yellow pulse on king

  // ----- Pieces cache (key = "r,c") so we can do incremental updates
  // instead of tearing down all 32 piece elements on every move.
  let PiecesByPos = Object.create(null);
  let PiecesLayerEl = null;   // <g data-layer="pieces">
  let MarksLayerEl  = null;   // <g data-layer="marks">

  // ----- Piece glyphs (Chinese characters for traditional names) -----
  const GLYPH = {
    red:   { 1: '帥', 2: '仕', 3: '相', 4: '俥', 5: '傌', 6: '炮', 7: '兵' },
    black: { 1: '將', 2: '士', 3: '象', 4: '車', 5: '馬', 6: '砲', 7: '卒' }
  };

  // ----- Initial board layout -----
  function createInitialBoard() {
    const b = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    // Black side (row 0-3)
    b[0][0] = -4; b[0][1] = -5; b[0][2] = -3; b[0][3] = -2; b[0][4] = -1;
    b[0][5] = -2; b[0][6] = -3; b[0][7] = -5; b[0][8] = -4;
    b[2][1] = -6; b[2][7] = -6;
    b[3][0] = -7; b[3][2] = -7; b[3][4] = -7; b[3][6] = -7; b[3][8] = -7;
    // Red side (row 6-9)
    b[6][0] = 7; b[6][2] = 7; b[6][4] = 7; b[6][6] = 7; b[6][8] = 7;
    b[7][1] = 6; b[7][7] = 6;
    b[9][0] = 4; b[9][1] = 5; b[9][2] = 3; b[9][3] = 2; b[9][4] = 1;
    b[9][5] = 2; b[9][6] = 3; b[9][7] = 5; b[9][8] = 4;
    return b;
  }

  // Convert (row, col) to pixel (x, y) — center of crossing point
  function rc2xy(r, c) {
    return { x: PADDING + c * CELL, y: PADDING + r * CELL };
  }

  // ----- SVG namespace helper -----
  const NS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs = {}, children = []) {
    const node = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    for (const c of children) node.appendChild(c);
    return node;
  }
  function txt(content) {
    return document.createTextNode(content);
  }

  // ----- Build static board (lines, river, palace, coords) -----
  function buildStaticBoard() {
    const g = el('g', { 'data-layer': 'static' });

    // Outer border (rectangle frame) — inline color, not CSS var
    g.appendChild(el('rect', {
      x: PADDING, y: PADDING,
      width: (COLS - 1) * CELL, height: (ROWS - 1) * CELL,
      fill: 'none', stroke: '#002F6C', 'stroke-width': 2
    }));

    // Horizontal lines (10 lines) — inline stroke
    for (let r = 0; r < ROWS; r++) {
      g.appendChild(el('line', {
        x1: PADDING, y1: PADDING + r * CELL,
        x2: PADDING + (COLS - 1) * CELL, y2: PADDING + r * CELL,
        stroke: '#B3B3B3', 'stroke-width': 1
      }));
    }
    // Vertical lines (9 lines, broken at river) — inline stroke
    for (let c = 0; c < COLS; c++) {
      g.appendChild(el('line', {
        x1: PADDING + c * CELL, y1: PADDING,
        x2: PADDING + c * CELL, y2: PADDING + 4 * CELL,
        stroke: '#B3B3B3', 'stroke-width': 1
      }));
      g.appendChild(el('line', {
        x1: PADDING + c * CELL, y1: PADDING + 5 * CELL,
        x2: PADDING + c * CELL, y2: PADDING + 9 * CELL,
        stroke: '#B3B3B3', 'stroke-width': 1
      }));
    }
    // Palace diagonals (top + bottom) — inline stroke
    g.appendChild(el('line', { x1: PADDING + 3 * CELL, y1: PADDING,             x2: PADDING + 5 * CELL, y2: PADDING + 2 * CELL, stroke: '#B3B3B3', 'stroke-width': 1 }));
    g.appendChild(el('line', { x1: PADDING + 5 * CELL, y1: PADDING,             x2: PADDING + 3 * CELL, y2: PADDING + 2 * CELL, stroke: '#B3B3B3', 'stroke-width': 1 }));
    g.appendChild(el('line', { x1: PADDING + 3 * CELL, y1: PADDING + 7 * CELL, x2: PADDING + 5 * CELL, y2: PADDING + 9 * CELL, stroke: '#B3B3B3', 'stroke-width': 1 }));
    g.appendChild(el('line', { x1: PADDING + 5 * CELL, y1: PADDING + 7 * CELL, x2: PADDING + 3 * CELL, y2: PADDING + 9 * CELL, stroke: '#B3B3B3', 'stroke-width': 1 }));

    // River text (transparent rectangle over middle area, then text)
    g.appendChild(el('rect', {
      x: PADDING, y: PADDING + 4 * CELL,
      width: (COLS - 1) * CELL, height: CELL,
      fill: '#FFFFFF'
    }));
    const riverY = PADDING + 4 * CELL + CELL / 2 + 7;
    g.appendChild(el('text', {
      x: PADDING + 1.5 * CELL, y: riverY, fill: '#002F6C',
      'font-family': "'PingFang SC','Microsoft YaHei',serif",
      'font-size': 22, 'font-weight': 600, 'letter-spacing': 18,
      'text-anchor': 'middle'
    }, [txt('楚 河')]));
    g.appendChild(el('text', {
      x: PADDING + 6.5 * CELL, y: riverY, fill: '#002F6C',
      'font-family': "'PingFang SC','Microsoft YaHei',serif",
      'font-size': 22, 'font-weight': 600, 'letter-spacing': 18,
      'text-anchor': 'middle'
    }, [txt('漢 界')]));

    // Coordinate labels (outside board edges)
    for (let c = 0; c < COLS; c++) {
      g.appendChild(el('text', {
        x: PADDING + c * CELL, y: PADDING - 12, class: 'coord-label', 'text-anchor': 'middle'
      }, [txt(String(c + 1))]));
    }
    for (let r = 0; r < ROWS; r++) {
      g.appendChild(el('text', {
        x: PADDING - 14, y: PADDING + r * CELL + 4, class: 'coord-label', 'text-anchor': 'middle'
      }, [txt(String(ROWS - r))]));
    }

    return g;
  }

  // ----- Build a single piece group -----
  function buildPiece(r, c, code) {
    const { x, y } = rc2xy(r, c);
    const side = code > 0 ? 'red' : 'black';
    const glyph = GLYPH[side][Math.abs(code)];
    const strokeColor = side === 'red' ? '#DA291C' : '#1A1A1A';
    const textColor   = side === 'red' ? '#DA291C' : '#1A1A1A';
    const g = el('g', {
      'data-piece': `${r},${c}`,
      'data-r': r,
      'data-c': c,
      'data-code': code,
      'data-side': side,
      class: 'piece',
      tabindex: '0',
      role: 'button',
      'aria-label': `${side === 'red' ? '红' : '黑'}方 ${glyph}`
    });
    g.appendChild(el('circle', {
      cx: x, cy: y, r: PIECE_R,
      fill: '#FFFFFF', stroke: strokeColor, 'stroke-width': 2
    }));
    const text = el('text', {
      x: x, y: y,
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
      'font-family': "'PingFang SC','Microsoft YaHei',serif",
      'font-size': '20',
      'font-weight': '700',
      fill: textColor
    }, [txt(glyph)]);
    g.appendChild(text);
    return g;
  }

  // ----- Build all pieces (32 in initial position) -----
  // The pieces layer is built once and then mutated incrementally.
  function buildAllPieces(animMove) {
    const g = el('g', { 'data-layer': 'pieces' });
    PiecesByPos = Object.create(null);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (BoardState[r][c] !== 0) {
          const piece = buildPiece(r, c, BoardState[r][c]);
          // M3 polish: slide animation when this piece is the moving one
          if (animMove && animMove.to[0] === r && animMove.to[1] === c) {
            const fromXY = rc2xy(animMove.from[0], animMove.from[1]);
            const toXY   = rc2xy(animMove.to[0],   animMove.to[1]);
            const dx = fromXY.x - toXY.x;
            const dy = fromXY.y - toXY.y;
            piece.classList.add('move-anim');
            piece.style.setProperty('--dx', `${dx}px`);
            piece.style.setProperty('--dy', `${dy}px`);
          }
          g.appendChild(piece);
          PiecesByPos[r + ',' + c] = piece;
        }
      }
    }
    return g;
  }

  // ----- Mark layers (selection, legal moves, last move, check) -----
  function buildMarks() {
    const g = el('g', { 'data-layer': 'marks' });
    // Last move: yellow underline segments on from/to columns
    if (LastMove) {
      for (const pt of [LastMove.from, LastMove.to]) {
        const { x, y } = rc2xy(pt[0], pt[1]);
        g.appendChild(el('line', {
          x1: x - 28, y1: y + 28, x2: x + 28, y2: y + 28,
          stroke: '#FFCD00', 'stroke-width': 3
        }));
      }
    }
    // Selection ring
    if (Selected) {
      const { x, y } = rc2xy(Selected[0], Selected[1]);
      g.appendChild(el('circle', {
        cx: x, cy: y, r: PIECE_R + 2,
        fill: 'none', stroke: '#002F6C', 'stroke-width': 2.5
      }));
    }
    // Legal moves
    for (const [r, c] of LegalMoves) {
      const { x, y } = rc2xy(r, c);
      const target = BoardState[r][c];
      if (target === 0) {
        // Empty square: blue dot
        g.appendChild(el('circle', {
          cx: x, cy: y, r: 7,
          fill: '#002F6C', opacity: 0.55
        }));
      } else {
        // Capture: red ring
        g.appendChild(el('circle', {
          cx: x, cy: y, r: PIECE_R + 2,
          fill: 'none', stroke: '#DA291C', 'stroke-width': 2.5
        }));
      }
    }
    // Check pulse on king
    if (InCheck) {
      const kingCode = InCheck === 'red' ? 1 : -1;
      let kingPos = null;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (BoardState[r][c] === kingCode) { kingPos = [r, c]; break; }
        }
        if (kingPos) break;
      }
      if (kingPos) {
        const { x, y } = rc2xy(kingPos[0], kingPos[1]);
        g.appendChild(el('circle', {
          cx: x, cy: y, r: PIECE_R + 4,
          fill: 'none', stroke: '#FFCD00', 'stroke-width': 3, class: 'check-pulse'
        }));
      }
    }
    return g;
  }

  // ----- Public render functions -----
  function renderBoard() {
    const svg = document.getElementById('boardSvg');
    if (!svg) return;
    svg.setAttribute('viewBox', `0 0 ${SVG_W} ${SVG_H}`);
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.appendChild(buildStaticBoard());
    // Use the new render path so PiecesByPos / PiecesLayerEl are populated.
    PiecesLayerEl = null;
    MarksLayerEl = null;
    renderPieces();
  }

  // ----- Render pieces: incremental when animMove is given, full rebuild otherwise.
  // The pieces layer is created once and reused. On a single move we:
  //   1. Remove the captured piece's element (if any)
  //   2. Move the moving piece's element to its new <g> position with a
  //      CSS transform animation back to the new spot
  //   3. Update PiecesByPos
  // The marks layer is always cheap to rebuild.
  function renderPieces(animMove) {
    const svg = document.getElementById('boardSvg');
    if (!svg) return;
    if (animMove && PiecesLayerEl) {
      applyMoveIncremental(animMove);
    } else if (!PiecesLayerEl) {
      // First render: build the pieces layer and cache.
      PiecesLayerEl = buildAllPieces(animMove);
      svg.appendChild(PiecesLayerEl);
    } else {
      // No move animation requested and pieces are already rendered.
      // This path is hit for selection / hover updates that only affect
      // marks, so just refresh marks and leave pieces alone.
    }
    if (MarksLayerEl) { MarksLayerEl.remove(); MarksLayerEl = null; }
    MarksLayerEl = buildMarks();
    svg.appendChild(MarksLayerEl);
  }

  // Move one piece, optionally remove a captured piece, with a slide animation.
  function applyMoveIncremental(animMove) {
    const [fr, fc] = animMove.from;
    const [tr, tc] = animMove.to;
    const fromKey = fr + ',' + fc;
    const toKey   = tr + ',' + tc;
    const movingNode = PiecesByPos[fromKey];

    // 1. Capture: remove the piece that was sitting on `to` (if any).
    //    Important: do this BEFORE moving our piece, because for a
    //    same-cell undo the captured and moving nodes would collide.
    const capturedNode = PiecesByPos[toKey];
    if (capturedNode && capturedNode !== movingNode) {
      capturedNode.remove();
      delete PiecesByPos[toKey];
    }

    // 2. Move the moving node into its new <g> position (cx/cy + text x/y)
    //    and animate from the old position via CSS transform.
    if (movingNode) {
      delete PiecesByPos[fromKey];
      PiecesByPos[toKey] = movingNode;

      const toXY = rc2xy(tr, tc);
      const fromXY = rc2xy(fr, fc);
      const dx = fromXY.x - toXY.x;
      const dy = fromXY.y - toXY.y;

      // Update geometry so when the transform is removed, the piece sits at `to`.
      const circle = movingNode.querySelector('circle');
      const text   = movingNode.querySelector('text');
      if (circle) { circle.setAttribute('cx', toXY.x); circle.setAttribute('cy', toXY.y); }
      if (text)   { text.setAttribute('x', toXY.x);   text.setAttribute('y', toXY.y);   }
      movingNode.setAttribute('data-r', tr);
      movingNode.setAttribute('data-c', tc);
      movingNode.setAttribute('data-piece', tr + ',' + tc);

      // FLIP: place at the visual start (with transform offset) without
      // transition, then on next frame drop the transform so it animates
      // back to (0,0) — the new (to) position.
      movingNode.style.transition = 'none';
      movingNode.style.transform = `translate(${dx}px, ${dy}px)`;
      // Force a reflow so the browser registers the start state.
      // eslint-disable-next-line no-unused-expressions
      movingNode.getBoundingClientRect();
      movingNode.style.transition = '';
      movingNode.style.transform = '';
    }
  }

  function clearMarks() {
    Selected = null;
    LegalMoves = [];
    InCheck = null;
    renderPieces();
  }

  // ----- Public API -----
  global.XQBoard = {
    // state
    getBoard: () => BoardState,
    setBoard: (b) => { BoardState = b; },
    getLastMove: () => LastMove,
    setLastMove: (m) => { LastMove = m; },
    getSelected: () => Selected,
    setSelected: (s) => { Selected = s; },
    getLegalMoves: () => LegalMoves,
    setLegalMoves: (m) => { LegalMoves = m; },
    getInCheck: () => InCheck,
    setInCheck: (c) => { InCheck = c; },
    // geometry
    rc2xy,
    CELL, COLS, ROWS, PADDING, PIECE_R, SVG_W, SVG_H,
    // rendering
    renderBoard,
    renderPieces,
    clearMarks,
    // init
    init: () => {
      BoardState = createInitialBoard();
      LastMove = null;
      Selected = null;
      LegalMoves = [];
      InCheck = null;
      renderBoard();
    },
    // glyphs (for history notation)
    GLYPH
  };
})(window);
