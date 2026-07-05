// Main entry: bootstrap the app, manage auth gate, persist game state.
'use strict';

(async function () {
  // Wait for DOM and local auth module to be ready.
  function ready() {
    return new Promise(resolve => {
      if (document.readyState !== 'loading') resolve();
      else document.addEventListener('DOMContentLoaded', resolve);
    });
  }
  await ready();

  // Defer scripts load AFTER DOMContentLoaded, so window.XQAuth may not
  // exist yet. Wait for everything we depend on.
  async function waitFor(predicate, label, timeoutMs = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try { if (predicate()) return true; } catch (_) {}
      await new Promise(r => setTimeout(r, 30));
    }
    console.error('[main] timeout waiting for', label);
    return false;
  }
  await waitFor(() => window.XQAuth, 'window.XQAuth');
  await waitFor(() => window.XQBoard && window.XQRules, 'window.XQBoard/XQRules');
  await waitFor(() => window.XQGame, 'window.XQGame');
  await waitFor(() => window.XQUI, 'window.XQUI');

  // Helpers — auth UI
  const $ = id => document.getElementById(id);
  const overlay = $('authOverlay');
  const form = $('authForm');
  const username = $('authUsername');
  const password = $('authPassword');
  const passwordConfirm = $('authPasswordConfirm');
  const submit = $('authSubmit');
  const toggle = $('authToggle');
  const errorBox = $('authError');
  const okBox = $('authOk');
  const userChip = $('userChip');
  const userEmailEl = $('userEmail');
  const signoutBtn = $('userSignout');

  let mode = 'signin'; // 'signin' | 'signup'

  function setMode(m) {
    mode = m;
    submit.textContent = m === 'signin' ? '登 錄 · SIGN IN' : '注 冊 · SIGN UP';
    toggle.innerHTML = m === 'signin'
      ? '还没有账号? <strong>注册 · SIGN UP</strong>'
      : '已有账号? <strong>登录 · SIGN IN</strong>';
    overlay.classList.toggle('mode-signup', m === 'signup');
    overlay.classList.toggle('mode-signin', m === 'signin');
    password.setAttribute('autocomplete', m === 'signup' ? 'new-password' : 'current-password');
    // Confirm password only required in signup mode.
    passwordConfirm.required = (m === 'signup');
    if (m === 'signin') passwordConfirm.value = '';
    errorBox.hidden = true; okBox.hidden = true;
  }
  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.hidden = false;
    okBox.hidden = true;
  }
  function showOk(msg) {
    okBox.textContent = msg;
    okBox.hidden = false;
    errorBox.hidden = true;
  }
  function clearMessages() { errorBox.hidden = true; okBox.hidden = true; }

  function showOverlay() { overlay.hidden = false; document.body.classList.add('signed-out'); }
  function hideOverlay() { overlay.hidden = true; document.body.classList.remove('signed-out'); }

  toggle.addEventListener('click', () => setMode(mode === 'signin' ? 'signup' : 'signin'));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearMessages();
    const un = username.value.trim();
    const pw = password.value;
    const pw2 = passwordConfirm.value;

    // Username validation
    if (!un) { showError('请输入用户名'); return; }
    if (!/^[A-Za-z0-9_]{3,20}$/.test(un)) {
      showError('用户名须为 3-20 位字母、数字或下划线');
      return;
    }
    if (!pw || pw.length < 6) { showError('密码至少 6 位'); return; }
    if (mode === 'signup' && pw !== pw2) {
      showError('两次输入的密码不一致');
      return;
    }

    submit.disabled = true;
    submit.textContent = mode === 'signin' ? '登录中…' : '注册中…';
    try {
      const fn = mode === 'signin' ? XQAuth.signIn : XQAuth.signUp;
      const { data, error } = await fn(un, pw);
      if (error) { showError(transError(error.message)); return; }
      // Registration only creates the account; the user must sign in next.
      if (mode === 'signup' && (!data || !data.session)) {
        showOk('注册成功 · 请使用刚设置的用户名与密码登录。');
        setMode('signin');
        // Pre-fill the username so the user only has to type the password.
        username.value = un;
        password.value = '';
        passwordConfirm.value = '';
        password.focus();
        return;
      }
      // success: auth state listener will take over
    } catch (err) {
      showError('网络错误：' + (err.message || err));
    } finally {
      submit.disabled = false;
      submit.textContent = mode === 'signin' ? '登 錄 · SIGN IN' : '注 冊 · SIGN UP';
    }
  });

  function transError(msg) {
    const map = {
      '请输入用户名和密码': '请输入用户名和密码',
      '用户名或密码错误': '用户名或密码错误',
      'Password should be at least 6 characters': '密码至少 6 位'
    };
    return map[msg] || msg;
  }

  if (signoutBtn) {
    signoutBtn.addEventListener('click', async () => {
      await XQAuth.signOut();
      location.reload();
    });
  }

  // Set initial mode (signin) so the overlay class & confirm field are correct.
  setMode('signin');

  // ---- Game persistence hook ----
  // After every move, save the current game to localStorage.
  // game.js exposes XQGame.State and emits nothing, so we hook in via syncAll.
  let lastSyncPayload = null;
  function snapshotState() {
    const s = XQGame && XQGame.State;
    if (!s) return null;
    return {
      board: s.board,
      turn: s.turn,
      moveCount: s.moveCount,
      history: s.history,
      inCheck: s.inCheck,
      winner: s.winner,
      mode: s.mode
    };
  }
  function hookPersistence() {
    // Wrap the existing syncAll so we snapshot after every UI sync.
    const original = XQUI.syncAll;
    XQUI.syncAll = function () {
      original();
      const snap = snapshotState();
      if (!snap) return;
      const k = JSON.stringify({ turn: snap.turn, moveCount: snap.moveCount, winner: snap.winner });
      if (k === lastSyncPayload) return; // skip no-op saves
      lastSyncPayload = k;
      XQStorage.saveCurrentGame(snap);
    };
    // On game over: archive to history
    const _origMakeMove = XQGame.makeMove;
    XQGame.makeMove = function (from, to) {
      const before = snapshotState();
      const moved = _origMakeMove.apply(this, arguments);
      if (moved && XQGame.State.winner) {
        XQStorage.saveGameHistory({
          mode: XQGame.State.mode,
          winner: XQGame.State.winner,
          result: before.winner ? 'resign' : (XQGame.State.winner === (XQGame.State.mode === 'pve' ? 'red' : 'red') ? 'win' : 'loss'),
          moves: (XQGame.State.history || []).map(h => [h.red, h.black]),
          moveCount: XQGame.State.moveCount,
          startedAt: before.startedAt || new Date().toISOString()
        });
        XQStorage.clearCurrentGame();
        lastSyncPayload = null;
      }
      return moved;
    };
  }

  // ---- Boot once auth is resolved ----
  let booted = false;
  async function bootGame() {
    if (booted) return;
    booted = true;
    hideOverlay();
    // Attach UI handlers and render the board
    XQUI.attach();
    // Load settings
    const settings = await XQStorage.loadSettings();
    if (settings) {
      XQGame.setMode(settings.mode || 'pvp');
    }
    // Load current game (cross-device sync)
    const current = await XQStorage.loadCurrentGame();
    if (current && current.state && !current.state.winner) {
      try {
        XQGame.restoreState(current.state);
        XQUI.syncAll();
      } catch (e) { /* fall through to fresh game */ }
    }
    if (!XQGame.State || !XQGame.State.board) {
      XQGame.newGame(settings && settings.mode || 'pvp');
    }
    XQStorage.saveSettings({ mode: XQGame.State.mode, soundEnabled: true, showLegal: true });
    hookPersistence();
    // Mark startedAt for history record
    XQGame.State.startedAt = XQGame.State.startedAt || new Date().toISOString();
    // Show chip — display the username directly.
    const { data: { user } } = await XQAuth.getUser();
    if (user) {
      userEmailEl.textContent = user.username || user.email || '';
      userChip.hidden = false;
    }
  }

  // Auth state listener — central gate
  XQAuth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      await bootGame();
    } else if (event === 'SIGNED_OUT') {
      showOverlay();
      userChip.hidden = true;
    }
  });

  // Initial session check
  try {
    const { data: { session } } = await XQAuth.getSession();
    if (session) await bootGame();
    else showOverlay();
  } catch (e) {
    showOverlay();
  }
})();
