// Bronchoscopy Program shell: หน้า login / เปลี่ยนรหัสผ่านครั้งแรก / แถบตัวระบุและเมนูตามสิทธิ์ / ออกจากระบบเมื่อไม่ใช้งาน (ใช้ร่วมทุกหน้า)
// ใช้: const user = await Broncho.programStart({ page: 'dashboard' });
(() => {
  const B = window.Broncho, esc = B.esc;

  const ORG  = 'โรงพยาบาลมหาสารคาม';
  const UNIT = 'หน่วยโรคระบบการหายใจและภาวะวิกฤติโรคระบบการหายใจ';
  const DEPT = 'แผนกอายุรกรรม';
  const IDLE_MS = 15 * 60 * 1000;      // ไม่มีการใช้งานครบเวลานี้ → ออกจากระบบ
  const WARN_MS = 60 * 1000;           // เตือนก่อนออกจากระบบ
  const ACT_KEY = 'bp_act', IDLE_FLAG = 'bp_idle_out';

  const NAV = [
    { key: 'dashboard', label: 'Dashboard',        href: 'dashboard.html',                         roles: ['admin', 'doctor', 'user'] },
    { key: 'book',      label: 'จองคิว',            href: 'index.html?mode=program&page=book',      roles: ['admin', 'doctor'] },
    { key: 'my',        label: 'การจองของฉัน',      href: 'index.html?mode=program&page=my',        roles: ['admin', 'doctor'] },
    { key: 'record',    label: 'บันทึกส่องกล้อง',   href: 'record.html',                            roles: ['admin', 'user'] },
    { key: 'users',     label: 'จัดการผู้ใช้',      href: 'users.html',                             roles: ['admin'] },
  ];
  const ROLE_LABEL = { admin: 'ผู้ดูแลระบบ', doctor: 'แพทย์', user: 'พยาบาล/เจ้าหน้าที่' };

  // เครื่องหมายหน่วย: กิ่งหลอดลมแบบเส้น (ไม่ใช่ตราสัญลักษณ์ราชการ)
  const MARK = '<svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M16 4v10M16 14l-7 6M16 14l7 6M9 20v5M23 20v5M9 20l-3 3M23 20l3 3"/></svg>';

  const CSS = `
  .bp-idbar{position:relative;z-index:210;font-family:var(--font,'Sarabun',system-ui,sans-serif);background:var(--navy,#12315C);color:#fff}
  .bp-nav{position:sticky;top:0;z-index:200;font-family:var(--font,'Sarabun',system-ui,sans-serif);background:#fff;border-bottom:1px solid var(--line-1,#C7CFDB)}
  .bp-id-in{max-width:1280px;margin:0 auto;padding:8px 16px;display:flex;align-items:center;gap:12px;min-height:56px}
  .bp-mark{width:40px;height:40px;border:1px solid rgba(255,255,255,.45);border-radius:4px;display:grid;place-items:center;flex-shrink:0;color:#fff}
  .bp-org{min-width:0;flex:1}
  .bp-org1{font-size:17px;font-weight:700;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .bp-org2{font-size:13px;line-height:1.3;color:#D5DEEC;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .bp-side{display:flex;align-items:center;gap:14px;flex-shrink:0}
  .bp-sess{font-size:13px;color:#D5DEEC;display:flex;align-items:center;gap:6px;white-space:nowrap}
  .bp-sess svg{flex-shrink:0}
  .bp-user{position:relative}
  .bp-ubtn{display:flex;align-items:center;gap:8px;background:transparent;color:#fff;border:1px solid rgba(255,255,255,.6);border-radius:4px;padding:6px 10px;font:inherit;font-size:15px;cursor:pointer;max-width:280px;min-height:40px}
  .bp-ubtn:hover{background:rgba(255,255,255,.1)}
  .bp-ubtn:focus-visible{outline:3px solid #fff;outline-offset:2px}
  .bp-uname{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .bp-role{font-size:12.5px;font-weight:600;background:var(--gold-lt,#E3C877);color:var(--navy-dk,#0C2244);border-radius:3px;padding:1px 7px;white-space:nowrap}
  .bp-menu{position:absolute;right:0;top:calc(100% + 6px);background:#fff;color:var(--text-1,#14223A);border:1px solid var(--line-1,#C7CFDB);border-top:3px solid var(--navy,#12315C);border-radius:4px;box-shadow:0 10px 28px rgba(12,34,68,.25);min-width:250px;padding:6px;display:none}
  .bp-menu.open{display:block}
  .bp-menu .who{padding:8px 10px 10px;font-size:14px;color:var(--text-2,#43536B);border-bottom:1px solid var(--line-2,#E3E8EF);margin-bottom:4px;line-height:1.6}
  .bp-menu .who b{color:var(--text-1,#14223A);font-size:16px}
  .bp-menu button{display:flex;align-items:center;gap:10px;width:100%;text-align:left;background:none;border:0;padding:10px;border-radius:4px;font:inherit;font-size:16px;cursor:pointer;color:var(--text-1,#14223A);min-height:44px}
  .bp-menu button:hover{background:var(--paper,#F4F6F9)}
  .bp-tabs{max-width:1280px;margin:0 auto;padding:0 12px;display:flex;gap:2px;overflow-x:auto;scrollbar-width:none}
  .bp-tabs::-webkit-scrollbar{display:none}
  .bp-tab{color:var(--text-2,#43536B);text-decoration:none;font-size:16px;font-weight:600;padding:12px 14px;white-space:nowrap;border-bottom:3px solid transparent;min-height:46px;display:flex;align-items:center}
  .bp-tab:hover{color:var(--navy,#12315C);background:var(--paper,#F4F6F9)}
  .bp-tab.on{color:var(--navy,#12315C);font-weight:700;border-bottom-color:var(--gold,#9C7A2B)}
  @media(max-width:720px){
    .bp-id-in{padding:6px 10px;min-height:50px;gap:8px}
    .bp-mark{width:34px;height:34px}.bp-mark svg{width:24px;height:24px}
    .bp-org1{font-size:15px}.bp-org2{display:none}
    .bp-sess{display:none}
    .bp-ubtn{max-width:150px;padding:5px 8px;font-size:14px}
    .bp-role{display:none}
    .bp-tabs{padding:0 4px}
    .bp-tab{flex:1 0 auto;justify-content:center;padding:10px 10px;font-size:15px}
  }

  .bp-ov{position:fixed;inset:0;z-index:10000;background:var(--paper,#F4F6F9);display:flex;align-items:center;justify-content:center;padding:16px;font-family:var(--font,'Sarabun',system-ui,sans-serif);overflow:auto}
  .bp-ov.light{background:rgba(12,34,68,.55)}
  .bp-card{background:#fff;color:var(--text-1,#14223A);border:1px solid var(--line-1,#C7CFDB);border-radius:4px;width:100%;max-width:420px;box-shadow:0 8px 28px rgba(12,34,68,.12);overflow:hidden}
  .bp-ov.light .bp-card{box-shadow:0 16px 48px rgba(12,34,68,.35)}
  .bp-head{background:var(--navy,#12315C);color:#fff;padding:16px 20px;display:flex;align-items:center;gap:12px}
  .bp-head .bp-mark{width:42px;height:42px}
  .bp-head .o1{font-size:18px;font-weight:700;line-height:1.3}
  .bp-head .o2{font-size:13px;color:#D5DEEC;line-height:1.4}
  .bp-head .o3{font-size:13px;color:#fff;line-height:1.4}
  .bp-body{padding:22px 22px 20px}
  .bp-card h1{font-size:22px;font-weight:700;color:var(--navy,#12315C);line-height:1.3}
  .bp-card .sub{font-size:15px;color:var(--text-2,#43536B);margin:4px 0 14px;line-height:1.55}
  .bp-card label{display:block;font-size:15px;font-weight:600;color:var(--text-1,#14223A);margin:14px 0 6px}
  .bp-card input{width:100%;border:1px solid var(--field,#7B889C);border-radius:4px;padding:10px 12px;font:inherit;font-size:17px;background:#fff;color:var(--text-1,#14223A);min-height:46px}
  .bp-pw{position:relative}.bp-pw input{padding-right:50px}
  .bp-eye{position:absolute;right:2px;top:50%;transform:translateY(-50%);background:none;border:0;padding:0;width:44px;height:44px;display:grid;place-items:center;cursor:pointer;color:var(--text-2,#43536B)}
  .bp-err{color:var(--bad,#A4262C);font-size:15px;min-height:20px;margin-top:10px;line-height:1.5}
  .bp-err.soft{color:var(--text-3,#5A6980)}
  .bp-go{width:100%;margin-top:8px;background:var(--action,#1B4F9C);color:#fff;border:1px solid var(--action,#1B4F9C);border-radius:4px;padding:12px;font:inherit;font-size:17px;font-weight:600;cursor:pointer;min-height:48px}
  .bp-go:hover:not(:disabled){background:var(--action-dk,#12396F)}
  .bp-go:disabled{opacity:.5;cursor:not-allowed}
  .bp-alt{width:100%;margin-top:8px;background:#fff;color:var(--text-1,#14223A);border:1px solid var(--field,#7B889C);border-radius:4px;padding:11px;font:inherit;font-size:16px;cursor:pointer;min-height:46px}
  .bp-alt:hover{background:var(--paper,#F4F6F9)}
  .bp-rules{list-style:none;margin:10px 0 0;padding:0;font-size:14.5px;color:var(--text-3,#5A6980)}
  .bp-rules li{padding:2px 0}.bp-rules li.ok{color:var(--ok,#1E6B4F)}
  .bp-rules li::before{content:'○ '}.bp-rules li.ok::before{content:'✓ '}
  .bp-note{background:var(--warn-lt,#FBF0DC);border:1px solid var(--warn-bd,#E5C48A);color:var(--warn,#8A5300);border-radius:4px;padding:10px 12px;font-size:15px;line-height:1.6;margin-bottom:6px}
  .bp-note.idle{background:var(--info-lt,#E8EEF8);border-color:var(--info-bd,#B3C6E4);color:var(--navy,#12315C)}
  .bp-legal{margin-top:18px;padding-top:14px;border-top:1px solid var(--line-2,#E3E8EF);font-size:13.5px;line-height:1.65;color:var(--text-3,#5A6980);display:flex;gap:10px}
  .bp-legal svg{flex-shrink:0;color:var(--navy,#12315C);margin-top:2px}
  .bp-idle .bp-card{max-width:400px}
  .bp-idle .count{font-size:34px;font-weight:700;color:var(--navy,#12315C);text-align:center;margin:8px 0 4px}
  `;

  function injectCss() {
    if (document.getElementById('bp-css')) return;
    const st = document.createElement('style'); st.id = 'bp-css'; st.textContent = CSS; document.head.appendChild(st);
  }
  const $ = id => document.getElementById(id);

  function overlay(html, light, cls) {
    const ov = document.createElement('div');
    ov.className = 'bp-ov' + (light ? ' light' : '') + (cls ? ' ' + cls : '');
    ov.innerHTML = html;
    document.body.appendChild(ov);
    return ov;
  }
  const cardHead = () => `<div class="bp-head"><div class="bp-mark">${MARK}</div><div><div class="o1">${esc(ORG)}</div><div class="o2">${esc(UNIT)}</div><div class="o3">${esc(DEPT)}</div></div></div>`;
  const LEGAL = `<div class="bp-legal">${B.icon('shield', 20)}<div>ระบบนี้ใช้เฉพาะเจ้าหน้าที่ที่ได้รับอนุญาต ข้อมูลผู้ป่วยเป็นข้อมูลส่วนบุคคลตาม พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 ห้ามเปิดเผยหรือนำไปใช้นอกเหนือหน้าที่ ระบบจะออกจากระบบอัตโนมัติเมื่อไม่มีการใช้งาน 15 นาที</div></div>`;

  // ── Login ─────────────────────────────────────────────────
  function loginFlow() {
    return new Promise(resolve => {
      let idleOut = false;
      try { idleOut = sessionStorage.getItem(IDLE_FLAG) === '1'; sessionStorage.removeItem(IDLE_FLAG); } catch (_) {}
      const ov = overlay(`
        <form class="bp-card" id="bp-lf" autocomplete="on">
          ${cardHead()}
          <div class="bp-body">
            <h1>เข้าสู่ระบบ</h1>
            <div class="sub">ระบบจองคิวและบันทึกหัตถการส่องกล้องหลอดลม (Bronchoscopy Program)</div>
            ${idleOut ? '<div class="bp-note idle">ออกจากระบบเพื่อความปลอดภัย เพราะไม่มีการใช้งานนาน 15 นาที กรุณาเข้าสู่ระบบอีกครั้ง</div>' : ''}
            <label for="bp-u">ชื่อผู้ใช้</label>
            <input id="bp-u" name="username" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" required>
            <label for="bp-p">รหัสผ่าน</label>
            <div class="bp-pw"><input id="bp-p" name="password" type="password" autocomplete="current-password" required>
              <button type="button" class="bp-eye" id="bp-eye" aria-label="แสดงรหัสผ่าน" aria-pressed="false">${B.icon('eye', 22)}</button></div>
            <div class="bp-err" id="bp-err" role="alert"></div>
            <button class="bp-go" id="bp-go" type="submit">เข้าสู่ระบบ</button>
            ${LEGAL}
          </div>
        </form>`);
      $('bp-eye').onclick = () => {
        const i = $('bp-p'), show = i.type === 'password';
        i.type = show ? 'text' : 'password';
        $('bp-eye').innerHTML = B.icon(show ? 'eyeoff' : 'eye', 22);
        $('bp-eye').setAttribute('aria-label', show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน');
        $('bp-eye').setAttribute('aria-pressed', show ? 'true' : 'false');
      };
      $('bp-u').focus();
      $('bp-lf').onsubmit = async ev => {
        ev.preventDefault();
        const go = $('bp-go'), err = $('bp-err');
        err.textContent = ''; err.classList.remove('soft'); go.disabled = true; go.textContent = 'กำลังตรวจสอบ...';
        const slow = setTimeout(() => { err.classList.add('soft'); err.textContent = 'เซิร์ฟเวอร์กำลังเริ่มทำงาน อาจใช้เวลาสักครู่...'; }, 6000);
        try {
          const r = await B.fetchJson({ action: 'login', params: { username: $('bp-u').value, password: $('bp-p').value } }, 45000);
          if (!r || !r.success) throw new Error((r && r.error) || 'SERVER_ERROR');
          B.setSession(r.token, r.expiresAt, r.user);
          clearTimeout(slow);
          ov.remove();
          resolve(B.getSession());
        } catch (e) {
          clearTimeout(slow);
          err.classList.remove('soft'); err.textContent = B.errorText(e);
          $('bp-p').value = ''; go.disabled = false; go.textContent = 'เข้าสู่ระบบ';
          $('bp-p').focus();
        }
      };
    });
  }

  // ── เปลี่ยนรหัสผ่าน (บังคับครั้งแรก หรือเลือกเองจากเมนู) ──────────
  function passwordFlow(forced) {
    return new Promise(resolve => {
      const ov = overlay(`
        <form class="bp-card" id="bp-pf" autocomplete="off">
          ${cardHead()}
          <div class="bp-body">
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
          </div>
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
    let last = Date.now(), warnOv = null, warnTimer = null;
    const readAct = () => { try { return +localStorage.getItem(ACT_KEY) || 0; } catch (_) { return 0; } };
    let lastWrite = 0;
    const bump = () => {
      if (warnOv) return;                                 // ระหว่างเตือน ต้องกด "ใช้งานต่อ" เท่านั้น
      last = Date.now();
      if (last - lastWrite > 5000) { lastWrite = last; try { localStorage.setItem(ACT_KEY, String(last)); } catch (_) {} }
    };
    ['pointerdown', 'keydown', 'scroll', 'touchstart', 'mousemove'].forEach(e =>
      window.addEventListener(e, bump, { passive: true, capture: true }));

    function logoutIdle() {
      try { sessionStorage.setItem(IDLE_FLAG, '1'); } catch (_) {}
      B.clearSession(); location.reload();
    }
    function closeWarn() {
      if (warnOv) { warnOv.remove(); warnOv = null; }
      clearInterval(warnTimer); warnTimer = null;
    }
    function showWarn() {
      warnOv = overlay(`
        <div class="bp-card" role="alertdialog" aria-modal="true" aria-labelledby="bp-iw-t" aria-describedby="bp-iw-d">
          <div class="bp-body">
            <h1 id="bp-iw-t">ไม่มีการใช้งานสักครู่</h1>
            <div class="sub" id="bp-iw-d">เพื่อความปลอดภัยของข้อมูลผู้ป่วย ระบบจะออกจากระบบอัตโนมัติใน</div>
            <div class="count" id="bp-iw-n" aria-live="polite">60</div>
            <div class="sub" style="text-align:center;margin:0 0 6px">วินาที</div>
            <button class="bp-go" id="bp-iw-go" type="button">ใช้งานต่อ</button>
            <button class="bp-alt" id="bp-iw-out" type="button">ออกจากระบบตอนนี้</button>
          </div>
        </div>`, true, 'bp-idle');
      $('bp-iw-go').focus();
      $('bp-iw-go').onclick = () => { closeWarn(); last = Date.now(); try { localStorage.setItem(ACT_KEY, String(last)); } catch (_) {} };
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

  // ── แถบตัวระบุ + เมนู ───────────────────────────────────────
  function fmtRemain(ms) {
    const m = Math.max(0, Math.floor(ms / 60000)), h = Math.floor(m / 60);
    return h > 0 ? h + ' ชม. ' + (m % 60) + ' น.' : m + ' นาที';
  }
  function mountNav(page, user) {
    ['bp-nav', 'bp-idbar'].forEach(i => { const e = document.getElementById(i); if (e) e.remove(); });
    const items = NAV.filter(n => n.roles.includes(user.role));
    const role = ROLE_LABEL[user.role] || user.role;
    const idbar = document.createElement('header');
    idbar.className = 'bp-idbar'; idbar.id = 'bp-idbar';
    idbar.innerHTML = `
      <a class="skip-link" href="#bp-main" id="bp-skip">ข้ามไปยังเนื้อหา</a>
      <div class="bp-id-in">
        <div class="bp-mark">${MARK}</div>
        <div class="bp-org"><div class="bp-org1">${esc(ORG)}</div><div class="bp-org2">${esc(UNIT)} · ${esc(DEPT)}</div></div>
        <div class="bp-side">
          <div class="bp-sess" id="bp-sess" title="เวลาที่เหลือก่อนต้องเข้าสู่ระบบใหม่">${B.icon('lock', 16)}<span id="bp-sess-t"></span></div>
          <div class="bp-user">
            <button class="bp-ubtn" id="bp-ubtn" type="button" aria-haspopup="true" aria-expanded="false" aria-controls="bp-menu">
              ${B.icon('user', 18)}<span class="bp-uname">${esc(user.name)}</span><span class="bp-role">${esc(role)}</span>
            </button>
            <div class="bp-menu" id="bp-menu" role="menu">
              <div class="who"><b>${esc(user.name)}</b><br>${esc(role)} · ${esc(user.username)}</div>
              <button type="button" id="bp-chpw" role="menuitem">${B.icon('key', 20)}เปลี่ยนรหัสผ่าน</button>
              <button type="button" id="bp-logout" role="menuitem">${B.icon('logout', 20)}ออกจากระบบ</button>
            </div>
          </div>
        </div>
      </div>`;
    const nav = document.createElement('nav');
    nav.className = 'bp-nav'; nav.id = 'bp-nav'; nav.setAttribute('aria-label', 'เมนูหลัก');
    nav.innerHTML = `<div class="bp-tabs">${items.map(n =>
        `<a class="bp-tab${n.key === page ? ' on' : ''}" href="${n.href}"${n.key === page ? ' aria-current="page"' : ''}>${n.label}</a>`).join('')}</div>`;
    document.body.insertBefore(nav, document.body.firstChild);
    document.body.insertBefore(idbar, nav);                // แถบตัวระบุอยู่บนสุดแล้วเลื่อนหายตามหน้า; แถวเมนูหลักติดบนจอ

    // หน้าอื่นที่มีแถบ sticky ของตัวเอง ใช้ --bpnav-h เพื่อเรียงต่อใต้แถวเมนูนี้
    const setH = () => document.documentElement.style.setProperty('--bpnav-h', nav.offsetHeight + 'px');
    setH(); window.addEventListener('resize', setH);
    if (window.ResizeObserver) new ResizeObserver(setH).observe(nav);

    $('bp-skip').onclick = e => {
      e.preventDefault();
      const t = document.querySelector('main:not(.hidden), .content, .page, .wrap');
      if (t) { t.setAttribute('tabindex', '-1'); t.focus(); }
    };
    const menu = $('bp-menu'), btn = $('bp-ubtn');
    const setOpen = o => { menu.classList.toggle('open', o); btn.setAttribute('aria-expanded', o ? 'true' : 'false'); };
    btn.onclick = e => { e.stopPropagation(); setOpen(!menu.classList.contains('open')); };
    document.addEventListener('click', () => setOpen(false));
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && menu.classList.contains('open')) { setOpen(false); btn.focus(); } });
    $('bp-chpw').onclick = () => { setOpen(false); passwordFlow(false); };
    $('bp-logout').onclick = () => { B.clearSession(); location.reload(); };

    const sessText = () => {
      const s = B.getSession(); if (!s) return;
      const https = location.protocol === 'https:';
      $('bp-sess-t').textContent = (https ? 'เชื่อมต่อแบบเข้ารหัส · ' : '') + 'เซสชันเหลือ ' + fmtRemain(s.exp - Date.now());
    };
    sessText(); setInterval(sessText, 30000);
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
