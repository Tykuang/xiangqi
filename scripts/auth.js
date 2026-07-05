// Local-only auth: username + password backed by localStorage.
// API surface mirrors the previous Supabase wrapper so main.js doesn't change.
// Passwords are hashed with SHA-256 + a per-user random salt via WebCrypto.
'use strict';

(function (global) {
  const USERS_KEY = 'xq:auth:users';      // { [username]: { salt, hash, createdAt } }
  const SESSION_KEY = 'xq:auth:session';  // { username, token, loginAt } or null

  // In-memory event listeners for onAuthStateChange.
  const listeners = new Set();

  function notify(event, session) {
    for (const cb of listeners) {
      try { cb(event, session); } catch (e) { console.error('[auth] listener error', e); }
    }
  }

  // ---- crypto helpers ----
  function randomSalt() {
    const a = new Uint8Array(12);
    crypto.getRandomValues(a);
    return Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
  }
  async function sha256(text) {
    const buf = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  }
  async function hashPassword(password, salt) {
    return sha256(salt + ':' + password);
  }

  // ---- storage helpers ----
  function readUsers() {
    try { return JSON.parse(localStorage.getItem(USERS_KEY) || '{}'); }
    catch (e) { return {}; }
  }
  function writeUsers(obj) {
    localStorage.setItem(USERS_KEY, JSON.stringify(obj));
  }
  function readSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function writeSession(s) {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  }

  function buildUser(username) {
    return {
      id: username,            // mirror Supabase: user.id
      email: username,         // mirror Supabase: user.email (used by main.js display)
      username: username,
      createdAt: readUsers()[username] && readUsers()[username].createdAt
    };
  }
  function buildSession(user) {
    return {
      access_token: user.username + ':' + Date.now(),
      token_type: 'bearer',
      user: user,
      loginAt: new Date().toISOString()
    };
  }

  // ---- public API ----

  // Returns { data: { user, session } | null, error } — shape matches the old Supabase wrapper.
  async function signIn(username, password) {
    const u = (username || '').trim();
    const p = password || '';
    if (!u || !p) return { data: null, error: { message: '请输入用户名和密码' } };
    const users = readUsers();
    const rec = users[u];
    if (!rec) return { data: null, error: { message: '用户名或密码错误' } };
    const hashed = await hashPassword(p, rec.salt);
    if (hashed !== rec.hash) return { data: null, error: { message: '用户名或密码错误' } };

    const user = buildUser(u);
    const session = buildSession(user);
    writeSession({ username: u, token: session.access_token, loginAt: session.loginAt });
    notify('SIGNED_IN', session);
    return { data: { user, session }, error: null };
  }

  async function signUp(username, password) {
    const u = (username || '').trim();
    const p = password || '';
    if (!u || !p) return { data: null, error: { message: '请输入用户名和密码' } };
    const users = readUsers();
    if (users[u]) return { data: null, error: { message: '用户名「' + u + '」已被占用' } };
    const salt = randomSalt();
    const hash = await hashPassword(p, salt);
    users[u] = { salt, hash, createdAt: new Date().toISOString() };
    writeUsers(users);

    // Do NOT auto-sign-in: require the user to log in with the credentials
    // they just created. The login form is the next stop.
    return { data: { user: buildUser(u), session: null }, error: null };
  }

  async function signOut() {
    writeSession(null);
    notify('SIGNED_OUT', null);
    return { error: null };
  }

  function getSession() {
    const s = readSession();
    if (!s) return { data: { session: null } };
    const user = buildUser(s.username);
    return { data: { session: { access_token: s.token, user, loginAt: s.loginAt } } };
  }

  async function getUser() {
    const { data } = getSession();
    return { data: { user: data.session ? data.session.user : null } };
  }

  function onAuthStateChange(cb) {
    listeners.add(cb);
    return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
  }

  // Direct helpers used by storage.js (no auth context needed for raw access).
  function currentUsername() {
    const s = readSession();
    return s ? s.username : null;
  }

  global.XQAuth = {
    signIn, signUp, signOut, getSession, getUser, onAuthStateChange,
    _currentUsername: currentUsername
  };
})(window);
