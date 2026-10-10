// Bronchoscopy Program shell: หน้า login / เปลี่ยนรหัสผ่านครั้งแรก / แถบเมนูตามสิทธิ์ (ใช้ร่วมทุกหน้า)
// ใช้: const user = await Broncho.programStart({ page: 'dashboard' });
(() => {
  const B = window.Broncho, esc = B.esc;

  const NAV = [
    { key: 'dashboard', label: '📊 Dashboard',        href: 'dashboard.html',                         roles: ['admin', 'doctor', 'user'] },
    { key: 'book',      label: '📅 จองคิว',            href: 'index.html?mode=program&page=book',      roles: ['admin', 'doctor'] },
    { key: 'my',        label: '🗂 การจองของฉัน',      href: 'index.html?mode=program&page=my',        roles: ['admin', 'doctor'] },
    { key: 'record',    label: '📋 บันทึกส่องกล้อง',   href: 'record.html',                            roles: ['admin', 'user'] },
    { key: 'users',     label: '👥 จัดการผู้ใช้',      href: 'users.html',                             roles: ['admin'] },
  ];
  const ROLE_LABEL = { admin: 'Admin', doctor: 'แพทย์ (Doctor)', user: 'พยาบาล/ผู้ใช้ (User)' };
  const PAGE_LABEL = { 'dashboard.html': 'Dashboard', 'record.html': 'บันทึกส่องกล้อง', 'users.html': 'จัดการผู้ใช้' };

  const IDLE_MS = 15 * 60 * 1000;      // ไม่มีการใช้งานครบเวลานี้ → ออกจากระบบ
  const WARN_MS = 60 * 1000;           // เตือนก่อนออกจากระบบ
  const ACT_KEY = 'bp_act', IDLE_FLAG = 'bp_idle_out';

  const CSS = `
  .bp-nav{background:#052f43;color:#fff;position:sticky;top:0;z-index:200;font-family:'Sarabun',-apple-system,'Segoe UI',sans-serif}
  .bp-nav-in{max-width:1280px;margin:0 auto;padding:0 14px;display:flex;align-items:center;gap:6px;min-height:46px}
  .bp-brand{font-weight:700;font-size:15px;white-space:nowrap;margin-right:8px;display:flex;align-items:center;gap:6px}
  .bp-tabs{display:flex;gap:2px;overflow-x:auto;flex:1;scrollbar-width:none}
  .bp-tabs::-webkit-scrollbar{display:none}
  .bp-tab{color:#cfe6f0;text-decoration:none;font-size:13.5px;padding:13px 12px;white-space:nowrap;border-bottom:3px solid transparent}
  .bp-tab:hover{color:#fff;background:rgba(255,255,255,.06)}
  .bp-tab.on{color:#fff;border-bottom-color:#35c3e8;font-weight:700}
  .bp-user{position:relative;margin-left:auto}
  .bp-ubtn{background:rgba(255,255,255,.12);color:#fff;border:0;border-radius:999px;padding:6px 12px;font:inherit;font-size:13px;cursor:pointer;white-space:nowrap;max-width:200px;overflow:hidden;text-overflow:ellipsis}
  .bp-menu{position:absolute;right:0;top:calc(100% + 6px);background:#fff;color:#152238;border-radius:12px;box-shadow:0 8px 28px rgba(0,0,0,.25);min-width:210px;padding:6px;display:none}
  .bp-menu.open{display:block}
  .bp-menu .who{padding:8px 10px;font-size:12.5px;color:#51627a;border-bottom:1px solid #eef2f8;margin-bottom:4px;line-height:1.5}
  .bp-menu button{display:block;width:100%;text-align:left;background:none;border:0;padding:9px 10px;border-radius:8px;font:inherit;font-size:14px;cursor:pointer;color:#152238}
  .bp-menu button:hover{background:#f0f4f8}
  .bp-tabs{min-width:0}
  @media(max-width:720px){
    .bp-nav-in{flex-wrap:wrap;padding:0 10px;row-gap:0;min-height:0}
    .bp-brand{order:1;font-size:14px;padding:10px 0;margin-right:0}
    .bp-user{order:2;margin-left:auto}
    .bp-tabs{order:3;flex:1 0 100%;border-top:1px solid rgba(255,255,255,.14);margin:0 -10px;padding:0 6px}
    .bp-tab{flex:1 0 auto;text-align:center;padding:11px 10px;font-size:13.5px}
    .bp-ubtn{max-width:150px;padding:6px 10px}
  }
  .bp-ov{position:fixed;inset:0;z-index:10000;background:linear-gradient(135deg,#063e57,#0b7fa8 65%,#19a6c9);display:flex;align-items:center;justify-content:center;padding:16px;font-family:'Sarabun',-apple-system,'Segoe UI',sans-serif;overflow:auto}
  .bp-ov.light{background:rgba(15,25,45,.6)}
  .bp-card{background:#fff;color:#152238;border-radius:18px;width:100%;max-width:380px;padding:26px 24px;box-shadow:0 20px 60px rgba(0,0,0,.35)}
  .bp-logo{width:54px;height:54px;border-radius:16px;background:#e3f4fa;display:grid;place-items:center;font-size:28px;margin:0 auto 10px}
  .bp-card h1{font-size:20px;text-align:center;font-weight:700}
  .bp-card .sub{font-size:13px;color:#51627a;text-align:center;margin:4px 0 16px;line-height:1.5}
  .bp-card label{display:block;font-size:13px;font-weight:600;color:#334;margin:12px 0 5px}
  .bp-card input{width:100%;border:1.5px solid #d1dbe8;border-radius:10px;padding:11px 12px;font:inherit;font-size:15px;outline:none;background:#fff;color:#152238}
  .bp-card input:focus{border-color:#0b7fa8;box-shadow:0 0 0 3px #e3f4fa}
  .bp-pw{position:relative}.bp-pw input{padding-right:44px}
  .bp-eye{position:absolute;right:4px;top:50%;transform:translateY(-50%);background:none;border:0;font-size:18px;padding:6px 8px;cursor:pointer}
  .bp-err{color:#d6343f;font-size:13px;min-height:18px;margin-top:10px;line-height:1.5}
  .bp-go{width:100%;margin-top:6px;background:#0b7fa8;color:#fff;border:0;border-radius:11px;padding:13px;font:inherit;font-size:15.5px;font-weight:700;cursor:pointer}
  .bp-go:disabled{opacity:.5;cursor:not-allowed}
  .bp-alt{width:100%;margin-top:8px;background:#eef2f8;color:#334;border:0;border-radius:11px;padding:11px;font:inherit;font-size:14px;cursor:pointer}
  .bp-rules{list-style:none;margin:10px 0 0;padding:0;font-size:12.5px;color:#7c8fa6}
  .bp-rules li{padding:2px 0}.bp-rules li.ok{color:#12945f}
  .bp-rules li::before{content:'○ '}.bp-rules li.ok::before{content:'✔ '}
  .bp-note{background:#fff7e0;border:1px solid #f3d38a;color:#7a5200;border-radius:10px;padding:9px 11px;font-size:12.5px;line-height:1.6;margin-bottom:6px}
  .bp-back{background:rgba(255,255,255,.12);color:#fff;border:0;border-radius:999px;padding:6px 12px;font:inherit;font-size:13px;cursor:pointer;white-space:nowrap;flex-shrink:0;margin-right:4px}
  .bp-back:hover{background:rgba(255,255,255,.24)}
  .bp-bt{overflow:hidden;text-overflow:ellipsis}
  .bp-count{font-size:36px;font-weight:700;text-align:center;color:#0b7fa8;margin:8px 0 0;line-height:1.2}
  @media(max-width:720px){.bp-back{order:0;padding:6px 10px}.bp-brand{min-width:0}}
  @media(max-width:480px){.bp-nav.has-back .bp-bt{display:none}}
  `;

  function injectCss() {
    if (document.getElementById('bp-css')) return;
    const st = document.createElement('style'); st.id = 'bp-css'; st.textContent = CSS; document.head.appendChild(st);
  }
  const $ = id => document.getElementById(id);

  function overlay(html, light) {
    const ov = document.createElement('div');
    ov.className = 'bp-ov' + (light ? ' light' : '');
    ov.innerHTML = html;
    document.body.appendChild(ov);
    return ov;
  }

  // ── Login ─────────────────────────────────────────────────
  function loginFlow() {
    return new Promise(resolve => {
      let idleOut = false;
      try { idleOut = sessionStorage.getItem(IDLE_FLAG) === '1'; sessionStorage.removeItem(IDLE_FLAG); } catch (_) {}
      const ov = overlay(`
        <form class="bp-card" id="bp-lf" autocomplete="on">
          <div class="bp-logo">🫁</div>
          <h1>Bronchoscopy Program</h1>
          <div class="sub">ระบบจัดการห้องส่องกล้องหลอดลม<br>เข้าสู่ระบบด้วยชื่อผู้ใช้และรหัสผ่าน</div>
          ${idleOut ? '<div class="bp-note">ออกจากระบบอัตโนมัติ เพราะไม่มีการใช้งานนาน 15 นาที (เพื่อความปลอดภัยของข้อมูลผู้ป่วย) กรุณาเข้าสู่ระบบอีกครั้ง</div>' : ''}
          <label for="bp-u">ชื่อผู้ใช้</label>
          <input id="bp-u" name="username" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" required>
          <label for="bp-p">รหัสผ่าน</label>
          <div class="bp-pw"><input id="bp-p" name="password" type="password" autocomplete="current-password" required>
            <button type="button" class="bp-eye" id="bp-eye" aria-label="แสดง/ซ่อนรหัสผ่าน">👁</button></div>
          <div class="bp-err" id="bp-err" role="alert"></div>
          <button class="bp-go" id="bp-go" type="submit">เข้าสู่ระบบ</button>
        </form>`);
      $('bp-eye').onclick = () => { const i = $('bp-p'); i.type = i.type === 'password' ? 'text' : 'password'; };
      $('bp-u').focus();
      $('bp-lf').onsubmit = async ev => {
        ev.preventDefault();
        const go = $('bp-go'), err = $('bp-err');
        err.textContent = ''; go.disabled = true; go.textContent = 'กำลังตรวจสอบ...';
        const slow = setTimeout(() => { err.style.color = '#7c8fa6'; err.textContent = 'เซิร์ฟเวอร์กำลังเริ่มทำงาน อาจใช้เวลาสักครู่...'; }, 6000);
        try {
          const r = await B.fetchJson({ action: 'login', params: { username: $('bp-u').value, password: $('bp-p').value } }, 45000);
          if (!r || !r.success) throw new Error((r && r.error) || 'SERVER_ERROR');
          B.setSession(r.token, r.expiresAt, r.user);
          clearTimeout(slow);
          ov.remove();
          resolve(B.getSession());
        } catch (e) {
          clearTimeout(slow);
          err.style.color = '#d6343f'; err.textContent = B.errorText(e);
          $('bp-p').value = ''; go.disabled = false; go.textContent = 'เข้าสู่ระบบ';
        }
      };
    });
  }

  // ── เปลี่ยนรหัสผ่าน (บังคับครั้งแรก หรือเลือกเองจากเมนู) ──────────
  function passwordFlow(forced) {
    return new Promise(resolve => {
      const ov = overlay(`
        <form class="bp-card" id="bp-pf" autocomplete="off">
          <div class="bp-logo">🔐</div>
          <h1>เปลี่ยนรหัสผ่าน</h1>
          <div class="sub">${forced ? '<div class="bp-note">การเข้าใช้ครั้งแรก (หรือหลังผู้ดูแลรีเซ็ต) ต้องตั้งรหัสผ่านใหม่ก่อนใช้งาน</div>' : 'ตั้งรหัสผ่านใหม่ของคุณ'}</div>
          <label for="bp-o">รหัสผ่านปัจจุบัน${forced ? ' (รหัสเริ่มต้นที่ได้รับ)' : ''}</label>
          <input id="bp-o" type="password" autocomplete="current-password">
          <label for="bp-n">รหัสผ่านใหม่</label>
          <input id="bp-n" type="password" autocomplete="new-password">
          <label for="bp-c">ยืนยันรหัสผ่านใหม่</label>
          <input id="bp-c" type="password" autocomplete="new-password">
          <ul class="bp-rules" id="bp-rules">
            <li data-r="len">อย่างน้อย 8 ตัวอักษร</li>
            <li data-r="low">มีตัวพิมพ์เล็ก (a-z)</li>
            <li data-r="up">มีตัวพิมพ์ใหญ่ (A-Z)</li>
            <li data-r="dig">มีตัวเลข (0-9)</li>
            <li data-r="same">ยืนยันรหัสผ่านตรงกัน</li>
          </ul>
          <div class="bp-err" id="bp-err" role="alert"></div>
          <button class="bp-go" id="bp-go" type="submit" disabled>บันทึกรหัสผ่านใหม่</button>
          ${forced ? '<button class="bp-alt" type="button" id="bp-out">ออกจากระบบ</button>' : '<button class="bp-alt" type="button" id="bp-cancel">ยกเลิก</button>'}
        </form>`, !forced);
      const chk = () => {
        const n = $('bp-n').value, c = $('bp-c').value;
        const ok = { len: n.length >= 8, low: /[a-z]/.test(n), up: /[A-Z]/.test(n), dig: /[0-9]/.test(n), same: n !== '' && n === c };
        ov.querySelectorAll('#bp-rules li').forEach(li => li.classList.toggle('ok', !!ok[li.dataset.r]));
        $('bp-go').disabled = !($('bp-o').value && Object.values(ok).every(Boolean));
      };
      ['bp-o', 'bp-n', 'bp-c'].forEach(id => $(id).addEventListener('input', chk));
      $('bp-o').focus();
      if (forced) $('bp-out').onclick = () => { B.clearSession(); location.reload(); };
      else $('bp-cancel').onclick = () => { ov.remove(); resolve(null); };
      $('bp-pf').onsubmit = async ev => {
        ev.preventDefault();
        const go = $('bp-go'), err = $('bp-err');
        err.textContent = ''; go.disabled = true; go.textContent = 'กำลังบันทึก...';
        try {
          const r = await B.api('changePassword', { oldPassword: $('bp-o').value, newPassword: $('bp-n').value });
          if (!r.success) throw new Error(r.error || 'SERVER_ERROR');
          B.setSession(r.token, r.expiresAt, r.user);
          ov.remove();
          if (!forced) B.toast('เปลี่ยนรหัสผ่านเรียบร้อย');
          resolve(r.user);
        } catch (e) {
          err.textContent = B.errorText(e); go.textContent = 'บันทึกรหัสผ่านใหม่'; chk();
        }
      };
    });
  }

  // ── ออกจากระบบเมื่อไม่มีการใช้งาน ───────────────────────────
  function startIdleGuard() {
    let last = Date.now(), warnOv = null, lastWrite = 0;
    const readAct = () => { try { return +localStorage.getItem(ACT_KEY) || 0; } catch (_) { return 0; } };
    const stamp = t => { lastWrite = t; try { localStorage.setItem(ACT_KEY, String(t)); } catch (_) {} };
    const bump = () => {
      if (warnOv) return;                                 // ระหว่างเตือน ต้องกด "ใช้งานต่อ" เท่านั้น
      last = Date.now();
      if (last - lastWrite > 5000) stamp(last);
    };
    ['pointerdown', 'keydown', 'scroll', 'touchstart', 'mousemove'].forEach(e =>
      window.addEventListener(e, bump, { passive: true, capture: true }));

    function logoutIdle() {
      try { sessionStorage.setItem(IDLE_FLAG, '1'); } catch (_) {}
      B.clearSession(); location.reload();
    }
    function closeWarn() { if (warnOv) { warnOv.remove(); warnOv = null; } }
    function showWarn() {
      warnOv = overlay(`
        <div class="bp-card" role="alertdialog" aria-modal="true" aria-labelledby="bp-iw-t">
          <div class="bp-logo">⏱</div>
          <h1 id="bp-iw-t">ไม่มีการใช้งานสักครู่</h1>
          <div class="sub">เพื่อความปลอดภัยของข้อมูลผู้ป่วย ระบบจะออกจากระบบอัตโนมัติใน</div>
          <div class="bp-count" id="bp-iw-n" aria-live="polite">60</div>
          <div class="sub" style="margin:0 0 8px">วินาที</div>
          <button class="bp-go" id="bp-iw-go" type="button">ใช้งานต่อ</button>
          <button class="bp-alt" id="bp-iw-out" type="button">ออกจากระบบตอนนี้</button>
        </div>`, true);
      $('bp-iw-go').focus();
      $('bp-iw-go').onclick = () => { closeWarn(); last = Date.now(); stamp(last); };
      $('bp-iw-out').onclick = () => { B.clearSession(); location.reload(); };
    }
    function check() {
      const idle = Date.now() - Math.max(last, readAct());   // นับกิจกรรมจากแท็บอื่นของโปรแกรมนี้ด้วย
      if (idle >= IDLE_MS) return logoutIdle();
      if (idle >= IDLE_MS - WARN_MS) {
        if (!warnOv) showWarn();
        const n = $('bp-iw-n'); if (n) n.textContent = Math.max(0, Math.ceil((IDLE_MS - idle) / 1000));
      } else if (warnOv) closeWarn();                        // แท็บอื่นมีการใช้งาน → ปิดคำเตือน
    }
    setInterval(check, 1000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
    bump();
  }

  // ── ปุ่มย้อนกลับ: กลับหน้าก่อนหน้าในโปรแกรม (ถ้าเปิดมาตรงๆ ให้กลับ Dashboard) ──
  function backTarget(page) {
    try {
      const u = new URL(document.referrer), here = new URL(location.href);
      const dir = p => p.replace(/[^/]*$/, '');
      const key = x => x.pathname + x.search;
      if (u.origin === here.origin && dir(u.pathname) === dir(here.pathname) && key(u) !== key(here)) {
        const file = u.pathname.split('/').pop();
        let label = PAGE_LABEL[file];
        if (file === 'index.html') label = u.searchParams.get('page') === 'my' ? 'การจองของฉัน' : 'จองคิว';
        if (label) {
          if (file === 'dashboard.html') u.hash = '#back';    // ให้ Dashboard เปิดแท็บ/ตัวกรองเดิม
          return { href: u.href, label };
        }
      }
    } catch (_) {}
    return page === 'dashboard' ? null : { href: 'dashboard.html', label: 'Dashboard' };
  }

  // ── แถบเมนู ───────────────────────────────────────────────
  function mountNav(page, user) {
    document.getElementById('bp-nav') && document.getElementById('bp-nav').remove();
    const items = NAV.filter(n => n.roles.includes(user.role));
    const nav = document.createElement('nav');
    const back = backTarget(page);
    nav.className = 'bp-nav' + (back ? ' has-back' : ''); nav.id = 'bp-nav';
    nav.innerHTML = `<div class="bp-nav-in">
      ${back ? `<button class="bp-back" id="bp-back" type="button" title="กลับไปหน้า ${esc(back.label)}">‹ ย้อนกลับ</button>` : ''}
      <div class="bp-brand">🫁 <span class="bp-bt">Bronchoscopy Program</span></div>
      <div class="bp-tabs">${items.map(n => `<a class="bp-tab${n.key === page ? ' on' : ''}" href="${n.href}">${n.label}</a>`).join('')}</div>
      <div class="bp-user">
        <button class="bp-ubtn" id="bp-ubtn" type="button">👤 ${esc(user.name)}</button>
        <div class="bp-menu" id="bp-menu">
          <div class="who"><b>${esc(user.name)}</b><br>${esc(ROLE_LABEL[user.role] || user.role)} · ${esc(user.username)}</div>
          <button type="button" id="bp-chpw">🔐 เปลี่ยนรหัสผ่าน</button>
          <button type="button" id="bp-logout">🚪 ออกจากระบบ</button>
        </div>
      </div></div>`;
    document.body.insertBefore(nav, document.body.firstChild);
    // หน้าอื่นที่มีแถบ sticky ของตัวเอง ใช้ --bpnav-h เพื่อเรียงต่อใต้แถบเมนูนี้
    const setH = () => document.documentElement.style.setProperty('--bpnav-h', nav.offsetHeight + 'px');
    setH(); window.addEventListener('resize', setH);
    if (window.ResizeObserver) new ResizeObserver(setH).observe(nav);
    if (back) $('bp-back').onclick = () => {
      if (history.length > 1) {
        history.back();
        setTimeout(() => { if (!document.hidden) location.href = back.href; }, 900);   // history.back() ไม่ไป (เช่น เปิดในแท็บใหม่) → ไปหน้าเดิมโดยตรง
      } else location.href = back.href;
    };
    const menu = $('bp-menu');
    $('bp-ubtn').onclick = e => { e.stopPropagation(); menu.classList.toggle('open'); };
    document.addEventListener('click', () => menu.classList.remove('open'));
    $('bp-chpw').onclick = () => { menu.classList.remove('open'); passwordFlow(false); };
    $('bp-logout').onclick = () => { B.clearSession(); location.reload(); };
  }

  async function programStart(opts) {
    const page = (opts && opts.page) || 'dashboard';
    injectCss();
    B.enterProgramMode();
    if (B.getSession()) {
      const u0 = B.getSession().user;
      if (!u0 || !u0.role) B.clearSession();
    }
    let sess = B.getSession() || await loginFlow();
    let user = sess.user;
    if (user.mustChange) user = await passwordFlow(true);

    const item = NAV.find(n => n.key === page);
    if (item && !item.roles.includes(user.role)) {       // role นี้ไม่มีสิทธิ์หน้านี้ → กลับ Dashboard
      location.replace('dashboard.html');
      return new Promise(() => {});
    }
    mountNav(page, user);
    startIdleGuard();

    // ซิงก์สิทธิ์ล่าสุดเบื้องหลัง (เช่น admin เปลี่ยน role) — ไม่บล็อกการโหลดหน้า
    setTimeout(async () => {
      try {
        const r = await B.api('me');
        if (r && r.success && (r.user.role !== user.role || r.user.mustChange)) {
          const s = B.getSession();
          if (s) B.setSession(s.token, s.exp, r.user);
          location.reload();
        }
      } catch (_) {}
    }, 12000);                                           // เว้นให้โหลดข้อมูลหน้าเสร็จก่อน (ลดคำขอพร้อมกัน)
    return user;
  }

  B.programStart = programStart;
})();
