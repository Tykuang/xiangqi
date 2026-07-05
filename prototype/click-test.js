// Simulate real user clicking on the board
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

// Page that auto-clicks via JS at load
const testHtml = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>user click test</title>
<link rel="stylesheet" href="styles/main.css"></head>
<body>
<header class="topbar"><div class="topbar-inner">
  <div class="logo"><span class="logo-mark">DSV</span><span class="logo-payoff">GLOBAL TRANSPORT AND LOGISTICS</span></div>
  <div class="turn-pill" id="turnPill"><span class="turn-dot" id="turnDot"></span><span class="turn-text" id="turnText"></span></div>
  <div class="btn-group"><button class="btn primary" id="modePVP">PVP</button><button class="btn" id="modePVE">PVE</button><button class="btn" id="undoBtn">U</button><button class="btn" id="newBtn">N</button></div>
</div></header>
<div class="status-strip" id="statusStrip"><span class="status-text" id="statusText"></span></div>
<div class="ai-banner" id="aiBanner" hidden></div>
<main class="main">
  <section class="board-area">
    <svg class="board-svg" id="boardSvg" viewBox="0 0 600 660" tabindex="0"></svg>
  </section>
  <aside class="sidebar">
    <div class="panel"><h2 class="panel-title">歷史 <span class="badge" id="historyBadge">0</span></h2><div class="history-list" id="historyList"></div></div>
  </aside>
</main>
<div id="ariaLive" class="sr-only"></div>
<div id="moveCounter"></div>
<div id="redCaptures"></div><div id="blackCaptures"></div>
<div id="modal" hidden></div>
<h1 id="modalTitle"></h1><div id="modalSubtitle"></div>
<div id="statRounds"></div><div id="statSteps"></div><div id="statCaptures"></div>
<div id="finalMove"></div>
<button id="ctrlUndo">U</button><button id="ctrlSwap">S</button><button id="ctrlResign">R</button>
<button id="modalNew">N</button><button id="modalClose">C</button>
<script src="scripts/board.js"></script><script src="scripts/rules.js"></script><script src="scripts/game.js"></script><script src="scripts/ai.js"></script><script src="scripts/ui.js"></script>
<script>
window.addEventListener('load', () => {
  XQGame.newGame('pvp');
  XQUI.attach();
  // Wait 1s then dispatch a real click event on the SVG at red 炮 position (7,1)
  // SVG viewBox is 0 0 600 660; cell = 60; pad = 30. (7,1) → x=90, y=450
  setTimeout(() => {
    const svg = document.getElementById('boardSvg');
    const rect = svg.getBoundingClientRect();
    // Pixel in viewBox: (90, 450). Scale to actual client coords.
    const vbW = 600, vbH = 660;
    const clientX = rect.left + (90 / vbW) * rect.width;
    const clientY = rect.top  + (450 / vbH) * rect.height;
    console.log('Click target client:', clientX, clientY);
    // Dispatch pointerdown
    const pdown = new PointerEvent('pointerdown', { clientX, clientY, pointerId: 1, bubbles: true, cancelable: true });
    svg.dispatchEvent(pdown);
    // Then pointerup at the target square (7,4) → x=270, y=450
    const clientX2 = rect.left + (270 / vbW) * rect.width;
    const clientY2 = rect.top  + (450 / vbH) * rect.height;
    const pup = new PointerEvent('pointerup', { clientX: clientX2, clientY: clientY2, pointerId: 1, bubbles: true, cancelable: true });
    svg.dispatchEvent(pup);
    // Wait 500ms, dump result
    setTimeout(() => {
      const result = {
        moveCount: XQGame.State.moveCount,
        history: XQGame.State.history,
        selected: XQGame.State.selected,
        legalMoves: XQGame.State.legalMoves,
        boardAt71: XQGame.State.board[7][1],
        boardAt74: XQGame.State.board[7][4]
      };
      document.body.insertAdjacentHTML('beforeend', '<pre id="r" style="background:#fff;padding:12px;font-size:11px;">' + JSON.stringify(result, null, 2) + '</pre>');
    }, 500);
  }, 1000);
});
</script>
</body></html>`;

fs.writeFileSync('D:/AI WORKSPACE/XiangQi/test-real-click.html', testHtml, 'utf-8');
const url = `file:///D:/AI%20WORKSPACE/XiangQi/test-real-click.html`;
const cmd = `"${CHROME}" --headless --disable-gpu --no-sandbox --hide-scrollbars --window-size=1440x900 --screenshot="D:\\AI WORKSPACE\\XiangQi\\prototype\\screenshots\\user-click-test.png" --virtual-time-budget=8000 "${url}"`;
execSync(cmd, { stdio: 'inherit', timeout: 30000 });
console.log('done');
