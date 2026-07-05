/* ============================================================
   TERRY KUANG Xiangqi · ui.js  v2
   Full M3-M5: drag/drop, animation, AI scheduling, modal,
   mobile layout, accessibility (keyboard, aria-live)
   ============================================================ */

(function (global) {
  'use strict';

  // ----- Element refs -----
  const $ = (id) => document.getElementById(id);
  const elTurnPill = () => $('turnPill');
  const elTurnDot  = () => $('turnDot');
  const elTurnText = () => $('turnText');
  const elStatus   = () => $('statusStrip');
  const elStatusTx = () => $('statusText');
  const elMoveCtr  = () => $('moveCounter');
  const elHistList = () => $('historyList');
  const elHistBadge= () => $('historyBadge');
  const elRedCap   = () => $('redCaptures');
  const elBlackCap = () => $('blackCaptures');
  const elModal    = () => $('modal');
  const elModalT   = () => $('modalTitle');
  const elModalS   = () => $('modalSubtitle');
  const elStatR    = () => $('statRounds');
  const elStatSt   = () => $('statSteps');
  const elStatCa   = () => $('statCaptures');
  const elFinalMv  = () => $('finalMove');
  const elAiBanner = () => $('aiBanner');
  const elAriaLive = () => $('ariaLive');

  // ----- Topbar / status sync -----
  function syncTopbar() {
    const s = XQGame.State;
    const pill = elTurnPill();
    pill.classList.remove('black', 'check');
    if (s.winner) {
      elTurnDot().style.background = s.winner === 'red' ? 'var(--dsv-red)' : 'var(--dsv-black)';
      elTurnDot().style.boxShadow  = 'none';
      elTurnText().textContent = s.winner === 'red' ? 'RED WINS · 紅勝' : 'BLACK WINS · 黑勝';
    } else if (s.inCheck) {
      pill.classList.add('check');
      elTurnText().textContent = s.turn === 'red' ? 'BLACK CHECK · 黑將軍' : 'RED CHECK · 紅將軍';
    } else {
      if (s.turn === 'black') pill.classList.add('black');
      elTurnText().textContent = s.turn === 'red' ? 'RED TO MOVE · 紅方' : 'BLACK TO MOVE · 黑方';
    }
    const strip = elStatus();
    strip.classList.remove('check', 'win');
    if (s.winner) {
      strip.classList.add('win');
      elStatusTx().innerHTML = `<span class="badge">GAME OVER · 終局</span> ${s.winner === 'red' ? '紅方' : '黑方'} 獲勝`;
    } else if (s.inCheck) {
      strip.classList.add('check');
      elStatusTx().innerHTML = `<span class="badge">將軍 CHECK</span> ${s.turn === 'red' ? '黑方' : '紅方'} 正在將軍`;
    } else {
      elStatusTx().innerHTML = `棋局進行中 · 輪到 ${s.turn === 'red' ? '紅方' : '黑方'} 走子`;
    }
    elMoveCtr().textContent = `MOVE ${s.moveCount} · ROUND ${Math.ceil(s.moveCount / 2)}`;
    $('modePVP').classList.toggle('primary', s.mode === 'pvp');
    $('modePVE').classList.toggle('primary', s.mode === 'pve');
    $('modePVP').setAttribute('aria-pressed', s.mode === 'pvp');
    $('modePVE').setAttribute('aria-pressed', s.mode === 'pve');
    $('difficultyGroup').hidden = s.mode !== 'pve';
    const diff = s.difficulty || 'advanced';
    $('diffBeginner').setAttribute('aria-pressed', diff === 'beginner');
    $('diffAdvanced').setAttribute('aria-pressed', diff === 'advanced');
    $('diffProfessional').setAttribute('aria-pressed', diff === 'professional');
    $('diffExpert').setAttribute('aria-pressed', diff === 'expert');
  }

  // ----- History (latest first) -----
  // The two-pass design lets us cheaply update just the trailing row when the
  // opponent replies within the same round (length doesn't change but content does).
  function syncHistory() {
    const list = elHistList();
    const s = XQGame.State;
    const last = s.history[s.history.length - 1];
    const needFull = list.childElementCount !== Math.max(s.history.length, 1) ||
                     (s.history.length === 0 && list.firstElementChild?.classList?.contains('history-empty') !== true);
    // Cheap path: same number of rows, only the last row's text needs updating
    if (!needFull && last) {
      const rows = list.children;
      const topRow = rows[0]; // newest first
      if (topRow) {
        topRow.classList.add('latest');
        if (rows[1]) rows[1].classList.remove('latest');
        topRow.innerHTML = `<span class="h-num">${last.n}.</span><span class="h-red">${last.red || '—'}</span><span class="h-black">${last.black || '—'}</span>`;
      }
      elHistBadge().textContent = `${s.moveCount} STEPS`;
      return;
    }
    // Full rebuild (length changed)
    list.innerHTML = '';
    if (s.history.length === 0) {
      list.innerHTML = '<div class="history-empty">尚未走子 · no moves yet</div>';
      elHistBadge().textContent = '0 STEPS';
      return;
    }
    const frag = document.createDocumentFragment();
    for (let i = s.history.length - 1; i >= 0; i--) {
      const h = s.history[i];
      const row = document.createElement('div');
      row.className = 'h-row' + (i === s.history.length - 1 ? ' latest' : '');
      row.innerHTML = `<span class="h-num">${h.n}.</span><span class="h-red">${h.red || '—'}</span><span class="h-black">${h.black || '—'}</span>`;
      frag.appendChild(row);
    }
    list.appendChild(frag);
    elHistBadge().textContent = `${s.moveCount} STEPS`;
  }

  // ----- Captured pieces -----
  function syncCaptures() {
    const s = XQGame.State;
    const red = [], black = [];
    for (const h of s.history) {
      if (h.redCap)   red.push(h.redCap);
      if (h.blackCap) black.push(h.blackCap);
    }
    elRedCap().innerHTML   = red.length   ? red.map(renderCap).join('')   : '<span class="capture-empty">—</span>';
    elBlackCap().innerHTML = black.length ? black.map(renderCap).join('') : '<span class="capture-empty">—</span>';
  }
  function renderCap(c) {
    const side = c.side; // captured piece's original side
    const glyph = XQBoard.GLYPH[side][XQRules.absCode(c.code)];
    return `<span class="capture-piece ${side}" title="${glyph}">${glyph}</span>`;
  }

  // ----- Modal -----
  function showModal() {
    const s = XQGame.State;
    if (!s.winner) { elModal().setAttribute('hidden', ''); return; }
    elModal().removeAttribute('hidden');
    elModalT().textContent = s.winner === 'red' ? '紅方勝' : '黑方勝';
    elModalS().textContent = s.winner === 'red' ? 'RED WINS · CHECKMATE' : 'BLACK WINS · CHECKMATE';
    elStatR().textContent  = Math.ceil(s.moveCount / 2);
    elStatSt().textContent = s.moveCount;
    const totalCap = s.history.reduce((n, h) => n + (h.redCap ? 1 : 0) + (h.blackCap ? 1 : 0), 0);
    elStatCa().textContent = totalCap;
    const last = s.history[s.history.length - 1];
    if (last) {
      const winNotation = s.winner === 'red' ? (last.red || '—') : (last.black || '—');
      elFinalMv().innerHTML = `<strong>絕殺 · </strong>${winNotation} 將軍,對方無可移動,${s.winner === 'red' ? '紅方' : '黑方'} <strong>獲勝</strong>`;
    }
    announce(s.winner === 'red' ? '紅方獲勝' : '黑方獲勝');
  }
  function hideModal() { elModal().setAttribute('hidden', ''); }

  // ----- Announce (a11y aria-live) -----
  function announce(msg) {
    if (!elAriaLive()) return;
    elAriaLive().textContent = msg;
  }

  // ----- AI banner -----
  function setAiThinking(thinking) {
    if (!elAiBanner()) return;
    if (thinking) elAiBanner().removeAttribute('hidden');
    else elAiBanner().setAttribute('hidden', '');
  }

  // ----- Coords from event -----
  function findPieceAtEvent(e) {
    const svg = $('boardSvg');
    const rect = svg.getBoundingClientRect();
    const vbW = XQBoard.SVG_W, vbH = XQBoard.SVG_H;
    const px = (e.clientX - rect.left) * (vbW / rect.width);
    const py = (e.clientY - rect.top)  * (vbH / rect.height);
    const c = Math.round((px - XQBoard.PADDING) / XQBoard.CELL);
    const r = Math.round((py - XQBoard.PADDING) / XQBoard.CELL);
    if (r < 0 || r >= XQBoard.ROWS || c < 0 || c >= XQBoard.COLS) return null;
    const cx = XQBoard.PADDING + c * XQBoard.CELL;
    const cy = XQBoard.PADDING + r * XQBoard.CELL;
    const dx = px - cx, dy = py - cy;
    if (dx * dx + dy * dy > (XQBoard.PIECE_R * 1.5) ** 2) return null;
    return [r, c];
  }

  // ----- Drag & Drop (mouse + touch unified via pointer events) -----
  let drag = null;
  function onPointerDown(e) {
    if (XQGame.State.winner) return;
    if (XQGame.State.mode === 'pve' && XQGame.State.turn === 'black') return; // AI's turn
    const pt = findPieceAtEvent(e);
    if (!pt) return;
    // Let XQGame.select handle all click logic uniformly:
    //   - own piece    → select & show legal moves
    //   - legal target → execute the move
    //   - else         → deselect
    // The previous early-return on `code === 0 || sideOf !== turn` blocked
    // the "click a legal target to move" path, leaving pieces unmovable.
    const action = XQGame.select(pt[0], pt[1]);
    // select() already calls XQBoard.renderPieces for the board SVG. Only
    // sync the topbar / history / captures when a move or game-over event
    // actually changed them. Pure piece selection doesn't change those.
    if (action === 'move' || XQGame.State.winner) syncAll();
    if (action === 'move') maybeTriggerAi();
    // Track drag for visual feedback / drag-to-move detection
    drag = { from: pt, startX: e.clientX, startY: e.clientY, moved: false, pointerId: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e) {
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) drag.moved = true;
  }
  function onPointerUp(e) {
    if (!drag) return;
    const from = drag.from;
    const target = findPieceAtEvent(e);
    drag = null;
    if (target && (target[0] !== from[0] || target[1] !== from[1])) {
      // Try to move to drag target
      if (XQGame.State.selected &&
          XQGame.State.legalMoves.some(([r, c]) => r === target[0] && c === target[1])) {
        if (XQGame.makeMove(from, target)) {
          // makeMove already did the SVG render; syncAll refreshes the
          // topbar / history / captures and triggers the persistence save.
          syncAll();
          maybeTriggerAi();
        }
      }
    }
  }

  // ----- Click fallback (some browsers + a11y) -----
  function onBoardClick(e) {
    if (XQGame.State.winner) return;
    if (XQGame.State.mode === 'pve' && XQGame.State.turn === 'black') return;
    // Pointer events already handle this; this is a no-op safety net
  }

  // ----- Keyboard -----
  let kbCursor = null; // [r, c]
  function onKeyDown(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const s = XQGame.State;
    if (e.key === 'Escape') {
      if (!elModal().hasAttribute('hidden')) { hideModal(); return; }
      s.selected = null; s.legalMoves = []; XQBoard.setSelected(null); XQBoard.setLegalMoves([]); XQBoard.renderPieces(); syncAll();
      kbCursor = null; return;
    }
    if (e.key === 'u' || e.key === 'U') { e.preventDefault(); XQGame.undo(); syncAll(); return; }
    if (e.key === 'n' || e.key === 'N') { e.preventDefault(); XQGame.newGame(s.mode); hideModal(); syncAll(); return; }
    if (s.winner) return;

    // Arrow keys move cursor; Enter selects
    if (e.key.startsWith('Arrow')) {
      e.preventDefault();
      if (!kbCursor) {
        // First key: jump to the last-move target or a red piece
        if (s.lastMove) kbCursor = s.lastMove.to.slice();
        else {
          // pick first piece of current side
          for (let r = 0; r < XQBoard.ROWS; r++) {
            for (let c = 0; c < XQBoard.COLS; c++) {
              if (s.board[r][c] !== 0 && XQRules.sideOf(s.board[r][c]) === s.turn) { kbCursor = [r, c]; break; }
            }
            if (kbCursor) break;
          }
        }
      } else {
        let [r, c] = kbCursor;
        if (e.key === 'ArrowUp')    r = Math.max(0, r - 1);
        if (e.key === 'ArrowDown')  r = Math.min(9, r + 1);
        if (e.key === 'ArrowLeft')  c = Math.max(0, c - 1);
        if (e.key === 'ArrowRight') c = Math.min(8, c + 1);
        kbCursor = [r, c];
      }
      // Visualize cursor: select a piece if cursor on own, else try to move selected to cursor
      const code = s.board[kbCursor[0]][kbCursor[1]];
      if (code !== 0 && XQRules.sideOf(code) === s.turn) {
        s.selected = kbCursor.slice();
        s.legalMoves = XQRules.generatePieceMoves(s.board, kbCursor[0], kbCursor[1]);
        XQBoard.setSelected(s.selected);
        XQBoard.setLegalMoves(s.legalMoves);
      } else if (s.selected && s.legalMoves.some(([r, c]) => r === kbCursor[0] && c === kbCursor[1])) {
        XQGame.makeMove(s.selected, kbCursor);
        kbCursor = null;
      } else {
        // Just show cursor (small dot at kbCursor)
        XQBoard.setSelected(s.selected); // keep
        XQBoard.setLegalMoves(s.legalMoves);
      }
      XQBoard.renderPieces();
      drawKbCursor(kbCursor);
      syncAll();
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (kbCursor) {
        const code = s.board[kbCursor[0]][kbCursor[1]];
        if (code !== 0 && XQRules.sideOf(code) === s.turn) {
          s.selected = kbCursor.slice();
          s.legalMoves = XQRules.generatePieceMoves(s.board, kbCursor[0], kbCursor[1]);
          XQBoard.setSelected(s.selected);
          XQBoard.setLegalMoves(s.legalMoves);
          XQBoard.renderPieces();
          drawKbCursor(kbCursor);
          syncAll();
        } else if (s.selected && s.legalMoves.some(([r, c]) => r === kbCursor[0] && c === kbCursor[1])) {
          XQGame.makeMove(s.selected, kbCursor);
          kbCursor = null;
          XQBoard.renderPieces();
          drawKbCursor(null);
          syncAll();
          maybeTriggerAi();
        }
      }
    }
  }
  function drawKbCursor(pt) {
    const svg = $('boardSvg');
    if (!svg) return;
    const old = svg.querySelector('[data-kb-cursor]');
    if (old) old.remove();
    if (!pt) return;
    const { x, y } = XQBoard.rc2xy(pt[0], pt[1]);
    const NS = 'http://www.w3.org/2000/svg';
    const ring = document.createElementNS(NS, 'rect');
    ring.setAttribute('x', x - XQBoard.PIECE_R - 4);
    ring.setAttribute('y', y - XQBoard.PIECE_R - 4);
    ring.setAttribute('width',  (XQBoard.PIECE_R + 4) * 2);
    ring.setAttribute('height', (XQBoard.PIECE_R + 4) * 2);
    ring.setAttribute('rx', 4);
    ring.setAttribute('fill', 'none');
    ring.setAttribute('stroke', 'var(--dsv-yellow)');
    ring.setAttribute('stroke-width', 3);
    ring.setAttribute('stroke-dasharray', '4 2');
    ring.setAttribute('data-kb-cursor', '1');
    ring.setAttribute('pointer-events', 'none');
    svg.appendChild(ring);
  }

  // ----- AI scheduling -----
  function maybeTriggerAi() {
    const s = XQGame.State;
    if (s.winner) return;
    if (s.mode !== 'pve') return;
    if (s.turn !== 'black') return;
    setAiThinking(true);
    const diff = s.difficulty || 'advanced';
    const delayMap = { beginner: 20, advanced: 30, professional: 50, expert: 100 };
    const delay = delayMap[diff] + Math.random() * 50;
    setTimeout(() => {
      if (XQGame.State.winner || XQGame.State.turn !== 'black' || XQGame.State.mode !== 'pve') {
        setAiThinking(false); return;
      }
      const move = XQAI.pickByDifficulty(XQGame.State.board, 'black', diff);
      if (move) {
        XQGame.makeMove(move.from, move.to);
        announce(`AI 黑方走 ${XQRules.moveToNotation(XQGame.State.board, move.from, move.to)}`);
      }
      setAiThinking(false);
      syncAll();
    }, delay);
  }

  // ----- Wire all events -----
  function attach() {
    const svg = $('boardSvg');
    svg.addEventListener('click', onBoardClick);
    svg.addEventListener('pointerdown', onPointerDown);
    svg.addEventListener('pointermove', onPointerMove);
    svg.addEventListener('pointerup', onPointerUp);
    svg.addEventListener('pointercancel', () => { drag = null; });
    document.addEventListener('keydown', onKeyDown);
    $('modePVP').addEventListener('click', () => { XQGame.setMode('pvp'); syncAll(); });
    $('modePVE').addEventListener('click', () => { XQGame.setMode('pve'); syncAll(); });
    $('diffBeginner').addEventListener('click',     () => { XQGame.setDifficulty('beginner'); syncAll(); });
    $('diffAdvanced').addEventListener('click',     () => { XQGame.setDifficulty('advanced'); syncAll(); });
    $('diffProfessional').addEventListener('click', () => { XQGame.setDifficulty('professional'); syncAll(); });
    $('diffExpert').addEventListener('click',       () => { XQGame.setDifficulty('expert'); syncAll(); });
    $('newBtn').addEventListener('click',   () => { XQGame.newGame(XQGame.State.mode); hideModal(); kbCursor = null; syncAll(); });
    $('undoBtn').addEventListener('click',  () => { XQGame.undo(); syncAll(); });
    $('ctrlUndo').addEventListener('click',    () => { XQGame.undo(); syncAll(); });
    $('ctrlSwap').addEventListener('click',    () => { XQGame.newGame(XQGame.State.mode); kbCursor = null; syncAll(); });
    $('ctrlResign').addEventListener('click',  () => { XQGame.resign(); syncAll(); showModal(); });
    $('modalNew').addEventListener('click',    () => { XQGame.newGame(XQGame.State.mode); hideModal(); kbCursor = null; syncAll(); });
    $('modalClose').addEventListener('click',  hideModal);
    // Click outside modal closes it
    $('modal').addEventListener('click', (e) => { if (e.target === elModal()) hideModal(); });
  }

  // Defer DOM sync to next frame so the click's visual update paints first.
  // Two syncAlls in the same frame are coalesced.
  let _syncPending = false;
  function syncAll() {
    if (_syncPending) return;
    _syncPending = true;
    requestAnimationFrame(() => {
      _syncPending = false;
      syncTopbar();
      syncHistory();
      syncCaptures();
      showModal();
    });
  }

  global.XQUI = { attach, syncAll, showModal, hideModal, announce, maybeTriggerAi };
})(window);
