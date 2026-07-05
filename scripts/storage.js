// Local-only game storage. All data is per-user, keyed off the current
// logged-in username from XQAuth. API surface mirrors the previous
// Supabase wrapper so main.js / ui.js don't change.
'use strict';

(function (global) {
  const auth = global.XQAuth;
  const debounceMap = new Map();

  function debounce(key, fn, ms) {
    clearTimeout(debounceMap.get(key));
    debounceMap.set(key, setTimeout(fn, ms));
  }

  // Resolve the current username. Returns null if not signed in.
  function who() { return auth && auth._currentUsername ? auth._currentUsername() : null; }

  // ---- keys ----
  function kCurrent(u)  { return 'xq:user:' + u + ':current_game'; }
  function kHistory(u)  { return 'xq:user:' + u + ':game_history'; }
  function kSettings(u) { return 'xq:user:' + u + ':settings'; }

  // ---- raw get/set helpers ----
  function rawGet(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v == null ? fallback : JSON.parse(v);
    } catch (e) { return fallback; }
  }
  function rawSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); }
    catch (e) { console.warn('[storage] quota?', e); }
  }
  function rawDel(key) {
    try { localStorage.removeItem(key); } catch (e) {}
  }

  // ---- Current game state (cross-device sync replaced with cross-session sync) ----
  function saveCurrentGame(state) {
    const u = who(); if (!u) return;
    debounce('current_game', () => {
      rawSet(kCurrent(u), { state, updated_at: new Date().toISOString() });
    }, 300);
  }
  async function loadCurrentGame() {
    const u = who(); if (!u) return null;
    return rawGet(kCurrent(u), null);
  }
  async function clearCurrentGame() {
    const u = who(); if (!u) return;
    rawDel(kCurrent(u));
  }

  // ---- Game history ----
  function saveGameHistory(record) {
    const u = who(); if (!u) return Promise.resolve();
    return new Promise((resolve) => {
      const list = rawGet(kHistory(u), []);
      const id = (Date.now().toString(36)) + '-' + Math.random().toString(36).slice(2, 7);
      list.unshift({
        id,
        mode: record.mode,
        winner: record.winner,
        result: record.result,
        moves: record.moves || [],
        move_count: record.moveCount || (record.moves || []).length,
        started_at: record.startedAt || new Date().toISOString(),
        ended_at: new Date().toISOString()
      });
      // Keep at most 200 records per user to stay under quota.
      if (list.length > 200) list.length = 200;
      rawSet(kHistory(u), list);
      resolve();
    });
  }
  async function listGameHistory(limit = 30) {
    const u = who(); if (!u) return [];
    const list = rawGet(kHistory(u), []);
    return list.slice(0, limit).map(({ id, mode, winner, result, move_count, started_at, ended_at }) =>
      ({ id, mode, winner, result, move_count, started_at, ended_at }));
  }

  // ---- User settings ----
  async function loadSettings() {
    const u = who(); if (!u) return null;
    return rawGet(kSettings(u), null);
  }
  function saveSettings(settings) {
    const u = who(); if (!u) return;
    debounce('settings', () => {
      rawSet(kSettings(u), {
        mode: settings.mode || 'pvp',
        sound_enabled: settings.soundEnabled !== false,
        show_legal: settings.showLegal !== false,
        updated_at: new Date().toISOString()
      });
    }, 400);
  }

  global.XQStorage = {
    saveCurrentGame, loadCurrentGame, clearCurrentGame,
    saveGameHistory, listGameHistory,
    loadSettings, saveSettings
  };
})(window);
