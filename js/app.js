// =============================================================
// FAST7 Commercial — Super-admin panel logic (modern + hash routing)
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
      if ($('app')) $('app').classList.add('on');
      navTo('#/dashboard');
    } catch (e) { toast(e.message, true); }
  }

  function logout() {
    localStorage.setItem(LOGIN_KEY, 'false');
    if (auth) auth.signOut();
    if ($('loginScreen')) $('loginScreen').style.display = 'grid';
    if ($('app')) $('app').classList.remove('on');
  }

  // ---------- routing (hash-based, works on GitHub Pages) ----------
  // Routes: #/dashboard | #/stores | #/store/<id> | #/codes | #/subs
  function navTo(route) {
    if (!route) route = '#/dashboard';
    if (location.hash !== route) { location.hash = route; return; }
    renderRoute();
  }

  function parseRoute() {
    const h = (location.hash || '#/dashboard').replace(/^#/, '');
    const parts = h.split('/').filter(Boolean);
    return { page: parts[0] || 'dashboard', id: parts[1] || null };
  }

  function setNavActive(page) {
    document.querySelectorAll('.nav-item').forEach(function (b) {
      b.classList.toggle('active', b.dataset.nav === page || (page === 'store' && b.dataset.nav === 'stores'));
    });
  }

  function renderRoute() {
    const { page, id } = parseRoute();
    setNavActive(page);
    if (window.storesLoaded) {
      if (page === 'stores') { renderStoresPage(); }
      else if (page === 'store') { renderStoreDetailPage(id); }
      else if (page === 'codes') { renderCodesPage(); }
      else if (page === 'subs') { renderSubsPage(); }
      else { renderDashboardPage(); }
    }
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
    window.storesLoaded = true;
    renderRoute();
    fillCodeStoreSelect();
  }

  // ---------- stats / helpers ----------
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

  function statsHTML() {
    const active = stores.filter(function (s) { return s.status === 'active'; }).length;
    const pending = stores.filter(function (s) { return s.status === 'pending'; }).length;
    const suspended = stores.filter(function (s) { return s.status === 'suspended'; }).length;
    const activeSubs = subscriptions.filter(function (s) { return s.status === 'active'; }).length;
    return '' +
      '<div class="stat"><div class="lbl">المتاجر</div><div class="num" style="color:var(--accent)">' + stores.length + '</div></div>' +
      '<div class="stat"><div class="lbl">نشط</div><div class="num" style="color:var(--green)">' + active + '</div></div>' +
      '<div class="stat"><div class="lbl">قيد الإعداد</div><div class="num" style="color:var(--amber)">' + pending + '</div></div>' +
      '<div class="stat"><div class="lbl">موقوف</div><div class="num" style="color:var(--red)">' + suspended + '</div></div>' +
      '<div class="stat"><div class="lbl">اشتراكات نشطة</div><div class="num" style="color:var(--accent)">' + activeSubs + '</div></div>';
  }

  function kvi(k, v, ltr) {
    return '<div class="kv-item"><div class="k">' + esc(k) + '</div><div class="v' + (ltr ? ' ltr' : '') + '">' + v + '</div></div>';
  }

  // ---------- page renderers ----------
  function renderDashboardPage() {
    const recent = stores.slice(0, 6);
    const list = recent.length
      ? '<div class="table-wrap"><table><thead><tr><th>المتجر</th><th>المسار</th><th>الحالة</th><th>الخطة</th></tr></thead><tbody>' +
        recent.map(function (s) {
          const sub = latestSub(s.store_id);
          return '<tr class="row-link" onclick="navTo(\'#/store/' + esc(s.store_id) + '\'),event.stopPropagation()">' +
            '<td><strong>' + esc(s.name) + '</strong></td>' +
            '<td><code dir="ltr">/' + esc(s.path_slug) + '/</code></td>' +
            '<td>' + statusBadge(s.status) + '</td>' +
            '<td>' + esc(PLAN_AR[sub && sub.plan] || '—') + '</td></tr>';
        }).join('') + '</tbody></table></div>'
      : '<div class="empty">لا توجد متاجر بعد. أضف أول متجر عبر صفحة المتاجر.</div>';

    $('mainContent').innerHTML =
      '<div class="page-top"><div><h1>لوحة المعلومات</h1><div class="crumb">نظرة عامة على المتاجر والاشتراكات</div></div></div>' +
      '<div class="stats">' + statsHTML() + '</div>' +
      '<div class="card"><div class="row" style="justify-content:space-between;margin-bottom:12px;padding:0 4px">' +
      '<h3 style="margin:0;font-size:.95rem">أحدث المتاجر</h3>' +
      '<a class="btn btn-ghost btn-sm" href="#/stores">عرض الكل ←</a></div>' + list + '</div>';
  }

  function renderStoresPage() {
    const body = stores.length
      ? '<div class="table-wrap"><table><thead><tr><th>المتجر</th><th>المسار</th><th>الحالة</th><th>الخطة</th><th>الإنتهاء</th><th>المالك</th><th>إجراءات</th></tr></thead><tbody>' +
        stores.map(function (s) {
          const sub = latestSub(s.store_id);
          return '<tr>' +
            '<td><strong>' + esc(s.name) + '</strong><div class="muted" style="font-size:.72rem">' + esc(s.store_id) + '</div></td>' +
            '<td><code dir="ltr">/' + esc(s.path_slug) + '/</code></td>' +
            '<td>' + statusBadge(s.status) + '</td>' +
            '<td>' + esc(PLAN_AR[sub && sub.plan] || (sub ? sub.plan : '—')) + '</td>' +
            '<td class="muted">' + (sub && sub.end_date ? esc(sub.end_date) : '—') + '</td>' +
            '<td>' + esc(s.owner_name || (s.owner_phone ? '📞 ' + s.owner_phone : '—')) + '</td>' +
            '<td><div class="row" onclick="event.stopPropagation()">' +
            (s.admin_code ? '<button class="btn btn-ghost btn-sm" onclick="copyAdminCode(\'' + esc(s.store_id) + '\')" title="نسخ كود لوحة التحكم">🔑</button>' : '') +
            '<a class="btn btn-ghost btn-sm" href="#/store/' + esc(s.store_id) + '">الصفحة</a>' +
            '<button class="btn btn-ghost btn-sm" onclick="toggleStoreStatus(\'' + esc(s.store_id) + '\')">' + (s.status === 'suspended' ? 'تفعيل' : 'إيقاف') + '</button>' +
            '<button class="btn btn-ghost btn-sm" onclick="editStore(\'' + esc(s.store_id) + '\')">تعديل</button>' +
            '<button class="btn btn-danger btn-sm" onclick="removeStore(\'' + esc(s.store_id) + '\')">حذف</button>' +
            '</div></td></tr>';
        }).join('')
      : '<tr><td colspan="7" class="empty">لا يوجد متاجر بعد. أضف أول متجر.</td></tr>';

    $('mainContent').innerHTML =
      '<div class="page-top"><div><h1>المتاجر المشتركة</h1><div class="crumb">إدارة وعرض كل المتاجر — لكل متجر صفحة خاصة</div></div>' +
      '<button class="btn btn-primary" onclick="openStoreModal()">+ إضافة متجر</button></div>' +
      '<div class="stats">' + statsHTML() + '</div>' +
      '<div class="card" style="padding:8px"><div class="table-wrap"><table><thead><tr><th>المتجر</th><th>المسار</th><th>الحالة</th><th>الخطة</th><th>الإنتهاء</th><th>المالك</th><th>إجراءات</th></tr></thead><tbody>' +
      body + '</tbody></table></div></div>';
  }

  function renderStoreDetailPage(id) {
    const mc = $('mainContent');
    const s = stores.find(function (x) { return x.store_id === id; });
    if (!s) {
      mc.innerHTML = '<div class="card"><div class="empty">المتجر غير موجود.</div><div style="text-align:center;margin-top:8px"><button class="btn btn-ghost" onclick="navTo(\'#/stores\')">← عودة للمتاجر</button></div></div>';
      return;
    }
    const sub = latestSub(s.store_id);
    const initial = (s.name || '?').trim().charAt(0).toUpperCase();
    mc.innerHTML =
      '<div class="page-top"><div>' +
      '<a class="muted" style="font-weight:700;font-size:.85rem" href="#/stores">← المتاجر</a>' +
      '<div class="crumb">صفحة المتجر الخاصة</div></div></div>' +

      '<div class="store-head">' +
      '<div class="store-avatar">' + esc(initial) + '</div>' +
      '<div style="flex:1">' +
      '<h2>' + esc(s.name) + '</h2>' +
      '<div class="sub"><code dir="ltr">/' + esc(s.path_slug) + '/</code> · ' + statusBadge(s.status) + ' · ' + esc(PLAN_AR[sub && sub.plan] || 'بدون خطة') + '</div>' +
      '</div>' +
      '<div class="row">' +
      (s.admin_code ? '<button class="btn btn-ghost" onclick="copyAdminCode(\'' + esc(s.store_id) + '\')">🔑 نسخ الكود</button>' : '') +
      '<button class="btn btn-ghost" onclick="editStore(\'' + esc(s.store_id) + '\')">تعديل</button>' +
      '<button class="btn ' + (s.status === 'suspended' ? 'btn-green' : 'btn-danger') + '" onclick="toggleStoreStatus(\'' + esc(s.store_id) + '\')">' + (s.status === 'suspended' ? 'تفعيل' : 'إيقاف') + '</button>' +
      '</div></div>' +

      '<div class="card"><h3 style="margin:0 0 14px;font-size:.95rem">معلومات المتجر</h3>' +
      '<div class="kv">' +
      kvi('المعرّف (store_id)', esc(s.store_id), true) +
      kvi('المسار', '/' + esc(s.path_slug) + '/') +
      kvi('الحالة', statusBadge(s.status)) +
      kvi('الخطة', esc(PLAN_AR[sub && sub.plan] || '—')) +
      kvi('نهاية الاشتراك', (sub && sub.end_date) ? esc(sub.end_date) : '—') +
      kvi('اسم المالك', esc(s.owner_name || '—')) +
      kvi('هاتف المالك', esc(s.owner_phone || '—')) +
      kvi('بريد المالك', esc(s.owner_email || '—')) +
      '</div></div>' +

      (s.admin_code
        ? '<div class="card"><h3 style="margin:0 0 14px;font-size:.95rem">كود لوحة التحكم</h3>' +
          '<div class="kv-item"><div class="k">كود فتح لوحة إدارة المتجر (محفوظ عند الشركة فقط)</div>' +
          '<div class="v ltr" style="font-family:monospace;font-weight:800">' + esc(s.admin_code) + '</div></div></div>'
        : '') +

      '<div class="card"><h3 style="margin:0 0 14px;font-size:.95rem">اتصال Supabase</h3>' +
      '<div class="kv">' +
      kvi('URL', esc(s.supabase_url || '—'), true) +
      kvi('Anon Key', esc(s.anon_key || '—'), true) +
      kvi('Write Token', esc(s.write_token || '—'), true) +
      '</div></div>';
  }

  function renderCodesPage() {
    const body = codes.length
      ? '<div class="table-wrap"><table><thead><tr><th>الكود</th><th>النوع</th><th>الخطة</th><th>المبلغ</th><th>المتجر</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>' +
        codes.map(function (c) {
          return '<tr>' +
            '<td><code dir="ltr">' + esc(c.code) + '</code></td>' +
            '<td>' + esc({ subscription: 'اشتراك', fee: 'رسوم', credit: 'رصيد' }[c.code_type] || c.code_type) + '</td>' +
            '<td>' + esc(PLAN_AR[c.plan] || c.plan || '—') + '</td>' +
            '<td>' + (c.amount ? esc(c.amount) : '—') + '</td>' +
            '<td>' + storeName(c.store_id) + '</td>' +
            '<td>' + (c.used ? '<span class="badge badge-red">مستخدم</span>' : '<span class="badge badge-green">متاح</span>') + '</td>' +
            '<td><button class="btn btn-danger btn-sm" onclick="removeCode(\'' + esc(c.code) + '\')">حذف</button></td></tr>';
        }).join('')
      : '<tr><td colspan="7" class="empty">لا توجد أكواد.</td></tr>';

    $('mainContent').innerHTML =
      '<div class="page-top"><div><h1>أكواد الاشتراك والدفع</h1><div class="crumb">إصدار وإدارة أكواد التفعيل</div></div>' +
      '<button class="btn btn-primary" onclick="openCodeModal()">+ إصدار كود</button></div>' +
      '<div class="card" style="padding:8px"><div class="table-wrap"><table><thead><tr><th>الكود</th><th>النوع</th><th>الخطة</th><th>المبلغ</th><th>المتجر</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>' +
      body + '</tbody></table></div></div>';
  }

  function renderSubsPage() {
    const body = subscriptions.length
      ? '<div class="table-wrap"><table><thead><tr><th>المتجر</th><th>الخطة</th><th>الحالة</th><th>المبلغ</th><th>البداية</th><th>النهاية</th><th>الدفع</th></tr></thead><tbody>' +
        subscriptions.map(function (s) {
          return '<tr>' +
            '<td>' + storeName(s.store_id) + '</td>' +
            '<td>' + esc(PLAN_AR[s.plan] || s.plan) + '</td>' +
            '<td>' + statusBadge(s.status) + '</td>' +
            '<td>' + esc(s.amount) + '</td>' +
            '<td class="muted">' + esc(s.start_date) + '</td>' +
            '<td class="muted">' + esc(s.end_date || '—') + '</td>' +
            '<td class="muted">' + (s.paid_at ? esc(s.paid_at).slice(0, 10) : '—') + '</td></tr>';
        }).join('')
      : '<tr><td colspan="7" class="empty">لا يوجد اشتراكات.</td></tr>';

    $('mainContent').innerHTML =
      '<div class="page-top"><div><h1>الاشتراكات</h1><div class="crumb">كل الاشتراكات عبر المتاجر</div></div></div>' +
      '<div class="card" style="padding:8px"><div class="table-wrap"><table><thead><tr><th>المتجر</th><th>الخطة</th><th>الحالة</th><th>المبلغ</th><th>البداية</th><th>النهاية</th><th>الدفع</th></tr></thead><tbody>' +
      body + '</tbody></table></div></div>';
  }

  function fillCodeStoreSelect() {
    const sel = $('cStore');
    if (!sel) return;
    sel.innerHTML = '<option value="">(عام)</option>' + stores.map(function (s) {
      return '<option value="' + esc(s.store_id) + '">' + esc(s.name) + '</option>';
    }).join('');
  }

  // ---------- store CRUD ----------
  let editingStoreId = null;

  function openStoreModal() {
    editingStoreId = null;
    $('storeModalTitle').textContent = 'إضافة متجر جديد';
    ['sName', 'sSlug', 'sOwnerName', 'sOwnerPhone', 'sOwnerEmail', 'sSupabaseUrl', 'sAnonKey', 'sWriteToken', 'sAdminCode'].forEach(function (id) { $(id).value = ''; });
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
    $('sAdminCode').value = s.admin_code || '';
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
      admin_code: $('sAdminCode').value.trim() || null,
      status: $('sStatus').value
    };

    try {
      if (editingStoreId) {
        await db.updateStore(editingStoreId, payload);
        toast('تم تحديث المتجر');
      } else {
        const storeId = slug === 'default' ? 'default' : 'st_' + Math.random().toString(36).slice(2, 8);
        payload.store_id = storeId;
        await db.createStore(payload);
        await ensureDefaultSubscription(storeId);
        toast('تم إضافة المتجر: ' + name);
      }
      closeStoreModal();
      await loadAll();
    } catch (e) { toast('فشل الحفظ: ' + e.message, true); }
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

  function copyAdminCode(id) {
    const s = stores.find(function (x) { return x.store_id === id; });
    if (!s || !s.admin_code) return;
    try {
      navigator.clipboard.writeText(s.admin_code);
      toast('تم نسخ كود لوحة التحكم للمتجر: ' + s.name, false);
    } catch (e) { toast('الكود: ' + s.admin_code, false); }
  }

  // Generate a secure random admin code and fill the store form field.
  function generateAdminCode() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    var len = 10;
    var code = '';
    var buf = new Uint32Array(len);
    try { (window.crypto || window.msCrypto).getRandomValues(buf); } catch (e) { for (var i = 0; i < len; i++) buf[i] = Math.floor(Math.random() * 4294967296); }
    for (var i = 0; i < len; i++) code += chars.charAt(buf[i] % chars.length);
    $('sAdminCode').value = code;
    toast('تم توليد كود عشوائي آمن', false);
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
  async function boot() {
    $('loginPass').addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(); });
    if (isLoggedIn() && auth && auth.hasToken()) {
      try {
        await loadAll();
        $('loginScreen').style.display = 'none';
        if ($('app')) $('app').classList.add('on');
        renderRoute();
      } catch (e) {
        localStorage.setItem(LOGIN_KEY, 'false');
        if (auth) auth.signOut();
        $('loginScreen').style.display = 'grid';
        if ($('app')) $('app').classList.remove('on');
      }
      return;
    }
    if (isLoggedIn()) { localStorage.setItem(LOGIN_KEY, 'false'); }
  }

  global.doLogin = doLogin;
  global.logout = logout;
  global.navTo = navTo;
  global.renderRoute = renderRoute;
  global.openStoreModal = openStoreModal;
  global.closeStoreModal = closeStoreModal;
  global.editStore = editStore;
  global.saveStore = saveStore;
  global.toggleStoreStatus = toggleStoreStatus;
  global.removeStore = removeStore;
  global.copyAdminCode = copyAdminCode;
  global.generateAdminCode = generateAdminCode;
  global.openCodeModal = openCodeModal;
  global.closeCodeModal = closeCodeModal;
  global.saveCode = saveCode;
  global.removeCode = removeCode;

  global.addEventListener('hashchange', renderRoute);
  global.addEventListener('DOMContentLoaded', boot);
})(window);
