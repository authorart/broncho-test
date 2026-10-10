// ตัวช่วยร่วม: escape, เรียก API (timeout/retry), LIFF login, อ่าน ?page=
window.Broncho = (() => {
  const CFG = window.APP_CONFIG;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // กัน CSV/Excel formula injection
  function csvSafe(v) {
    const s = String(v == null ? '' : v);
    return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
  }

  function stripAuthParams() {
    try {
      const u = new URL(location.href);
      ['code', 'state', 'liffClientId', 'liffRedirectUri', 'error', 'error_description']
        .forEach(k => u.searchParams.delete(k));
      history.replaceState(null, '', u.toString());
    } catch (_) {}
  }

  function getPage() {
    const q = new URLSearchParams(location.search);
    let p = q.get('page');
    if (!p) {                                   // LIFF อาจเก็บ query ไว้ใน liff.state
      const st = q.get('liff.state');
      if (st) { try { p = new URLSearchParams(st.replace(/^\?/, '')).get('page'); } catch (_) {} }
    }
    return ['book', 'my', 'cancel', 'record', 'dashboard'].includes(p) ? p : 'book';
  }

  async function startLiff(setStatus) {
    if (typeof liff === 'undefined') throw new Error('LIFF_SDK_MISSING');
    if (CFG.SCRIPT_URL.indexOf('PASTE_') === 0) throw new Error('SCRIPT_URL_NOT_SET');
    setStatus('กำลังเชื่อมต่อ LINE...');
    try {
      await liff.init({ liffId: CFG.LIFF_ID });
    } catch (e) {                               // code เก่าค้างใน URL หลัง login → ล้างแล้วลองใหม่ 1 ครั้ง
      stripAuthParams();
      await liff.init({ liffId: CFG.LIFF_ID });
    }
    if (!liff.isLoggedIn()) { liff.login({ redirectUri: location.href }); return false; }
    return true;
  }

  async function fetchJson(body, timeoutMs) {
    const ctl = new AbortController();
    const t   = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetch(CFG.SCRIPT_URL, {
        method: 'POST', headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(body), redirect: 'follow', signal: ctl.signal,
      });
      if (res.status === 404) throw new Error('SERVER_404');
      if (!res.ok) throw new Error('HTTP_' + res.status);
      try { return await res.json(); } catch (_) { throw new Error('BAD_RESPONSE'); }
    } catch (e) {
      if (e.name === 'AbortError') throw new Error('TIMEOUT');
      throw e;
    } finally { clearTimeout(t); }
  }

  // ── session ของโปรแกรม (login ด้วย username/password) ใช้ร่วมกันทุกหน้า: login ครั้งเดียว ──
  const SKEY = 'bp_session';
  let programMode = false, memSession = null;
  function getSession() {
    let s = memSession;
    if (!s) { try { s = JSON.parse(localStorage.getItem(SKEY)); } catch (_) {} }
    return (s && s.token && s.exp > Date.now()) ? s : null;
  }
  function setSession(token, expiresAt, user) {
    memSession = { token, exp: expiresAt, user };
    try { localStorage.setItem(SKEY, JSON.stringify(memSession)); } catch (_) {}
  }
  function clearSession() { memSession = null; try { localStorage.removeItem(SKEY); } catch (_) {} }

  const READS = ['checkAuth', 'getAvailableSlots', 'getUserBookings', 'getBookingsByDate',
                 'getPriceList', 'getBookingScopes', 'getDashboardData', 'getProcedureData', 'getDoctorList', 'getRoomQueue', 'listUsers', 'me'];

  // คืน JSON จาก server (อาจเป็น {success:false,error}); throw เมื่อเครือข่าย/timeout/โทเคนหมดอายุ
  async function api(action, params = {}) {
    const isRead   = READS.includes(action);
    const attempts = isRead ? 3 : 1;              // retry เฉพาะ action อ่านอย่างเดียว (กันจอง/บันทึกซ้ำ)
    let lastErr;
    for (let i = 0; i < attempts; i++) {
      try {
        const sess = programMode ? getSession() : null;
        const auth = programMode ? { sessionToken: sess ? sess.token : '' } : { idToken: liff.getIDToken() };
        const data = await fetchJson({ action, params: { ...params, ...auth } }, 45000);   // Apps Script cold start อาจนาน 30+ วินาที
        if (data && (data.error === 'TOKEN_EXPIRED' || data.error === 'TOKEN_INVALID' || data.error === 'TOKEN_MISSING')) {
          if (programMode) { clearSession(); setTimeout(() => location.reload(), 1200); }   // กลับไปหน้า login
          else if (!liff.isInClient()) { liff.logout(); liff.login({ redirectUri: location.href }); }
          throw new Error('SESSION_EXPIRED');
        }
        if (programMode && data && data.error === 'PASSWORD_CHANGE_REQUIRED') { setTimeout(() => location.reload(), 800); }
        return data;
      } catch (e) {
        lastErr = e;
        if (e.message === 'SESSION_EXPIRED' || i === attempts - 1) break;
        // Apps Script บางครั้งตอบ 404 ชั่วคราวทั้งที่ deploy ปกติ (ลองซ้ำได้เฉพาะ action อ่าน)
        await new Promise(r => setTimeout(r, e.message === 'SERVER_404' ? 1800 : 800));
      }
    }
    if (lastErr && typeof lastErr === 'object') lastErr.action = action;
    throw lastErr;
  }

  const MESSAGES = {
    TIMEOUT:            'เซิร์ฟเวอร์ตอบช้าเกินไป (เกิน 45 วินาที) กรุณากด "ลองใหม่" — ครั้งถัดไปมักเร็วขึ้น',
    SERVER_404:         'ไม่พบเซิร์ฟเวอร์ (404) — ตรวจสอบ SCRIPT_URL / การ deploy ของ Apps Script',
    SESSION_EXPIRED:    'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่ (หน้านี้จะโหลดใหม่อัตโนมัติ)',
    INVALID_LOGIN:      'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง',
    TOO_MANY_ATTEMPTS:  'ใส่ผิดหลายครั้ง ระบบล็อกชั่วคราว 15 นาที (ผู้ดูแลรีเซ็ตรหัสผ่านให้ได้)',
    ACCOUNT_INACTIVE:   'บัญชีนี้ยังไม่เปิดใช้งาน หรือถูกปิดการใช้งาน',
    FORBIDDEN:          'บัญชีของคุณไม่มีสิทธิ์ใช้งานส่วนนี้',
    SESSION_REQUIRED:   'ต้องเข้าสู่ระบบด้วยชื่อผู้ใช้/รหัสผ่านก่อน',
    PASSWORD_CHANGE_REQUIRED: 'ต้องเปลี่ยนรหัสผ่านก่อนใช้งาน',
    PASSWORD_WEAK:      'รหัสผ่านต้องมีอย่างน้อย 8 ตัว และมีตัวพิมพ์เล็ก ตัวพิมพ์ใหญ่ และตัวเลข',
    PASSWORD_SAME:      'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม/รหัสเริ่มต้น',
    WRONG_PASSWORD:     'รหัสผ่านปัจจุบันไม่ถูกต้อง',
    USERNAME_TAKEN:     'ชื่อผู้ใช้นี้ถูกใช้แล้ว',
    NAME_TAKEN:         'ชื่อนี้มีอยู่แล้ว',
    LAST_ADMIN:         'ต้องมีผู้ดูแลระบบ (admin) ที่ใช้งานได้อย่างน้อย 1 คน',
    NO_USERNAME:        'ผู้ใช้นี้ยังไม่มีชื่อผู้ใช้ (username)',
    SCRIPT_URL_NOT_SET: 'ยังไม่ได้ตั้งค่า SCRIPT_URL ใน config.js',
    LIFF_SDK_MISSING:   'โหลด LINE SDK ไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่',
    UNAUTHORIZED:       'ไม่มีสิทธิ์ใช้งาน',
    SERVER_ERROR:       'ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง',
    BUSY:               'ระบบกำลังประมวลผลรายการอื่น กรุณาลองใหม่',
    NOT_YOUR_BOOKING:   'นี่ไม่ใช่การจองของคุณ',
    ALREADY_CANCELLED:  'รายการนี้ถูกยกเลิกไปแล้ว',
    DUPLICATE_RECORD:   'Case นี้บันทึกข้อมูลไปแล้ว',
    NOT_EDITABLE:       'แก้ไขไม่ได้ (การจองผ่านเวลาไปแล้ว)',
    ALREADY_RECORDED:   'เคสนี้บันทึกหัตถการแล้ว ยกเลิกไม่ได้',
    REASON_REQUIRED:    'กรุณาระบุเหตุผลในช่อง "อื่นๆ"',
    ROW_MISMATCH:       'ข้อมูลการจองเปลี่ยนไป กรุณาโหลดหน้าใหม่แล้วลองอีกครั้ง',
    SLOT_TAKEN:         'slot นี้ถูกจองไปแล้ว กรุณาเลือกเวลาอื่น',
  };
  function errorText(e) {
    const code = (e && e.message) ? e.message : String(e);
    const tag = (e && e.action) ? ' [' + e.action + ']' : '';
    if (MESSAGES[code]) return MESSAGES[code] + (code === 'SERVER_404' ? tag : '');
    if (code.indexOf('INVALID_INPUT') === 0) return 'ข้อมูลไม่ถูกต้อง (' + code.split(':')[1] + ')';
    if (code.indexOf('HTTP_') === 0 || code === 'BAD_RESPONSE' || /Failed to fetch|NetworkError/i.test(code))
      return 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ (' + code + ')';
    return 'เกิดข้อผิดพลาด: ' + code;
  }

  let toastTimer;
  function toast(msg, isError) {
    let el = document.getElementById('bx-toast');
    if (!el) {
      el = document.createElement('div'); el.id = 'bx-toast';
      el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
      el.style.cssText = 'position:fixed;left:12px;right:12px;bottom:20px;z-index:20000;padding:13px 16px;max-width:560px;margin:0 auto;' +
        'border-radius:4px;color:#fff;font-size:16px;line-height:1.5;text-align:center;box-shadow:0 6px 20px rgba(12,34,68,.3)';
      document.body.appendChild(el);
    }
    el.style.background = isError ? '#A4262C' : '#1E6B4F';
    el.textContent = msg; el.style.display = 'block';
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.style.display = 'none'; }, 5000);
  }

  // ── วันที่แบบไทย (พ.ศ.): แปลงข้อความวันที่ที่มาจากเซิร์ฟเวอร์ (ค.ศ.) เฉพาะตอนแสดงผล ──
  const TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const EN_M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const EN_D = { Sun: 'อา.', Mon: 'จ.', Tue: 'อ.', Wed: 'พ.', Thu: 'พฤ.', Fri: 'ศ.', Sat: 'ส.' };
  function thDate(s) {
    return String(s == null ? '' : s)
      .replace(/\b(Sun|Mon|Tue|Wed|Thu|Fri|Sat)[a-z]*\.?,?\s+(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{4})\b/g,
        (m, dw, d, mo, y) => (+y < 2400 ? EN_D[dw] + ' ' + d + ' ' + TH_M[EN_M.indexOf(mo)] + ' ' + (+y + 543) : m))
      .replace(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g, (m, d, mo, y) => (+y < 2400 ? d + '/' + mo + '/' + (+y + 543) : m))
      .replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (m, y, mo, d) => (+y < 2400 ? d + '/' + mo + '/' + (+y + 543) : m));
  }

  // ── ปิดบังข้อมูลผู้ป่วยในรายการ (กันคนข้างๆ เห็น) — กดเพื่อดูเต็ม ──
  function maskHn(hn) {
    const s = String(hn == null ? '' : hn).trim();
    if (!s) return '';
    return s.length <= 3 ? '•••' : '•'.repeat(Math.min(5, s.length - 3)) + s.slice(-3);
  }
  function maskName(n) {
    const p = String(n == null ? '' : n).trim().split(/\s+/).filter(Boolean);
    if (!p.length) return '';
    if (p.length === 1) return p[0].slice(0, 2) + '•••';
    return p.map((t, i) => (i === 0 ? t : t.charAt(0) + '•••')).join(' ');
  }

  // ── ไอคอน SVG ชุดเดียวทั้งระบบ (แทนอีโมจิ) ใช้: <span data-ic="calendar"></span> หรือ Broncho.icon('calendar') ──
  const ICONS = {
    calendar:  '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    check:     '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4 12 14.01l-3-3"/>',
    clock:     '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    cancel:    '<circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/>',
    file:      '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
    pulse:     '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    trend:     '<path d="M23 6l-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/>',
    money:     '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
    timer:     '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/>',
    target:    '<circle cx="12" cy="12" r="9"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/>',
    user:      '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    users:     '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    lock:      '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    key:       '<circle cx="8" cy="15" r="4"/><path d="M10.85 12.15 19 4M18 5l3 3M15 8l3 3"/>',
    logout:    '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    shield:    '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>',
    eye:       '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
    eyeoff:    '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22"/>',
    refresh:   '<path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15"/>',
    download:  '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    print:     '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/>',
    plus:      '<path d="M12 5v14M5 12h14"/>',
    edit:      '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    alert:     '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/>',
    info:      '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    back:      '<path d="M15 18l-6-6 6-6"/>',
    next:      '<path d="M9 18l6-6-6-6"/>',
  };
  function icon(name, size) {
    const s = size || 20;
    return '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '" aria-hidden="true" focusable="false" fill="none" ' +
      'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[name] || '') + '</svg>';
  }
  function hydrateIcons(root) {
    (root || document).querySelectorAll('[data-ic]:not([data-ic-done])').forEach(el => {
      el.innerHTML = icon(el.dataset.ic, +el.dataset.size || 20);
      el.setAttribute('data-ic-done', '1');
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => hydrateIcons());
  else hydrateIcons();

  return { esc, csvSafe, getPage, startLiff, api, errorText, toast, stripAuthParams,
           getSession, setSession, clearSession, enterProgramMode: () => { programMode = true; }, fetchJson,
           thDate, maskHn, maskName, icon, hydrateIcons };
})();
