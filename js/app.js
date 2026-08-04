// =============================================================
// FAST7 Commercial — Super-admin panel logic
// =============================================================

(function (global) {
  'use strict';

  const CFG = global.SUPERADMIN_CONFIG || {};
  const db = global.SuperAdminDB;
  const auth = global.SuperAdminAuth;
  const LOGIN_KEY = 'superadmin_logged';

  let stores = [];
  let subscriptions = [];
  let codes = [];

  // ---------- helpers ----------
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  let toastTimer;
  function toast(msg, isErr) {
    const t = $('toast');
    t.textContent = msg;
    t.className = 'toast show' + (isErr ? ' err' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = 'toast'; }, 2800);
  }

  function storeName(id) {
    const s = stores.find(function (x) { return x.store_id === id; });
    return s ? s.name : (id || '—');
  }

  // ---------- auth ----------
  function isLoggedIn() { return localStorage.getItem(LOGIN_KEY) === 'true'; }

  async function doLogin() {
    const email = $('loginEmail').value.trim();
    const pass = $('loginPass').value;
    if (!email || !pass) { toast('أدخل البريد وكلمة المرور', true); return; }
    try {
      const user = await auth.signIn(email, pass);
      localStorage.setItem(LOGIN_KEY, 'true');
      $('loginScreen').style.display = 'none';
      $('app').style.display = 'block';
      initPanel();
    } catch (e) {
      toast(e.message, true);
    }
  }

  function logout() {
    localStorage.setItem(LOGIN_KEY, 'false');
    if (auth) auth.signOut();
    $('loginScreen').style.display = 'grid';
    $('app').style.display = 'none';
  }

  // ---------- tabs ----------
  function switchTab(name) {
    document.querySelectorAll('.tab').forEach(function (b) {
      b.classList.toggle('active', b.dataset.tab === name);
    });
    document.querySelectorAll('.tab-panel').forEach(function (p) {
      p.classList.toggle('active', p.id === 'tab-' + name);
    });
  }

  // ---------- data load + render ----------
  async function initPanel() {
    try {
      await loadAll();
      $('syncStatus').textContent = 'متصل بـ Supabase';
      $('syncStatus').style.color = 'var(--green)';
    } catch (e) {
      $('syncStatus').textContent = 'فشل الاتصال: ' + e.message;
      $('syncStatus').style.color = 'var(--red)';
    }
  }

  async function loadAll() {
    [stores, subscriptions, codes] = await Promise.all([
      db.listStores(),
      db.listSubscriptions(),
      db.listCodes()
    ]);
    renderStats();
    renderStores();
    renderCodes();
    renderSubs();
    fillCodeStoreSelect();
  }

  function renderStats() {
    const active = stores.filter(function (s) { return s.status === 'active'; }).length;
    const pending = stores.filter(function (s) { return s.status === 'pending'; }).length;
    const suspended = stores.filter(function (s) { return s.status === 'suspended'; }).length;
    const activeSubs = subscriptions.filter(function (s) { return s.status === 'active'; }).length;
    $('statsBar').innerHTML =
      '<div class="stat">المتاجر<div class="num" style="color:var(--accent)">' + stores.length + '</div></div>' +
      '<div class="stat">نشط<div class="num" style="color:var(--green)">' + active + '</div></div>' +
      '<div class="stat">قيد الإعداد<div class="num" style="color:var(--amber)">' + pending + '</div></div>' +
      '<div class="stat">موقوف<div class="num" style="color:var(--red)">' + suspended + '</div></div>' +
      '<div class="stat">اشتراكات نشطة<div class="num" style="color:#a5b4fc">' + activeSubs + '</div></div>';
  }

  function latestSub(storeId) {
    const subs = subscriptions.filter(function (s) { return s.store_id === storeId; });
    return subs.length ? subs[0] : null;
  }

  function statusBadge(status) {
    const map = {
      active: '<span class="badge badge-green">نشط</span>',
      pending: '<span class="badge badge-amber">قيد الإعداد</span>',
      suspended: '<span class="badge badge-red">موقوف</span>',
      ended: '<span class="badge badge-blue">منتهي</span>',
      cancelled: '<span class="badge badge-amber">ملغي</span>',
      trial: '<span class="badge badge-blue">تجريبي</span>'
    };
    return map[status] || '<span class="badge badge-blue">' + esc(status) + '</span>';
  }

  const PLAN_AR = { free: 'مجانية', monthly: 'شهرية', annual: 'سنوية VIP', vip: 'VIP' };

  function renderStores() {
    const body = $('storesBody');
    if (!stores.length) { body.innerHTML = '<tr><td colspan="7" class="empty">لا يوجد متاجر بعد. أضف أول متجر.</td></tr>'; return; }
    body.innerHTML = stores.map(function (s) {
      const sub = latestSub(s.store_id);
      return '<tr>' +
        '<td><strong>' + esc(s.name) + '</strong><div class="muted" style="font-size:.72rem">' + esc(s.store_id) + '</div></td>' +
        '<td><code>/' + esc(s.path_slug) + '/</code></td>' +
        '<td>' + statusBadge(s.status) + '</td>' +
        '<td>' + esc(PLAN_AR[sub && sub.plan] || (sub ? sub.plan : '—')) + '</td>' +
        '<td class="muted">' + (sub && sub.end_date ? esc(sub.end_date) : '—') + '</td>' +
        '<td>' + esc(s.owner_name || (s.owner_phone ? '📞 ' + s.owner_phone : '—')) + '</td>' +
        '<td><div class="row">' +
        '<button class="btn btn-ghost btn-sm" onclick="toggleStoreStatus(\'' + esc(s.store_id) + '\')">' + (s.status === 'suspended' ? 'تفعيل' : 'إيقاف') + '</button>' +
        '<button class="btn btn-ghost btn-sm" onclick="editStore(\'' + esc(s.store_id) + '\')">تعديل</button>' +
        '<button class="btn btn-danger btn-sm" onclick="removeStore(\'' + esc(s.store_id) + '\')">حذف</button>' +
        '</div></td>' +
        '</tr>';
    }).join('');
  }

  function renderCodes() {
    const body = $('codesBody');
    if (!codes.length) { body.innerHTML = '<tr><td colspan="7" class="empty">لا توجد أكواد.</td></tr>'; return; }
    body.innerHTML = codes.map(function (c) {
      return '<tr>' +
        '<td><code>' + esc(c.code) + '</code></td>' +
        '<td>' + esc({ subscription: 'اشتراك', fee: 'رسوم', credit: 'رصيد' }[c.code_type] || c.code_type) + '</td>' +
        '<td>' + esc(PLAN_AR[c.plan] || c.plan || '—') + '</td>' +
        '<td>' + (c.amount ? esc(c.amount) : '—') + '</td>' +
        '<td>' + storeName(c.store_id) + '</td>' +
        '<td>' + (c.used ? '<span class="badge badge-red">مستخدم</span>' : '<span class="badge badge-green">متاح</span>') + '</td>' +
        '<td><button class="btn btn-danger btn-sm" onclick="removeCode(\'' + esc(c.code) + '\')">حذف</button></td>' +
        '</tr>';
    }).join('');
  }

  function renderSubs() {
    const body = $('subsBody');
    if (!subscriptions.length) { body.innerHTML = '<tr><td colspan="7" class="empty">لا يوجد اشتراكات.</td></tr>'; return; }
    body.innerHTML = subscriptions.map(function (s) {
      return '<tr>' +
        '<td>' + storeName(s.store_id) + '</td>' +
        '<td>' + esc(PLAN_AR[s.plan] || s.plan) + '</td>' +
        '<td>' + statusBadge(s.status) + '</td>' +
        '<td>' + esc(s.amount) + '</td>' +
        '<td class="muted">' + esc(s.start_date) + '</td>' +
        '<td class="muted">' + esc(s.end_date || '—') + '</td>' +
        '<td class="muted">' + (s.paid_at ? esc(s.paid_at).slice(0, 10) : '—') + '</td>' +
        '</tr>';
    }).join('');
  }

  function fillCodeStoreSelect() {
    const sel = $('cStore');
    sel.innerHTML = '<option value="">(عام)</option>' + stores.map(function (s) {
      return '<option value="' + esc(s.store_id) + '">' + esc(s.name) + '</option>';
    }).join('');
  }

  // ---------- store CRUD ----------
  let editingStoreId = null;

  function openStoreModal() {
    editingStoreId = null;
    $('storeModalTitle').textContent = 'إضافة متجر جديد';
    ['sName', 'sSlug', 'sOwnerName', 'sOwnerPhone', 'sOwnerEmail', 'sSupabaseUrl', 'sAnonKey', 'sWriteToken'].forEach(function (id) { $(id).value = ''; });
    $('sStatus').value = 'pending';
    $('storeModal').classList.add('show');
  }

  function closeStoreModal() { $('storeModal').classList.remove('show'); }

  function editStore(id) {
    editingStoreId = id;
    const s = stores.find(function (x) { return x.store_id === id; });
    if (!s) return;
    $('storeModalTitle').textContent = 'تعديل المتجر: ' + s.name;
    $('sName').value = s.name || '';
    $('sSlug').value = s.path_slug || '';
    $('sOwnerName').value = s.owner_name || '';
    $('sOwnerPhone').value = s.owner_phone || '';
    $('sOwnerEmail').value = s.owner_email || '';
    $('sSupabaseUrl').value = s.supabase_url || '';
    $('sAnonKey').value = s.anon_key || '';
    $('sWriteToken').value = s.write_token || '';
    $('sStatus').value = s.status || 'pending';
    $('storeModal').classList.add('show');
  }

  async function saveStore() {
    const name = $('sName').value.trim();
    const slug = $('sSlug').value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!name || !slug) { toast('أدخل اسم المتجر والمسار', true); return; }

    const payload = {
      name: name,
      path_slug: slug,
      owner_name: $('sOwnerName').value.trim(),
      owner_phone: $('sOwnerPhone').value.trim(),
      owner_email: $('sOwnerEmail').value.trim(),
      supabase_url: $('sSupabaseUrl').value.trim(),
      anon_key: $('sAnonKey').value.trim(),
      write_token: $('sWriteToken').value.trim(),
      status: $('sStatus').value
    };

    try {
      if (editingStoreId) {
        await db.updateStore(editingStoreId, payload);
        toast('تم تحديث المتجر');
      } else {
        // Generate unique store_id for new store (keep friendly if slug is "default")
        const storeId = slug === 'default' ? 'default' : 'st_' + Math.random().toString(36).slice(2, 8);
        payload.store_id = storeId;
        await db.createStore(payload);
        await ensureDefaultSubscription(storeId);
        toast('تم إضافة المتجر: ' + name);
      }
      closeStoreModal();
      await loadAll();
    } catch (e) {
      toast('فشل الحفظ: ' + e.message, true);
    }
  }

  async function ensureDefaultSubscription(storeId) {
    try {
      await db.addSubscription({
        store_id: storeId,
        plan: 'free',
        amount: 0,
        status: 'trial',
        start_date: new Date().toISOString().slice(0, 10)
      });
    } catch (e) { /* non-fatal */ }
  }

  async function toggleStoreStatus(id) {
    const s = stores.find(function (x) { return x.store_id === id; });
    if (!s) return;
    const next = s.status === 'suspended' ? 'active' : 'suspended';
    if (!confirm((next === 'suspended' ? 'إيقاف' : 'تفعيل') + ' المتجر "' + s.name + '"؟')) return;
    try {
      await db.updateStore(id, { status: next });
      await loadAll();
      toast(s.status === 'suspended' ? 'تم تفعيل المتجر' : 'تم إيقاف المتجر');
    } catch (e) { toast('فشل: ' + e.message, true); }
  }

  async function removeStore(id) {
    const s = stores.find(function (x) { return x.store_id === id; });
    if (!confirm('حذف المتجر "' + (s && s.name || id) + '" نهائياً؟ ستحذف كل الاشتراكات المرتبطة.')) return;
    try {
      await db.deleteStore(id);
      await loadAll();
      toast('تم حذف المتجر');
    } catch (e) { toast('فشل الحذف: ' + e.message, true); }
  }

  // ---------- code CRUD ----------
  function openCodeModal() {
    $('cCode').value = '';
    $('cType').value = 'subscription';
    $('cPlan').value = 'monthly';
    $('cAmount').value = '';
    $('cStore').value = '';
    $('codeModal').classList.add('show');
  }
  function closeCodeModal() { $('codeModal').classList.remove('show'); }

  function genCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return 'F7-' + new Date().getFullYear() + '-' + s;
  }

  async function saveCode() {
    let code = $('cCode').value.trim().toUpperCase();
    if (!code) code = genCode();
    const amount = parseFloat($('cAmount').value) || 0;
    const storeId = $('cStore').value;
    try {
      await db.createCode({
        code: code,
        store_id: storeId || null,
        code_type: $('cType').value,
        plan: $('cType').value === 'subscription' ? $('cPlan').value : null,
        amount: $('cType').value === 'fee' ? amount : 0
      });
      closeCodeModal();
      await loadAll();
      toast('تم إصدار الكود: ' + code);
    } catch (e) { toast('فشل: ' + e.message, true); }
  }

  async function removeCode(id) {
    if (!confirm('حذف الكود ' + id + '؟')) return;
    try {
      await db.deleteCode(id);
      await loadAll();
      toast('تم حذف الكود');
    } catch (e) { toast('فشل: ' + e.message, true); }
  }

  // ---------- boot ----------
  function boot() {
    $('loginPass').addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(); });
    // Restore an existing session if a stored token was set by previous login
    if (isLoggedIn() && auth && auth.hasToken()) {
      $('loginScreen').style.display = 'none';
      $('app').style.display = 'block';
      initPanel();
    }
  }

  global.doLogin = doLogin;
  global.logout = logout;
  global.switchTab = switchTab;
  global.openStoreModal = openStoreModal;
  global.closeStoreModal = closeStoreModal;
  global.editStore = editStore;
  global.saveStore = saveStore;
  global.toggleStoreStatus = toggleStoreStatus;
  global.removeStore = removeStore;
  global.openCodeModal = openCodeModal;
  global.closeCodeModal = closeCodeModal;
  global.saveCode = saveCode;
  global.removeCode = removeCode;

  global.addEventListener('DOMContentLoaded', boot);
})(window);