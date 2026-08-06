// =============================================================
// FAST7 Commercial — DB access layer for the Super-admin panel
// Talks to the MASTER Supabase project only.
// =============================================================

(function (global) {
  'use strict';

  const CFG = global.SUPERADMIN_CONFIG || {};
  const BASE = CFG.SUPABASE_URL ? CFG.SUPABASE_URL.replace(/\/$/, '') : '';
  const KEY = CFG.SUPABASE_ANON_KEY || '';
  const TOKEN_STORE = 'superadmin_token';
  let accessToken = (function () { try { return localStorage.getItem(TOKEN_STORE); } catch (e) { return null; } })();

  function setToken(t) {
    accessToken = t;
    try { t ? localStorage.setItem(TOKEN_STORE, t) : localStorage.removeItem(TOKEN_STORE); } catch (e) { /* ignore */ }
  }
  function hasToken() { return !!accessToken; }

  function headers(json) {
    const h = {
      'apikey': KEY,
      'Authorization': 'Bearer ' + (accessToken || KEY),
      'Content-Type': 'application/json'
    };
    if (json !== undefined) h['Content-Type'] = 'application/json';
    return h;
  }

  // Sign in via Supabase Auth (email + password). Returns the user.
  async function signIn(email, password) {
    const res = await fetch(BASE + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: headers(true),
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) {
      let msg = 'بيانات الدخول غير صحيحة (' + res.status + ')';
      try {
        const j = await res.json();
        if (j.error_description) msg = j.error_description;
        else if (j.msg) msg = j.msg;
      } catch (e) { /* ignore */ }
      throw new Error(msg);
    }
    const j = await res.json();
    if (j.access_token) setToken(j.access_token);
    return j;
  }

  function signOut() { setToken(null); }

  async function req(method, path, body) {
    if (!BASE || !KEY || KEY.indexOf('your-') === 0) {
      throw new Error('لم يتم إعداد Supabase بعد. راجع js/config.js');
    }
    if (!accessToken) {
      throw new Error('يجب تسجيل الدخول أولاً');
    }
    const res = await fetch(BASE + path, {
      method,
      headers: headers(body !== undefined),
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    if (!res.ok) {
      let msg = 'HTTP ' + res.status;
      try {
        const j = await res.json();
        msg = (j.message) || (j.error) || msg;
      } catch (e) { /* ignore */ }
      throw new Error(msg);
    }
    if (res.status === 204) return null;
    const ct = res.headers.get('content-type') || '';
    if (ct.indexOf('json') === -1) return res.text();
    return res.json();
  }

  function qs(obj) {
    const parts = [];
    Object.keys(obj || {}).forEach(k => {
      const v = obj[k];
      if (v === undefined || v === null || v === '') return;
      parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
    });
    return parts.length ? '?' + parts.join('&') : '';
  }

  const db = {
    // ---------------- STORES ----------------
    async listStores() {
      return req('GET', '/rest/v1/stores?select=*&order=created_at.desc');
    },
    async getStore(id) {
      const r = await req('GET', '/rest/v1/stores?select=*&store_id=eq.' + encodeURIComponent(id));
      return (r && r[0]) || null;
    },
    async createStore(store) {
      return req('POST', '/rest/v1/stores', store);
    },
    async updateStore(id, patch) {
      return req('PATCH', '/rest/v1/stores?store_id=eq.' + encodeURIComponent(id), patch);
    },
    async deleteStore(id) {
      return req('DELETE', '/rest/v1/stores?store_id=eq.' + encodeURIComponent(id));
    },

    // ---------------- SUBSCRIPTIONS ----------------
    async listSubscriptions(storeId) {
      const filter = storeId ? '&store_id=eq.' + encodeURIComponent(storeId) : '';
      return req('GET', '/rest/v1/subscriptions?select=*&order=created_at.desc' + filter);
    },
    async addSubscription(sub) {
      return req('POST', '/rest/v1/subscriptions', sub);
    },
    async updateSubscription(id, patch) {
      return req('PATCH', '/rest/v1/subscriptions?id=eq.' + encodeURIComponent(id), patch);
    },
    async deleteSubscription(id) {
      return req('DELETE', '/rest/v1/subscriptions?id=eq.' + encodeURIComponent(id));
    },

    // ---------------- PAYMENT / ACTIVATION CODES ----------------
    async listCodes(storeId) {
      const filter = storeId ? '&store_id=eq.' + encodeURIComponent(storeId) : '';
      return req('GET', '/rest/v1/subscription_codes?select=*&order=created_at.desc' + filter);
    },
    async createCode(code) {
      return req('POST', '/rest/v1/subscription_codes', code);
    },
    async updateCode(codeId, patch) {
      return req('PATCH', '/rest/v1/subscription_codes?code=eq.' + encodeURIComponent(codeId), patch);
    },
    async deleteCode(codeId) {
      return req('DELETE', '/rest/v1/subscription_codes?code=eq.' + encodeURIComponent(codeId));
    }
  };

  global.SuperAdminDB = db;
  global.SuperAdminAuth = { signIn, signOut, setToken, hasToken };
})(window);
