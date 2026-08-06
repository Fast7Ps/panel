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

  // ---------- routing ----------
  // Hash-based routing works on GitHub Pages without server config.
  // Routes: #/dashboard | #/stores | #/store/<id> | #/codes | #/subs
  function navTo(route) {
    if (!route) route = '#/dashboard';
    if (location.hash !== route) { location.hash = route; return; }
    renderRoute();
  }

  function parseRoute() {
    const h = (location.hash || '#/dashboard').replace(/^#/, '');
    const parts = h.split('/').filter(Boolean); // e.g. ['store','st_abc']
    return { page: parts[0] || 'dashboard', id: parts[1] || null };
  }

  function renderRoute() {
    const { page, id } = parseRoute();
    // highlight active nav
    document.querySelectorAll('.nav-item').forEach(function (b) {
      b.classList.toggle('active', b.dataset.nav === page || (page === 'store' && b.dataset.nav === 'stores'));
    });
    if (page === 'stores') { renderStoresPage(); }
    else if (page === 'store') { renderStoreDetailPage(id); }
    else if (page === 'codes') { renderCodesPage(); }
    else if (page === 'subs') { renderSubsPage(); }
    else if (page === 'notifs') { renderNotifsPage(); }
    else { renderDashboardPage(); }
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

    // Auto-refresh every 20 seconds when on codes page to detect used codes
    setInterval(async function() {
      try {
        var current = window.location.hash;
        if (current === '#/codes' || current === '' || !current) {
          var freshCodes = await db.listCodes();
          // Only re-render if there's any change (e.g. a code was just used)
          var changed = JSON.stringify(freshCodes) !== JSON.stringify(codes);
          if (changed) {
            codes = freshCodes;
            renderRoute();
            $('syncStatus').textContent = 'تم التحديث ' + new Date().toLocaleTimeString('ar-SA', {hour:'2-digit', minute:'2-digit'});
          }
        }
      } catch(e) {}
    }, 20000);
  }

  async function loadAll() {
    [stores, subscriptions, codes] = await Promise.all([
      db.listStores(),
      db.listSubscriptions(),
      db.listCodes()
    ]);
    renderRoute();
    fillCodeStoreSelect();
  }

  function renderStats() {
    const active = stores.filter(function (s) { return s.status === 'active'; }).length;
    const pending = stores.filter(function (s) { return s.status === 'pending'; }).length;
    const suspended = stores.filter(function (s) { return s.status === 'suspended'; }).length;
    const activeSubs = subscriptions.filter(function (s) { return s.status === 'active'; }).length;
    return '<div class="stat-card" style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:18px;display:flex;align-items:center;gap:14px;box-shadow:var(--shadow);transition:var(--transition)"><i class="fa-solid fa-store" style="font-size:1.8rem;color:var(--accent);width:46px;height:46px;display:flex;align-items:center;justify-content:center;background:var(--accent-soft);border-radius:12px"></i><div><span style="font-size:1.4rem;font-weight:800;display:block">' + stores.length + '</span><p style="font-size:.78rem;color:var(--muted);margin:0">المتاجر</p></div></div>' +
      '<div class="stat-card" style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:18px;display:flex;align-items:center;gap:14px;box-shadow:var(--shadow);transition:var(--transition)"><i class="fa-solid fa-circle-check" style="font-size:1.8rem;color:var(--green);width:46px;height:46px;display:flex;align-items:center;justify-content:center;background:var(--green-soft);border-radius:12px"></i><div><span style="font-size:1.4rem;font-weight:800;display:block">' + active + '</span><p style="font-size:.78rem;color:var(--muted);margin:0">نشط</p></div></div>' +
      '<div class="stat-card" style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:18px;display:flex;align-items:center;gap:14px;box-shadow:var(--shadow);transition:var(--transition)"><i class="fa-solid fa-clock" style="font-size:1.8rem;color:var(--amber);width:46px;height:46px;display:flex;align-items:center;justify-content:center;background:var(--amber-soft);border-radius:12px"></i><div><span style="font-size:1.4rem;font-weight:800;display:block">' + pending + '</span><p style="font-size:.78rem;color:var(--muted);margin:0">قيد الإعداد</p></div></div>' +
      '<div class="stat-card" style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:18px;display:flex;align-items:center;gap:14px;box-shadow:var(--shadow);transition:var(--transition)"><i class="fa-solid fa-circle-minus" style="font-size:1.8rem;color:var(--red);width:46px;height:46px;display:flex;align-items:center;justify-content:center;background:var(--red-soft);border-radius:12px"></i><div><span style="font-size:1.4rem;font-weight:800;display:block">' + suspended + '</span><p style="font-size:.78rem;color:var(--muted);margin:0">موقوف</p></div></div>' +
      '<div class="stat-card" style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:18px;display:flex;align-items:center;gap:14px;box-shadow:var(--shadow);transition:var(--transition)"><i class="fa-solid fa-credit-card" style="font-size:1.8rem;color:var(--accent);width:46px;height:46px;display:flex;align-items:center;justify-content:center;background:var(--accent-soft);border-radius:12px"></i><div><span style="font-size:1.4rem;font-weight:800;display:block">' + activeSubs + '</span><p style="font-size:.78rem;color:var(--muted);margin:0">اشتراكات نشطة</p></div></div>';
  }

  // ---------- page renderers ----------
  function renderDashboardPage() {
    const mc = $('mainContent');
    mc.innerHTML =
      '<div class="page-top"><div><h1>لوحة المعلومات</h1><div class="crumb">نظرة عامة على المتاجر والاشتراكات</div></div></div>' +
      '<div class="stats">' + renderStats() + '</div>';

    const recent = stores.slice(0, 6);
    mc.innerHTML +=
      '<div class="card"><div class="row" style="justify-content:space-between;margin-bottom:12px">' +
      '<h3 style="margin:0;font-size:.95rem">أحدث المتاجر</h3>' +
      '<a class="btn btn-ghost btn-sm" href="#/stores">عرض الكل ←</a></div>' +
      (recent.length
        ? '<div class="table-wrap"><table><thead><tr><th>المتجر</th><th>المسار</th><th>الحالة</th><th>الخطة</th></tr></thead><tbody>' +
          recent.map(function (s) {
            const sub = latestSub(s.store_id);
            return '<tr style="cursor:pointer" onclick="navTo(\'#/store/' + esc(s.store_id) + '\')">' +
              '<td><strong>' + esc(s.name) + '</strong></td>' +
              '<td><code>/' + esc(s.path_slug) + '/</code></td>' +
              '<td>' + statusBadge(s.status) + '</td>' +
              '<td>' + esc(PLAN_AR[sub && sub.plan] || '—') + '</td></tr>';
          }).join('') + '</tbody></table></div>'
        : '<div class="empty">لا توجد متاجر بعد. أضف أول متجر عبر صفحة المتاجر.</div>') +
      '</div>';
  }

  // Fetch accumulated fees from a store's Supabase DB
  async function fetchStoreFees(store) {
    var url = store.supabase_url.replace(/\/+$/, '');
    var key = store.anon_key;
    // Try to read fee info via rpc or direct table
    var resp = await fetch(url + '/rest/v1/rpc/get_fee_info', {
      method: 'POST',
      headers: { 'apikey': key, 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: '{}'
    });
    if (resp.ok) {
      var data = await resp.json();
      if (data && typeof data.accrued !== 'undefined') return data;
    }
    // Fallback: read raw settings key
    var resp2 = await fetch(url + '/rest/v1/rpc/get_setting', {
      method: 'POST',
      headers: { 'apikey': key, 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_key: 'mycart_free_orders_count' })
    });
    var count = 0;
    if (resp2.ok) { try { count = parseInt(await resp2.json()) || 0; } catch(e) {} }
    var freeFee = 2; // default
    return { accrued: count * freeFee, limit: 100, count: count };
  }

  // Fetch store logo setting from tenant Supabase DB
  async function fetchStoreLogo(store) {
    if (!store.supabase_url || !store.anon_key) return null;
    var url = store.supabase_url.replace(/\/+$/, '');
    var key = store.anon_key;
    var resp = await fetch(url + '/rest/v1/rpc/get_setting', {
      method: 'POST',
      headers: { 'apikey': key, 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_key: 'mycart_logo' })
    });
    if (!resp.ok) return null;
    var data = await resp.json();
    return data || null;
  }

  function renderStoresPage() {
    const mc = $('mainContent');
    const body = stores.length
      ? '<div class="table-wrap"><table><thead><tr><th>المتجر</th><th>المسار</th><th>الحالة</th><th>الخطة</th><th>الإنتهاء</th><th>الرسوم المتراكمة</th><th>المالك</th><th>إجراءات</th></tr></thead><tbody>' +
        stores.map(function (s) {
          const sub = latestSub(s.store_id);
          var planKey = sub && sub.plan;
          var isFree = !planKey || planKey === 'free';
          const initial = (s.name || '?').trim().charAt(0).toUpperCase();
          const colors = ['#eff6ff', '#f0fdf4', '#fdf2f8', '#fff7ed', '#faf5ff'];
          const textColors = ['#1e40af', '#166534', '#9d174d', '#9a3412', '#6b21a8'];
          const charCode = (s.name || '?').charCodeAt(0);
          const colorIdx = charCode % colors.length;
          
          return '<tr style="cursor:pointer" onclick="navTo(\'#/store/' + esc(s.store_id) + '\')">' +
            '<td><div style="display:flex;align-items:center;gap:12px">' +
              '<div id="logo-' + esc(s.store_id) + '" style="width:40px;height:40px;border-radius:10px;background:' + colors[colorIdx] + ';color:' + textColors[colorIdx] + ';display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1.15rem;flex-shrink:0;border:1px solid #e2e8f0">' + esc(initial) + '</div>' +
              '<div><strong>' + esc(s.name) + '</strong><div class="muted" style="font-size:.72rem">' + esc(s.store_id) + '</div></div>' +
            '</div></td>' +
            '<td><code>/' + esc(s.path_slug) + '/</code></td>' +
            '<td>' + statusBadge(s.status) + '</td>' +
            '<td>' + esc(PLAN_AR[planKey] || (sub ? sub.plan : '—')) + '</td>' +
            '<td class="muted">' + (sub && sub.end_date ? esc(sub.end_date) : '—') + '</td>' +
            '<td id="fees-' + esc(s.store_id) + '">' + (isFree ? '<span style="color:#94a3b8;font-size:.75rem">جارٍ الجلب...</span>' : '<span class="badge badge-green" style="font-size:.7rem">إعفاء كامل</span>') + '</td>' +
            '<td>' + esc(s.owner_name || (s.owner_phone ? '📞 ' + s.owner_phone : '—')) + '</td>' +
            '<td><div class="row" onclick="event.stopPropagation()">' +
            (s.admin_code ? '<button class="btn btn-ghost btn-sm" onclick="copyAdminCode(\'' + esc(s.store_id) + '\')" title="نسخ كود لوحة التحكم">🔑</button>' : '') +
            '<a class="btn btn-ghost btn-sm" href="#/store/' + esc(s.store_id) + '">الصفحة</a>' +
            '<button class="btn btn-ghost btn-sm" onclick="toggleStoreStatus(\'' + esc(s.store_id) + '\')">' + (s.status === 'suspended' ? 'تفعيل' : 'إيقاف') + '</button>' +
            '<button class="btn btn-ghost btn-sm" onclick="editStore(\'' + esc(s.store_id) + '\')">تعديل</button>' +
            '<button class="btn btn-danger btn-sm" onclick="removeStore(\'' + esc(s.store_id) + '\')">حذف</button>' +
            '</div></td>' +
            '</tr>';
        }).join('') + '</tbody></table></div>'
      : '<div class="empty">لا يوجد متاجر بعد. أضف أول متجر.</div>';

    mc.innerHTML =
      '<div class="page-top"><div><h1>المتاجر المشتركة</h1><div class="crumb">إدارة وعرض كل المتاجر — لكل متجر صفحة خاصة</div></div>' +
      '<div class="row" style="gap:10px">' +
      '<button class="btn btn-notif" onclick="openBroadcastModal()"><i class="fa-solid fa-broadcast-tower"></i> إشعار لكل المتاجر</button>' +
      '<button class="btn btn-primary" onclick="openStoreModal()"><i class="fa-solid fa-plus"></i> إضافة متجر</button>' +
      '</div></div>' +
      '<div class="stats">' + renderStats() + '</div>' +
      '<div class="card" style="padding:8px">' + body + '</div>';

    // Async: fetch accumulated fees for free-plan stores
    stores.forEach(function(s) {
      var sub = latestSub(s.store_id);
      var isFree = !sub || !sub.plan || sub.plan === 'free';
      
      // Async fetch logo
      if (s.supabase_url && s.anon_key) {
        fetchStoreLogo(s).then(function(logoUrl) {
          var el = document.getElementById('logo-' + s.store_id);
          if (el && logoUrl) {
            el.innerHTML = '<img src="' + logoUrl + '" style="width:100%;height:100%;object-fit:cover;border-radius:9px">';
          }
        }).catch(function() {});
      }

      if (!isFree) return; // paid plans have no fees
      var cell = document.getElementById('fees-' + s.store_id);
      if (!cell) return;
      if (!s.supabase_url || !s.anon_key) {
        cell.innerHTML = '<span class="muted" style="font-size:.72rem">—</span>';
        return;
      }
      fetchStoreFees(s).then(function(data) {
        if (!cell) return;
        if (data.accrued <= 0) {
          cell.innerHTML = '<span class="muted" style="font-size:.72rem">0 ₪</span>';
        } else {
          var color = data.accrued >= data.limit ? '#ef4444' : data.accrued >= data.limit * 0.7 ? '#f59e0b' : '#10b981';
          cell.innerHTML = '<span style="font-weight:800;color:' + color + '">' + data.accrued + ' ₪</span>' +
            '<div style="font-size:.62rem;color:#94a3b8">' + data.accrued + ' / ' + data.limit + ' ₪</div>';
        }
      }).catch(function() {
        if (cell) cell.innerHTML = '<span class="muted" style="font-size:.72rem">—</span>';
      });
    });  // end stores.forEach
  }  // end renderStoresPage

  function renderStoreDetailPage(id) {
    const mc = $('mainContent');
    const s = stores.find(function (x) { return x.store_id === id; });
    if (!s) {
      mc.innerHTML = '<div class="card"><div class="empty">المتجر غير موجود.</div><div style="text-align:center;margin-top:8px"><a class="btn btn-ghost" href="#/stores">← عودة للمتاجر</a></div></div>';
      return;
    }
    const sub = latestSub(s.store_id);
    const initial = (s.name || '?').trim().charAt(0).toUpperCase();
    const storeUrl = s.path_slug === 'default' 
      ? 'https://fast7ps.github.io/' 
      : 'https://fast7ps.github.io/stores/' + esc(s.path_slug) + '/';
      
    mc.innerHTML =
      '<div class="page-top"><div><a href="#/stores" class="muted" style="font-size:.8rem;font-weight:700">← المتاجر</a>' +
      '<div class="crumb">صفحة المتجر الخاصة</div></div></div>' +

      '<div class="store-head">' +
      '<div class="store-avatar" id="detail-logo-' + esc(s.store_id) + '">' + esc(initial) + '</div>' +
      '<div style="flex:1">' +
      '<h2>' + esc(s.name) + '</h2>' +
      '<div class="sub"><code>/' + esc(s.path_slug) + '/</code> · ' + statusBadge(s.status) + ' · ' + esc(PLAN_AR[sub && sub.plan] || 'بدون خطة') + '</div>' +
      '</div>' +
      '<div class="row">' +
      '<a class="btn btn-primary" href="' + storeUrl + '" target="_blank"><i class="fa-solid fa-arrow-up-right-from-square"></i> زيارة المتجر</a>' +
      (s.supabase_url && s.write_token ? '<button class="btn btn-notif" onclick="openNotifModal(\'' + esc(s.store_id) + '\')" title="إرسال إشعار للمتجر"><i class="fa-solid fa-bell"></i> إرسال إشعار</button>' : '') +
      '<button class="btn btn-ghost" onclick="openCodeModalForStore(\'' + esc(s.store_id) + '\')"><i class="fa-solid fa-plus"></i> إصدار كود</button>' +
      (s.admin_code ? '<button class="btn btn-ghost" onclick="copyAdminCode(\'' + esc(s.store_id) + '\')"><i class="fa-solid fa-key"></i> نسخ الكود</button>' : '') +
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
      kvi('الرسوم المتراكمة', '<span id="detail-fees-' + esc(s.store_id) + '">' + (isFree ? 'جارٍ الجلب...' : '<span class="badge badge-green">إعفاء كامل</span>') + '</span>') +
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

    // Async: fetch accumulated fees for the detail store if it's free plan
    var planKey = sub && sub.plan;
    var isFree = !planKey || planKey === 'free';
    
    if (s.supabase_url && s.anon_key) {
      fetchStoreLogo(s).then(function(logoUrl) {
        var el = document.getElementById('detail-logo-' + s.store_id);
        if (el && logoUrl) {
          el.innerHTML = '<img src="' + logoUrl + '" style="width:100%;height:100%;object-fit:cover;border-radius:15px">';
        }
      }).catch(function() {});
    }

    if (isFree && s.supabase_url && s.anon_key) {
      fetchStoreFees(s).then(function(data) {
        var el = document.getElementById('detail-fees-' + s.store_id);
        if (!el) return;
        if (data.accrued <= 0) {
          el.innerHTML = '<span style="color:#64748b;font-weight:700">0 ₪</span>';
        } else {
          var color = data.accrued >= data.limit ? '#ef4444' : data.accrued >= data.limit * 0.7 ? '#f59e0b' : '#10b981';
          el.innerHTML = '<span style="font-weight:800;color:' + color + '">' + data.accrued + ' ₪</span>' +
            ' <span style="font-size:.75rem;color:#94a3b8">(' + data.accrued + ' ₪ مستهلكة من أصل حد ' + data.limit + ' ₪)</span>';
        }
      }).catch(function() {
        var el = document.getElementById('detail-fees-' + s.store_id);
        if (el) el.innerHTML = '<span class="muted">—</span>';
      });
    }
  }

  function kvi(k, v, ltr) {
    return '<div class="kv-item"><div class="k">' + k + '</div><div class="v' + (ltr ? ' ltr' : '') + '">' + v + '</div></div>';
  }

  function renderCodesPage() {
    const mc = $('mainContent');
    const body = codes.length
      ? '<div class="table-wrap"><table><thead><tr><th>الكود</th><th>النوع</th><th>الخطة</th><th>المبلغ</th><th>المتجر</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>' +
        codes.map(function (c) {
          return '<tr>' +
            '<td><code>' + esc(c.code) + '</code></td>' +
            '<td>' + esc({ subscription: 'اشتراك', fee: 'رسوم', credit: 'رصيد' }[c.code_type] || c.code_type) + '</td>' +
            '<td>' + esc(PLAN_AR[c.plan] || c.plan || '—') + '</td>' +
            '<td>' + (c.amount ? esc(c.amount) : '—') + '</td>' +
            '<td>' + storeName(c.store_id) + '</td>' +
            '<td>' + (c.used ? '<span class="badge badge-red">مستخدم</span>' : '<span class="badge badge-green">متاح</span>') + '</td>' +
            '<td><button class="btn btn-danger btn-sm" onclick="removeCode(\'' + esc(c.code) + '\')">حذف</button></td>' +
            '</tr>';
        }).join('') + '</tbody></table></div>'
      : '<div class="empty">لا توجد أكواد.</div>';

    mc.innerHTML =
      '<div class="page-top"><div><h1>أكواد الاشتراك والدفع</h1><div class="crumb">إصدار وإدارة أكواد التفعيل</div></div>' +
      '<div class="row" style="gap:10px">' +
      '<button class="btn btn-ghost btn-sm" onclick="refreshCodesNow()" title="تحديث الأكواد الآن"><i class="fa-solid fa-rotate-right"></i></button>' +
      '<button class="btn btn-primary" onclick="openCodeModal()"><i class="fa-solid fa-plus"></i> إصدار كود</button>' +
      '</div></div>' +
      '<div class="card" style="padding:8px">' + body + '</div>';
  }

  function renderSubsPage() {
    const mc = $('mainContent');
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
            '<td class="muted">' + (s.paid_at ? esc(s.paid_at).slice(0, 10) : '—') + '</td>' +
            '</tr>';
        }).join('') + '</tbody></table></div>'
      : '<div class="empty">لا يوجد اشتراكات.</div>';

    mc.innerHTML =
      '<div class="page-top"><div><h1>الاشتراكات</h1><div class="crumb">كل الاشتراكات عبر المتاجر</div></div></div>' +
      '<div class="card" style="padding:8px">' + body + '</div>';
  }

  function renderNotifsPage() {
    var mc = $('mainContent');

    var storeOptions = stores.map(function(s){
      return '<option value="' + esc(s.store_id) + '">' + esc(s.name) + (s.supabase_url ? '' : ' (بدون Supabase)') + '</option>';
    }).join('');

    var storeRows = stores.map(function(s){
      var hasConn = !!(s.supabase_url && s.write_token);
      return '<tr>' +
        '<td><strong>' + esc(s.name) + '</strong><div class="muted" style="font-size:.7rem">/' + esc(s.path_slug) + '/</div></td>' +
        '<td>' + (hasConn
          ? '<span class="badge badge-green"><i class="fa-solid fa-wifi" style="margin-left:4px"></i> متصل</span>'
          : '<span class="badge badge-red"><i class="fa-solid fa-wifi-slash" style="margin-left:4px"></i> بدون Supabase</span>') + '</td>' +
        '<td>' +
        (hasConn
          ? '<button class="btn btn-notif btn-sm" onclick="openNotifModal(\'' + esc(s.store_id) + '\')"><i class="fa-solid fa-paper-plane"></i> إرسال إشعار</button>'
          : '<span class="muted" style="font-size:.75rem">—</span>') +
        '</td>' +
        '</tr>';
    }).join('');

    mc.innerHTML =
      '<div class="page-top"><div><h1><i class="fa-solid fa-bell" style="color:var(--accent);margin-left:8px"></i>مركز الإشعارات</h1>' +
      '<div class="crumb">إرسال إشعارات لمتجر واحد أو لكل المتاجر دفعةً واحدة</div></div></div>' +

      // ---- BROADCAST CARD ----
      '<div class="card" style="border:2px solid #bfdbfe;background:linear-gradient(135deg,#eff6ff 0%,#fff 80%)">' +
        '<div style="display:flex;align-items:center;gap:12px;margin-bottom:18px">' +
          '<div style="width:44px;height:44px;border-radius:12px;background:#2563eb;display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
            '<i class="fa-solid fa-broadcast-tower" style="color:#fff;font-size:1.1rem"></i>' +
          '</div>' +
          '<div>' +
            '<div style="font-weight:800;font-size:1rem;color:#1e3a8a">إشعار جماعي لكل المتاجر</div>' +
            '<div style="font-size:.78rem;color:#3b82f6">' + stores.filter(function(s){ return s.supabase_url && s.write_token; }).length + ' متجر سيستقبل الإشعار</div>' +
          '</div>' +
        '</div>' +

        '<div style="display:grid;gap:14px">' +
          '<div class="row" style="gap:12px">' +
            '<div class="field" style="flex:1;margin:0">' +
              '<label>نوع الإشعار</label>' +
              '<select id="bType">' +
                '<option value="general">📢 عام</option>' +
                '<option value="payment">⚠️ مالي</option>' +
                '<option value="post">📰 مقال</option>' +
                '<option value="update">🔄 تحديث</option>' +
                '<option value="offer">🏷️ عرض</option>' +
                '<option value="marketing">📣 تسويق</option>' +
                '<option value="welcome">👋 ترحيب</option>' +
                '<option value="warning">🚨 تحذير</option>' +
              '</select>' +
            '</div>' +
            '<div class="field" style="flex:2;margin:0">' +
              '<label>عنوان الإشعار *</label>' +
              '<input id="bTitle" placeholder="مثال: تحديث هام لجميع المتاجر" oninput="updateBroadcastPreview()">' +
            '</div>' +
          '</div>' +

          '<div class="field" style="margin:0">' +
            '<label>نص الإشعار *</label>' +
            '<textarea id="bMessage" rows="3" placeholder="اكتب نص الإشعار هنا..." oninput="updateBroadcastPreview()" style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;font-family:inherit;font-size:.85rem;resize:vertical;outline:none;background:var(--bg);transition:border .2s" onfocus="this.style.borderColor=\'var(--accent)\'" onblur="this.style.borderColor=\'var(--border)\'"></textarea>' +
          '</div>' +

          '<div class="row" style="gap:12px">' +
            '<div class="field" style="flex:1;margin:0">' +
              '<label style="font-size:.75rem">رابط صورة (اختياري)</label>' +
              '<input id="bImage" placeholder="https://..." dir="ltr" style="text-align:left;font-size:.78rem">' +
            '</div>' +
            '<div class="field" style="flex:1;margin:0">' +
              '<label style="font-size:.75rem">رابط إضافي (اختياري)</label>' +
              '<input id="bLink" placeholder="https://..." dir="ltr" style="text-align:left;font-size:.78rem">' +
            '</div>' +
          '</div>' +
        '</div>' +

        // Live preview
        '<div id="bPreviewBox" style="display:none;background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:10px;padding:12px 14px;margin:14px 0 0;display:flex;gap:10px;align-items:flex-start">' +
          '<i id="bPreviewIcon" class="fa-solid fa-bullhorn" style="color:#2563eb;margin-top:2px;flex-shrink:0"></i>' +
          '<div style="flex:1"><div id="bPreviewTitle" style="font-weight:800;font-size:.8rem;color:#1e3a8a">العنوان يظهر هنا</div>' +
          '<div id="bPreviewMsg" style="font-size:.7rem;color:#1d4ed8;margin-top:2px">نص الإشعار...</div></div>' +
        '</div>' +

        // Progress
        '<div id="broadcastProgress" style="display:none;margin-top:14px">' +
          '<div style="font-size:.78rem;font-weight:800;margin-bottom:6px;color:var(--text)"><i class="fa-solid fa-satellite-dish" style="color:#2563eb"></i> حالة الإرسال:</div>' +
          '<div id="broadcastProgressList" style="max-height:200px;overflow-y:auto;border:1px solid var(--border);border-radius:10px;padding:6px"></div>' +
          '<div id="broadcastSummary" style="display:none;margin-top:8px;text-align:center;font-size:.82rem"></div>' +
        '</div>' +

        '<div class="row" style="justify-content:flex-end;margin-top:16px">' +
          '<button class="btn btn-primary" id="sendBroadcastBtn" onclick="broadcastNotifToAll()">' +
            '<i class="fa-solid fa-broadcast-tower"></i> إرسال لكل المتاجر' +
          '</button>' +
        '</div>' +
      '</div>' +

      // ---- PER-STORE TABLE ----
      '<div class="card" style="padding:8px">' +
        '<div style="padding:14px 14px 10px;display:flex;align-items:center;justify-content:space-between">' +
          '<div style="font-weight:800;font-size:.95rem"><i class="fa-solid fa-store" style="color:var(--accent);margin-left:6px"></i> إرسال إشعار لمتجر محدد</div>' +
        '</div>' +
        '<div class="table-wrap"><table><thead><tr>' +
          '<th>المتجر</th><th>الاتصال</th><th>إرسال</th>' +
        '</tr></thead><tbody>' + (storeRows || '<tr><td colspan="3"><div class="empty">لا توجد متاجر.</div></td></tr>') + '</tbody></table></div>' +
      '</div>';

    // Attach type change listener for broadcast preview
    var bType = document.getElementById('bType');
    if (bType) bType.addEventListener('change', updateBroadcastPreview);
  }

  function updateBroadcastPreview() {
    var typeColors = {
      general:   { bg:'#eff6ff', bd:'#bfdbfe', ic:'#2563eb', txt:'#1e3a8a', sub:'#1d4ed8', icon:'fa-bullhorn' },
      payment:   { bg:'#fef2f2', bd:'#fecaca', ic:'#dc2626', txt:'#991b1b', sub:'#b91c1c', icon:'fa-triangle-exclamation' },
      post:      { bg:'#ecfdf5', bd:'#a7f3d0', ic:'#7c3aed', txt:'#065f46', sub:'#047857', icon:'fa-newspaper' },
      update:    { bg:'#e0f2fe', bd:'#bae6fd', ic:'#0891b2', txt:'#075985', sub:'#0369a1', icon:'fa-rotate' },
      offer:     { bg:'#fdf2f8', bd:'#fbcfe8', ic:'#db2777', txt:'#831843', sub:'#9d174d', icon:'fa-tag' },
      marketing: { bg:'#fff7ed', bd:'#ffedd5', ic:'#ea580c', txt:'#7c2d12', sub:'#9a3412', icon:'fa-bullhorn' },
      welcome:   { bg:'#ecfdf5', bd:'#a7f3d0', ic:'#059669', txt:'#065f46', sub:'#047857', icon:'fa-hand-wave' },
      warning:   { bg:'#fef2f2', bd:'#fecaca', ic:'#dc2626', txt:'#991b1b', sub:'#b91c1c', icon:'fa-triangle-exclamation' }
    };
    var sel = document.getElementById('bType');
    var t = typeColors[(sel && sel.value) || 'general'] || typeColors.general;
    var titleEl = document.getElementById('bPreviewTitle');
    var msgEl = document.getElementById('bPreviewMsg');
    var iconEl = document.getElementById('bPreviewIcon');
    var boxEl = document.getElementById('bPreviewBox');
    var titleVal = (document.getElementById('bTitle') || {}).value || '';
    var msgVal = (document.getElementById('bMessage') || {}).value || '';
    if (boxEl) {
      boxEl.style.display = 'flex';
      boxEl.style.background = t.bg;
      boxEl.style.borderColor = t.bd;
    }
    if (iconEl) { iconEl.className = 'fa-solid ' + t.icon; iconEl.style.color = t.ic; }
    if (titleEl) { titleEl.textContent = titleVal || 'العنوان يظهر هنا'; titleEl.style.color = t.txt; }
    if (msgEl) { msgEl.textContent = msgVal || 'نص الإشعار...'; msgEl.style.color = t.sub; }
  }

  function latestSub(storeId) {
    const subs = subscriptions.filter(function (s) { return s.store_id === storeId; });
    return subs.length ? subs[0] : null;
  }

  function statusBadge(status) {
    const map = {
      active: '<span class="badge badge-green"><i class="fa-solid fa-circle-check" style="margin-left:5px"></i> نشط</span>',
      pending: '<span class="badge badge-amber"><i class="fa-solid fa-clock" style="margin-left:5px"></i> قيد الإعداد</span>',
      suspended: '<span class="badge badge-red"><i class="fa-solid fa-circle-minus" style="margin-left:5px"></i> موقوف</span>',
      ended: '<span class="badge badge-blue"><i class="fa-solid fa-circle-xmark" style="margin-left:5px"></i> منتهي</span>',
      cancelled: '<span class="badge badge-amber"><i class="fa-solid fa-ban" style="margin-left:5px"></i> ملغي</span>',
      trial: '<span class="badge badge-blue"><i class="fa-solid fa-hourglass-half" style="margin-left:5px"></i> تجريبي</span>'
    };
    return map[status] || '<span class="badge badge-blue">' + esc(status) + '</span>';
  }

  const PLAN_AR = { free: 'مجانية', monthly: 'شهرية', annual: 'سنوية VIP', vip: 'VIP' };

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
  function onCodeTypeChange() {
    var type = $('cType').value;
    if (type === 'subscription') {
      $('cPlanField').style.display = 'block';
      $('cAmountField').style.display = 'none';
    } else {
      $('cPlanField').style.display = 'none';
      $('cAmountField').style.display = 'block';
    }
    onStoreSelectChange(); // refresh balance hint visibility
  }

  function onStoreSelectChange() {
    var storeId = $('cStore').value;
    var type = $('cType').value;
    var hint = $('cStoreBalanceHint');
    var fillBtn = $('fillFromBalanceBtn');

    if (!hint || !fillBtn) return;

    // Only show balance hint for fee/credit codes when a store is selected
    if (storeId && type !== 'subscription') {
      var store = stores.find(function(s) { return s.store_id === storeId; });
      if (store) {
        // Try to get balance from store's Supabase if available, else show placeholder
        hint.style.display = 'block';
        fillBtn.style.display = 'inline-flex';
        // Fetch balance from store's Supabase
        fetchStoreBalance(store).then(function(bal) {
          hint.textContent = '💰 رصيد المتجر الحالي: ' + bal + ' ₪';
          fillBtn.dataset.balance = bal;
        }).catch(function() {
          hint.textContent = 'تعذر جلب رصيد المتجر';
          fillBtn.style.display = 'none';
        });
      }
    } else {
      hint.style.display = 'none';
      fillBtn.style.display = 'none';
    }
  }

  async function fetchStoreBalance(store) {
    if (!store || !store.supabase_url || !store.anon_key) throw new Error('no config');
    var url = store.supabase_url.replace(/\/+$/, '');
    var key = store.anon_key;
    var resp = await fetch(url + '/rest/v1/rpc/get_setting', {
      method: 'POST',
      headers: { 'apikey': key, 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_key: 'mycart_store_balance' })
    });
    if (!resp.ok) throw new Error('fetch failed');
    var data = await resp.json();
    return parseFloat(data) || 0;
  }

  function fillAmountFromBalance() {
    var btn = $('fillFromBalanceBtn');
    var bal = parseFloat(btn && btn.dataset.balance) || 0;
    if (bal > 0) {
      $('cAmount').value = bal;
      toast('تم تعبئة المبلغ من رصيد المتجر: ' + bal + ' ₪', false);
    } else {
      toast('رصيد المتجر صفر أو غير متاح', true);
    }
  }

  function openCodeModal() {
    $('cCode').value = '';
    $('cType').value = 'subscription';
    $('cPlan').value = 'monthly';
    $('cAmount').value = '';
    $('cStore').value = '';
    onCodeTypeChange();
    $('codeModal').classList.add('show');
  }
  function openCodeModalForStore(storeId) {
    openCodeModal();
    var select = $('cStore');
    if (select) {
      select.value = storeId;
      onStoreSelectChange();
    }
  }
  function closeCodeModal() { $('codeModal').classList.remove('show'); }

  async function refreshCodesNow() {
    try {
      var btn = document.querySelector('[onclick="refreshCodesNow()"]');
      if (btn) { btn.classList.add('fa-spin'); }
      codes = await db.listCodes();
      renderCodesPage();
      var t = new Date().toLocaleTimeString('ar-SA', {hour:'2-digit', minute:'2-digit'});
      $('syncStatus').textContent = '🔄 تم التحديث ' + t;
      setTimeout(function(){ $('syncStatus').textContent = 'متصل بـ Supabase'; }, 3000);
    } catch(e) {
      toast('فشل التحديث: ' + e.message, true);
    }
  }

  function genCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return 'F7-' + new Date().getFullYear() + '-' + s;
  }

  function generateSubCode() {
    $('cCode').value = genCode();
    toast('تم توليد كود عشوائي آمن', false);
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
        amount: ($('cType').value === 'fee' || $('cType').value === 'credit') ? amount : 0
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

  // ---------- send notification to store ----------
  var _notifTargetStore = null;

  function openNotifModal(storeId) {
    _notifTargetStore = storeId;
    var s = stores.find(function(x){ return x.store_id === storeId; });
    var title = document.getElementById('notifModalTitle');
    if (title) title.textContent = 'إرسال إشعار إلى: ' + (s ? s.name : storeId);
    var form = document.getElementById('notifModal');
    if (!form) return;
    // Reset fields
    document.getElementById('nType').value = 'general';
    document.getElementById('nTitle').value = '';
    document.getElementById('nMessage').value = '';
    document.getElementById('nImage').value = '';
    document.getElementById('nLink').value = '';
    // Hide templates bar on open
    var bar = document.getElementById('notifTemplatesBar');
    if (bar) bar.style.display = 'none';
    form.classList.add('show');
  }

  // Store fees cache to avoid re-fetching on type change
  var _notifFeesCache = null;

  function onNotifTypeChange() {
    var type = document.getElementById('nType').value;
    var bar = document.getElementById('notifTemplatesBar');
    var btns = document.getElementById('notifTemplatesBtns');
    if (!bar || !btns) return;

    var s = stores.find(function(x){ return x.store_id === _notifTargetStore; });
    var storeName = s ? s.name : 'متجرك';

    var templates = [];

    if (type === 'payment') {
      // Fetch fees if not cached
      var feeAmt = _notifFeesCache ? _notifFeesCache.accrued : null;
      var feeTxt = feeAmt !== null ? feeAmt + ' ₪' : '...';
      templates = [
        { label: '⚠️ تذكير بالمستحقات', title: 'تذكير: رسوم مستحقة بذمتك', msg: 'مرحباً ' + storeName + '، لديك رسوم مستحقة بقيمة ' + feeTxt + '. يرجى التسوية في أقرب وقت لتجنب إيقاف الخدمة.' },
        { label: '🚨 آخر تذكير', title: 'آخر تذكير قبل إيقاف المتجر!', msg: 'متجرك ' + storeName + ' سيُوقف تلقائياً بسبب رسوم مستحقة (' + feeTxt + '). يرجى التسوية فوراً للاستمرار.' },
        { label: '✅ تأكيد الاستلام', title: 'تم استلام دفعتك ✅', msg: 'شكراً ' + storeName + '! تم استلام دفعتك وتم تصفير الرسوم المستحقة. متجرك يعمل بشكل طبيعي.' }
      ];
      // If fees loaded, update the amount in templates
      if (s && s.supabase_url && s.anon_key && _notifFeesCache === null) {
        fetchStoreFees(s).then(function(data) {
          _notifFeesCache = data;
          onNotifTypeChange(); // re-render with real amount
        }).catch(function(){});
      }
    } else if (type === 'general') {
      templates = [
        { label: '👋 ترحيب', title: 'مرحباً بك في Fast7!', msg: 'أهلاً ' + storeName + '! يسعدنا انضمامك. فريقنا جاهز لمساعدتك في أي وقت.' },
        { label: '📞 تواصل معنا', title: 'هل تحتاج مساعدة؟', msg: 'نحن هنا لمساعدتك! تواصل معنا في أي وقت وسيرد عليك فريق الدعم.' }
      ];
    } else if (type === 'update') {
      templates = [
        { label: '🔄 تحديث متاح', title: 'تحديث جديد لمتجرك 🚀', msg: 'تم إطلاق تحديث جديد يحتوي على ميزات وتحسينات. تحقق من لوحة تحكمك!' },
        { label: '⚙️ صيانة مجدولة', title: 'صيانة مجدولة قادمة', msg: 'سيكون هناك توقف مؤقت للصيانة. اعتذر عن أي إزعاج وسنعود قريباً.' }
      ];
    } else if (type === 'offer') {
      templates = [
        { label: '🏷️ عرض ترقية', title: 'عرض خاص لك!', msg: 'بمناسبة ولائك، نقدم لك خصماً حصرياً على الخطة السنوية VIP. تواصل معنا اليوم!' }
      ];
    } else if (type === 'warning') {
      templates = [
        { label: '🚨 تحذير عام', title: 'تنبيه هام', msg: 'يرجى مراجعة إعدادات متجرك والتأكد من صحة البيانات.' }
      ];
    }

    if (templates.length > 0) {
      bar.style.display = 'block';
      btns.innerHTML = templates.map(function(t, i) {
        return '<button type="button" onclick="applyNotifTemplate(' + i + ')" style="padding:5px 10px;border:1.5px solid var(--border);border-radius:8px;background:#fff;color:var(--text);font-size:.72rem;font-weight:700;cursor:pointer;font-family:inherit;transition:all .15s;white-space:nowrap" onmouseover="this.style.background=\'#eff6ff\';this.style.borderColor=\'#2563eb\'" onmouseout="this.style.background=\'#fff\';this.style.borderColor=\'var(--border)\'">' + t.label + '</button>';
      }).join('');
      // Store templates for use by applyNotifTemplate
      btns._templates = templates;
    } else {
      bar.style.display = 'none';
    }
  }

  function applyNotifTemplate(idx) {
    var btns = document.getElementById('notifTemplatesBtns');
    if (!btns || !btns._templates) return;
    var t = btns._templates[idx];
    if (!t) return;
    document.getElementById('nTitle').value = t.title;
    document.getElementById('nMessage').value = t.msg;
    // Update preview if available
    var pt = document.getElementById('previewTitle');
    var pm = document.getElementById('previewMsg');
    if (pt) pt.textContent = t.title;
    if (pm) pm.textContent = t.msg;
  }

  function closeNotifModal() {
    var form = document.getElementById('notifModal');
    if (form) form.classList.remove('show');
    _notifTargetStore = null;
  }

  async function sendNotifToStore() {
    var storeId = _notifTargetStore;
    if (!storeId) return;
    var s = stores.find(function(x){ return x.store_id === storeId; });
    if (!s || !s.supabase_url || !s.write_token) {
      toast('المتجر لا يملك بيانات Supabase كافية', true);
      return;
    }
    var nTitle = document.getElementById('nTitle').value.trim();
    var nMessage = document.getElementById('nMessage').value.trim();
    if (!nTitle || !nMessage) {
      toast('يرجى ملء العنوان والنص على الأقل', true);
      return;
    }
    var notif = {
      id: 'sa_' + Date.now(),
      type: document.getElementById('nType').value || 'general',
      title: nTitle,
      message: nMessage,
      image: document.getElementById('nImage').value.trim() || undefined,
      link: document.getElementById('nLink').value.trim() || undefined,
      sent_at: new Date().toISOString()
    };
    // Remove undefined fields for clean JSON
    Object.keys(notif).forEach(function(k){ if (notif[k] === undefined) delete notif[k]; });

    var btn = document.getElementById('sendNotifBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'جارٍ الإرسال...'; }

    try {
      // Fetch existing notifications from the store's Supabase
      var baseUrl = s.supabase_url.replace(/\/$/, '');
      var anonKey = s.anon_key || '';
      var writeToken = s.write_token;
      var storeKey = s.path_slug || storeId;

      // Read current notifications list
      var readResp = await fetch(
        baseUrl + '/rest/v1/store_data?store_id=eq.' + encodeURIComponent(storeKey) + '&key=eq.mycart_store_notifications&select=value',
        { headers: { 'apikey': anonKey, 'Authorization': 'Bearer ' + anonKey } }
      );
      var existing = [];
      if (readResp.ok) {
        var rows = await readResp.json();
        if (rows && rows[0] && Array.isArray(rows[0].value)) existing = rows[0].value;
      }

      // Prepend new notification (newest first)
      var updated = [notif].concat(existing).slice(0, 20);

      // Write via save_store_data RPC
      var writeResp = await fetch(baseUrl + '/rest/v1/rpc/save_store_data', {
        method: 'POST',
        headers: {
          'apikey': anonKey,
          'Authorization': 'Bearer ' + anonKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          p_store: storeKey,
          p_key: 'mycart_store_notifications',
          p_value: updated,
          p_token: writeToken
        })
      });

      if (!writeResp.ok) {
        var errText = await writeResp.text();
        throw new Error(errText || ('HTTP ' + writeResp.status));
      }

      closeNotifModal();
      toast('✅ تم إرسال الإشعار إلى المتجر بنجاح!');
    } catch (e) {
      toast('فشل الإرسال: ' + e.message, true);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'إرسال'; }
    }
  }

  // ---------- broadcast notification to all stores ----------
  function openBroadcastModal() {
    var el = document.getElementById('broadcastModal');
    if (!el) return;
    document.getElementById('bType').value = 'general';
    document.getElementById('bTitle').value = '';
    document.getElementById('bMessage').value = '';
    document.getElementById('bImage').value = '';
    document.getElementById('bLink').value = '';
    var eligible = stores.filter(function(s){ return s.supabase_url && s.write_token; }).length;
    var info = document.getElementById('bEligibleInfo');
    if (info) info.textContent = eligible + ' متجر لديه بيانات Supabase وسيستقبل الإشعار';
    document.getElementById('broadcastProgress').style.display = 'none';
    el.classList.add('show');
  }

  function closeBroadcastModal() {
    var el = document.getElementById('broadcastModal');
    if (el) el.classList.remove('show');
  }

  async function broadcastNotifToAll() {
    var bTitle = document.getElementById('bTitle').value.trim();
    var bMessage = document.getElementById('bMessage').value.trim();
    if (!bTitle || !bMessage) {
      toast('يرجى ملء العنوان والنص', true);
      return;
    }

    var eligible = stores.filter(function(s){ return s.supabase_url && s.write_token; });
    if (!eligible.length) {
      toast('لا يوجد متاجر لديها بيانات Supabase', true);
      return;
    }

    var btn = document.getElementById('sendBroadcastBtn');
    var progress = document.getElementById('broadcastProgress');
    var progressList = document.getElementById('broadcastProgressList');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جارٍ الإرسال...'; }
    if (progress) { progress.style.display = 'block'; }
    if (progressList) progressList.innerHTML = '';

    var notifBase = {
      type: document.getElementById('bType').value || 'general',
      title: bTitle,
      message: bMessage,
      image: document.getElementById('bImage').value.trim() || undefined,
      link: document.getElementById('bLink').value.trim() || undefined,
      sent_at: new Date().toISOString()
    };

    var ok = 0, fail = 0;

    for (var i = 0; i < eligible.length; i++) {
      var s = eligible[i];
      var notif = Object.assign({}, notifBase, { id: 'sa_' + Date.now() + '_' + i });
      Object.keys(notif).forEach(function(k){ if (notif[k] === undefined) delete notif[k]; });

      var li = document.createElement('div');
      li.style.cssText = 'padding:6px 10px;border-radius:8px;margin-bottom:4px;font-size:.78rem;display:flex;align-items:center;gap:8px;background:#f8fafc;border:1px solid #e2e8f0';
      li.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="color:#94a3b8;width:14px"></i> <span>' + esc(s.name) + '</span>';
      if (progressList) progressList.appendChild(li);

      try {
        var baseUrl = s.supabase_url.replace(/\/$/, '');
        var anonKey = s.anon_key || '';
        var writeToken = s.write_token;
        var storeKey = s.path_slug || s.store_id;

        var readResp = await fetch(
          baseUrl + '/rest/v1/store_data?store_id=eq.' + encodeURIComponent(storeKey) + '&key=eq.mycart_store_notifications&select=value',
          { headers: { 'apikey': anonKey, 'Authorization': 'Bearer ' + anonKey } }
        );
        var existing = [];
        if (readResp.ok) {
          var rows = await readResp.json();
          if (rows && rows[0] && Array.isArray(rows[0].value)) existing = rows[0].value;
        }

        var updated = [notif].concat(existing).slice(0, 20);

        var writeResp = await fetch(baseUrl + '/rest/v1/rpc/save_store_data', {
          method: 'POST',
          headers: {
            'apikey': anonKey,
            'Authorization': 'Bearer ' + anonKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            p_store: storeKey,
            p_key: 'mycart_store_notifications',
            p_value: updated,
            p_token: writeToken
          })
        });

        if (!writeResp.ok) throw new Error('HTTP ' + writeResp.status);
        ok++;
        li.style.background = '#f0fdf4'; li.style.borderColor = '#bbf7d0';
        li.innerHTML = '<i class="fa-solid fa-circle-check" style="color:#16a34a;width:14px"></i> <span style="color:#166534">' + esc(s.name) + '</span>';
      } catch(e) {
        fail++;
        li.style.background = '#fef2f2'; li.style.borderColor = '#fecaca';
        li.innerHTML = '<i class="fa-solid fa-circle-xmark" style="color:#dc2626;width:14px"></i> <span style="color:#991b1b">' + esc(s.name) + ' — ' + e.message + '</span>';
      }
    }

    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-broadcast-tower"></i> إرسال للكل'; }
    var summary = document.getElementById('broadcastSummary');
    if (summary) {
      summary.style.display = 'block';
      summary.innerHTML = (ok > 0 ? '<span style="color:#16a34a;font-weight:800">✅ ' + ok + ' متجر تم بنجاح</span>' : '') +
        (fail > 0 ? ' <span style="color:#dc2626;font-weight:800">❌ ' + fail + ' فشل</span>' : '');
    }
    if (fail === 0) toast('✅ تم إرسال الإشعار لكل المتاجر (' + ok + ') بنجاح!');
    else toast('اكتمل الإرسال: ' + ok + ' نجح، ' + fail + ' فشل', true);
  }

  // ---------- boot ----------
  async function boot() {
    $('loginPass').addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(); });
    global.addEventListener('hashchange', renderRoute);
    // Restore an existing session if a stored token was set by previous login,
    // but only if that token is still valid (not expired).
    if (isLoggedIn() && auth && auth.hasToken()) {
      try {
        await loadAll();
        $('loginScreen').style.display = 'none';
        $('app').style.display = 'block';
        initPanel();
      } catch (e) {
        // Token expired or rejected -> force a fresh login.
        localStorage.setItem(LOGIN_KEY, 'false');
        if (auth) auth.signOut();
        $('loginScreen').style.display = 'grid';
        $('app').style.display = 'none';
      }
      return;
    }
    if (isLoggedIn()) { localStorage.setItem(LOGIN_KEY, 'false'); }
  }

  global.doLogin = doLogin;
  global.logout = logout;
  global.navTo = navTo;
  global.openStoreModal = openStoreModal;
  global.closeStoreModal = closeStoreModal;
  global.editStore = editStore;
  global.saveStore = saveStore;
  global.toggleStoreStatus = toggleStoreStatus;
  global.removeStore = removeStore;
  global.copyAdminCode = copyAdminCode;
  global.generateAdminCode = generateAdminCode;
  global.openCodeModal = openCodeModal;
  global.openCodeModalForStore = openCodeModalForStore;
  global.closeCodeModal = closeCodeModal;
  global.refreshCodesNow = refreshCodesNow;
  global.onCodeTypeChange = onCodeTypeChange;
  global.generateSubCode = generateSubCode;
  global.openNotifModal = openNotifModal;
  global.closeNotifModal = closeNotifModal;
  global.sendNotifToStore = sendNotifToStore;
  global.onNotifTypeChange = onNotifTypeChange;
  global.applyNotifTemplate = applyNotifTemplate;
  global.openBroadcastModal = openBroadcastModal;
  global.closeBroadcastModal = closeBroadcastModal;
  global.broadcastNotifToAll = broadcastNotifToAll;
  global.updateBroadcastPreview = updateBroadcastPreview;
  global.saveCode = saveCode;
  global.removeCode = removeCode;
  global.onStoreSelectChange = onStoreSelectChange;
  global.fillAmountFromBalance = fillAmountFromBalance;

  global.addEventListener('DOMContentLoaded', boot);
})(window);