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
    return ['book', 'my', 'cancel'].includes(p) ? p : 'book';
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

  const READS = ['checkAuth', 'getAvailableSlots', 'getUserBookings', 'getBookingsByDate',
                 'getPriceList', 'getBookingScopes', 'getDashboardData', 'getProcedureData', 'getDoctorList'];

  // คืน JSON จาก server (อาจเป็น {success:false,error}); throw เมื่อเครือข่าย/timeout/โทเคนหมดอายุ
  async function api(action, params = {}) {
    const isRead   = READS.includes(action);
    const attempts = isRead ? 2 : 1;              // retry เฉพาะ action อ่านอย่างเดียว (กันจอง/บันทึกซ้ำ)
    let lastErr;
    for (let i = 0; i < attempts; i++) {
      try {
        const data = await fetchJson({ action, params: { ...params, idToken: liff.getIDToken() } }, 45000);   // Apps Script cold start อาจนาน 30+ วินาที
        if (data && (data.error === 'TOKEN_EXPIRED' || data.error === 'TOKEN_INVALID' || data.error === 'TOKEN_MISSING')) {
          if (!liff.isInClient()) { liff.logout(); liff.login({ redirectUri: location.href }); }
          throw new Error('SESSION_EXPIRED');
        }
        return data;
      } catch (e) {
        lastErr = e;
        if (e.message === 'SESSION_EXPIRED' || e.message === 'SERVER_404' || i === attempts - 1) break;
        await new Promise(r => setTimeout(r, 800));
      }
    }
    throw lastErr;
  }

  const MESSAGES = {
    TIMEOUT:            'เซิร์ฟเวอร์ตอบช้าเกินไป (เกิน 45 วินาที) กรุณากด "ลองใหม่" — ครั้งถัดไปมักเร็วขึ้น',
    SERVER_404:         'ไม่พบเซิร์ฟเวอร์ (404) — ตรวจสอบ SCRIPT_URL / การ deploy ของ Apps Script',
    SESSION_EXPIRED:    'เซสชันหมดอายุ กรุณาปิดแล้วเปิดหน้านี้ใหม่จาก LINE',
    SCRIPT_URL_NOT_SET: 'ยังไม่ได้ตั้งค่า SCRIPT_URL ใน config.js',
    LIFF_SDK_MISSING:   'โหลด LINE SDK ไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่',
    UNAUTHORIZED:       'ไม่มีสิทธิ์ใช้งาน',
    SERVER_ERROR:       'ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง',
    BUSY:               'ระบบกำลังประมวลผลรายการอื่น กรุณาลองใหม่',
    NOT_YOUR_BOOKING:   'นี่ไม่ใช่การจองของคุณ',
    ALREADY_CANCELLED:  'รายการนี้ถูกยกเลิกไปแล้ว',
    DUPLICATE_RECORD:   'Case นี้บันทึกข้อมูลไปแล้ว',
  };
  function errorText(e) {
    const code = (e && e.message) ? e.message : String(e);
    if (MESSAGES[code]) return MESSAGES[code];
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
      el.style.cssText = 'position:fixed;left:12px;right:12px;bottom:20px;z-index:9999;padding:12px 14px;' +
        'border-radius:10px;color:#fff;font-size:14px;text-align:center;box-shadow:0 4px 16px rgba(0,0,0,.25)';
      document.body.appendChild(el);
    }
    el.style.background = isError ? '#d32f2f' : '#107c10';
    el.textContent = msg; el.style.display = 'block';
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.style.display = 'none'; }, 5000);
  }

  return { esc, csvSafe, getPage, startLiff, api, errorText, toast, stripAuthParams };
})();
