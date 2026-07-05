/* ============================================================
   DSV Xiangqi · Browser tests for rules engine
   Run by opening tests.html in browser
   ============================================================ */

(function () {
  'use strict';

  const out = [];
  function log(msg) { out.push(msg); console.log(msg); }
  let passed = 0, failed = 0;
  function assert(cond, label) {
    if (cond) { passed++; log(`<span class="pass">✓ ${label}</span>`); }
    else      { failed++; log(`<span class="fail">✗ ${label}</span>`); }
  }
  function assertMovesEqual(actual, expected, label) {
    const a = JSON.stringify(actual.slice().sort());
    const e = JSON.stringify(expected.slice().sort());
    assert(a === e, `${label}  (got ${a}, want ${e})`);
  }

  // Helper: empty board
  function empty() { return Array.from({ length: 10 }, () => Array(9).fill(0)); }
  function set(b, r, c, v) { b[r][c] = v; }

  // ---------- Test 1: Soldier (兵) forward 1 ----------
  log('<h2>1. Soldier / 兵</h2>');
  {
    const b = empty();
    set(b, 6, 4, 7); // red 兵 at row 6, col 4
    const moves = XQRules.generatePieceMoves(b, 6, 4);
    assertMovesEqual(moves, [[5, 4]], '紅方兵未過河,只能前進 1');
  }
  {
    const b = empty();
    set(b, 4, 4, 7); // red 兵 at row 4 (crossed river)
    const moves = XQRules.generatePieceMoves(b, 4, 4);
    assertMovesEqual(moves, [[3, 4], [4, 3], [4, 5]], '紅方兵過河後可前進+左右');
  }
  {
    const b = empty();
    set(b, 3, 4, -7); // black 卒 at (3,4) - NOT crossed (still on own half r<=4)
    const moves = XQRules.generatePieceMoves(b, 3, 4);
    assertMovesEqual(moves, [[4, 4]], '黑卒未過河,只能前進 1');
  }
  {
    const b = empty();
    set(b, 5, 4, -7); // black 卒 at row 5 (CROSSED river)
    const moves = XQRules.generatePieceMoves(b, 5, 4);
    assertMovesEqual(moves, [[6, 4], [5, 3], [5, 5]], '黑卒過河後可前進+左右');
  }
  {
    const b = empty();
    set(b, 4, 0, 7); // red 兵 at left edge, crossed
    const moves = XQRules.generatePieceMoves(b, 4, 0);
    assert(moves.some(m => m[0] === 4 && m[1] === 1), '兵過河後能橫走');
    assert(!moves.some(m => m[1] === -1), '兵在邊界不能橫走出界');
  }

  // ---------- Test 2: Chariot (車) ----------
  log('<h2>2. Chariot / 車</h2>');
  {
    const b = empty();
    set(b, 4, 4, -4); // black 車
    const moves = XQRules.generatePieceMoves(b, 4, 4);
    // Center (4,4): up 4 (to row 0), down 5 (to row 9), left 4, right 4 = 17
    const expectedCount = 4 + 5 + 4 + 4;
    assert(moves.length === expectedCount, `空棋盤上的車可走 ${expectedCount} 格, 實得 ${moves.length}`);
  }
  {
    const b = empty();
    set(b, 4, 4, 4);  // red 俥
    set(b, 4, 7, 7);  // red 兵 blocks at col 7
    set(b, 7, 4, -7); // black 卒 blocks at row 7
    const moves = XQRules.generatePieceMoves(b, 4, 4);
    assert(moves.some(m => m[0] === 4 && m[1] === 6), '車可走到 col 6 (col 7 之前)');
    assert(!moves.some(m => m[0] === 4 && m[1] === 7), '車不能穿過自己人 (col 7)');
    assert(moves.some(m => m[0] === 7 && m[1] === 4), '車可吃 col 4 row 7 的敵方卒');
  }

  // ---------- Test 3: Horse (馬) with leg-block ----------
  log('<h2>3. Horse / 馬 with 蹩馬腿</h2>');
  {
    const b = empty();
    set(b, 4, 4, -5); // black 馬
    const moves = XQRules.generatePieceMoves(b, 4, 4);
    assert(moves.length === 8, '空位馬可走 8 格');
    // Block a leg: piece at (3,4) blocks upward destinations
    set(b, 3, 4, 7); // red 兵 blocks the "up" leg
    const moves2 = XQRules.generatePieceMoves(b, 4, 4);
    assert(!moves2.some(m => m[0] === 2 && m[1] === 3), '上蹩馬腿: 馬不能走 (2,3)');
    assert(!moves2.some(m => m[0] === 2 && m[1] === 5), '上蹩馬腿: 馬不能走 (2,5)');
    assert( moves2.some(m => m[0] === 3 && m[1] === 2), '馬仍可走 (3,2) (沒被蹩)');
  }

  // ---------- Test 4: Cannon (炮) screen ----------
  log('<h2>4. Cannon / 炮 with 翻山</h2>');
  {
    const b = empty();
    set(b, 4, 4, -6); // black 砲
    set(b, 4, 7, 4);  // red 俥 (target)
    const moves = XQRules.generatePieceMoves(b, 4, 4);
    // No screen yet, cannon can't capture directly
    assert(!moves.some(m => m[0] === 4 && m[1] === 7), '炮無炮架不能直接吃');
    assert( moves.some(m => m[0] === 4 && m[1] === 5), '炮無炮架可走 1 格');
    set(b, 4, 6, 7);  // 炮架: red 兵
    const moves2 = XQRules.generatePieceMoves(b, 4, 4);
    assert(moves2.some(m => m[0] === 4 && m[1] === 7), '炮隔一個炮架可吃');
    assert(!moves2.some(m => m[0] === 4 && m[1] === 8), '炮隔一個炮架不能連吃兩個');
  }

  // ---------- Test 5: Elephant (象) ----------
  log('<h2>5. Elephant / 象</h2>');
  {
    const b = empty();
    set(b, 0, 2, -3); // black 象 at (0,2)
    const moves = XQRules.generatePieceMoves(b, 0, 2);
    // Can go to (2,0) and (2,4) — but those cross river for black? black is at row 0, own half = rows 0-4
    assert(moves.some(m => m[0] === 2 && m[1] === 0), '黑象可走 (2,0)');
    assert(moves.some(m => m[0] === 2 && m[1] === 4), '黑象可走 (2,4)');
    // Block the eye at (1,1)
    set(b, 1, 1, 7);
    const moves2 = XQRules.generatePieceMoves(b, 0, 2);
    assert(!moves2.some(m => m[0] === 2 && m[1] === 0), '塞象眼: 黑象不能走 (2,0)');
  }
  {
    const b = empty();
    set(b, 5, 2, 3); // red 相 at (5,2) - on its own side (rows 5-9)
    const moves = XQRules.generatePieceMoves(b, 5, 2);
    assert(moves.some(m => m[0] === 7 && m[1] === 0), '紅相可走 (7,0)');
    assert(!moves.some(m => m[0] === 3 && m[1] === 0), '紅相不能過河到 (3,0)');
  }

  // ---------- Test 6: King + flying king (對將) ----------
  log('<h2>6. King / 將 對將規則</h2>');
  {
    const b = empty();
    set(b, 0, 4, -1); // black 將 at (0,4)
    set(b, 9, 4, 1);  // red 帥 at (9,4)
    // Without blocker, the black king should be able to capture the red king (對將)
    const moves = XQRules.generatePieceMoves(b, 0, 4);
    assert(moves.some(m => m[0] === 9 && m[1] === 4), '黑將無阻隔時可吃紅帥 (對將)');
    // Add blocker at (5,4) — red 兵
    set(b, 5, 4, 7);
    const moves2 = XQRules.generatePieceMoves(b, 0, 4);
    assert(!moves2.some(m => m[0] === 9 && m[1] === 4), '有炮架時黑將不能隔山吃帥');
  }
  {
    const b = empty();
    set(b, 0, 4, -1);
    set(b, 1, 4, 7);
    // 將 at (0,4), can step to (1,4)? But own piece blocks? No — it's red, different side, can capture
    const moves = XQRules.generatePieceMoves(b, 0, 4);
    // Wait, (1,4) is outside palace for black (palace is rows 0-2 cols 3-5, so (1,4) IS in palace)
    assert(moves.some(m => m[0] === 1 && m[1] === 4), '黑將在宮內可走 (1,4) (含吃子)');
  }

  // ---------- Test 7: Self-check filter ----------
  log('<h2>7. 自王規則 — 不能送將</h2>');
  {
    const b = empty();
    set(b, 1, 4, -4); // black 車
    set(b, 2, 4, -2); // black 士
    set(b, 9, 4, 1);  // red 帥
    set(b, 8, 4, 4);  // red 俥 — blocks flying king on col 4
    // Moving 車 from (1,4) to (1,0) is fine — col 4 still has 將,士,帥,俥 — 帥 blocked by 俥 at (8,4)
    // So actually NOT illegal. Pick a different test: move 車 to (0,4)? Can't, own king there.
    // Use a real self-check scenario: 將@(0,4), 車@(1,4), 士@(2,4) all on col 4 (own).
    // Place red 帥@(9,4) and red 車@(8,4) and red 兵@(5,4) — col 4 has 將,士,帥,車,兵.
    // If 車 moves off col 4, col 4 becomes: 將,士,帥,兵. 兵 blocks 對將. So still safe.
    // To test self-check, make red attacker able to reach black king.
    // Simpler: black 將@(0,4), red 俥@(0,0) — 俥 can move to (0,4) to attack.
    // Now if black has 車@(1,4), moving 車 away doesn't help — 俥 attacks on row 0, not col 4.
    // So 車 can move freely. → this test scenario was wrong.
    // New test: confirm 車→(1,0) is LEGAL (not illegal) given current setup.
    const isLegal = XQRules.isLegalMove(b, [1, 4], [1, 0]);
    assert(isLegal, '此局面下黑車移到 (1,0) 是合法的(不會被將軍)');

    // Real self-check test: red 俥@(0,0) aims at black 將@(0,4) along row 0.
    // Black 車@(0,3) is blocking. If black 車 moves away, 將 is attacked.
    const b2 = empty();
    set(b2, 0, 4, -1); // black 將
    set(b2, 0, 3, -4); // black 車 blocking
    set(b2, 0, 0, 4);  // red 俥 aiming
    // Move black 車@(0,3) → (5,3) (somewhere safe, NOT row 0)
    const selfCheck = XQRules.isLegalMove(b2, [0, 3], [5, 3]);
    // After move, red 俥 can move to (0,4) capturing 將 → 將 is in check → move is ILLEGAL
    assert(!selfCheck, '黑車擋在 (0,3) — 移走會讓 將 被紅俥攻擊,應為非法');
  }

  // ---------- Test 8: Initial legal moves count ----------
  log('<h2>8. 初始局面</h2>');
  {
    XQBoard.init();
    const b = XQBoard.getBoard();
    const redMoves  = XQRules.generateMoves(b, 'red');
    const blackMoves = XQRules.generateMoves(b, 'black');
    // In xiangqi, initial position has many legal moves (chariots have long lines, cannons move forward, horses jump, soldiers advance). Just sanity-check it has SOMETHING and is symmetric.
    assert(redMoves.length > 0, `紅方初始有合法著法, 實得 ${redMoves.length}`);
    assert(blackMoves.length > 0, `黑方初始有合法著法, 實得 ${blackMoves.length}`);
    assert(redMoves.length === blackMoves.length, '紅黑初始著法數應對稱');
  }

  // ---------- Test 9: Notation ----------
  log('<h2>9. 中文記譜</h2>');
  {
    const b = empty();
    set(b, 7, 1, 6); // red 炮 at (7,1) — file 二
    const notation = XQRules.moveToNotation(b, [7, 1], [7, 4]);
    assert(notation === '炮二平五', `炮二平五 (got "${notation}")`);
  }
  {
    const b = empty();
    set(b, 9, 1, 5); // red 傌 at (9,1) — file 二
    const notation = XQRules.moveToNotation(b, [9, 1], [7, 2]);
    // 馬二進三: 傌@(9,1) → (7,2), 進 2 rows up, target col 2 = file 三
    assert(notation === '傌二進三', `傌二進三 (got "${notation}")`);
  }
  {
    const b = empty();
    set(b, 0, 7, -5); // black 馬 at (0,7) — file 2 (black uses 1-9, col 0 = 9, col 7 = 2)
    const notation = XQRules.moveToNotation(b, [0, 7], [2, 6]);
    // 馬2進3: col 6 = file 3
    assert(notation === '馬2進3', `馬2進3 (got "${notation}")`);
  }

  // ---------- Test 10: Capture tracking ----------
  log('<h2>10. 吃子追蹤</h2>');
  {
    XQBoard.init();
    let b = XQBoard.getBoard();
    // Set up: red 俥@(9,0), black 卒@(0,0) — clear the path
    b = XQRules.applyMove(b, [9, 0], [0, 0]); // capture
    const cell = b[0][0];
    assert(cell === 4, '紅俥吃黑卒後 (0,0) 應為 4 (紅俥)');
    assert(b[9][0] === 0, '原位置應為空');
  }

  // ---------- Summary ----------
  log('<h2>Summary</h2>');
  log(`<strong style="font-size:18px">${passed} passed, ${failed} failed</strong>`);

  document.getElementById('out').innerHTML = out.join('<br>');
  document.title = `Tests: ${passed}/${passed+failed}`;
})();
