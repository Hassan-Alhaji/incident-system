#!/usr/bin/env node
/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║   HSE Incident System — UAT + QA Combined Release Acceptance Report  ║
 * ║   Generates a professional HTML/PDF sign-off document               ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * Usage:
 *   node uat_report.js
 *   node uat_report.js --url=https://hsedev.saudimotorsport.com --version=1.2.0
 *
 * Output:
 *   uat_reports/UAT_Report_YYYY-MM-DD.html  (open in browser → Print → Save as PDF)
 */

'use strict';

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const { execSync } = require('child_process');

// ── Config ────────────────────────────────────────────────────────────────────
const args       = Object.fromEntries(process.argv.slice(2).map(a => a.replace('--','').split('=')));
const BASE_URL   = (args.url || process.env.QA_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const FRONTEND   = (args.frontend || process.env.QA_FRONTEND_URL || BASE_URL).replace(/\/$/, '');
const VERSION    = args.version || process.env.APP_VERSION || '—';
const REPORT_DIR = path.join(__dirname, 'uat_reports');
const COMMIT     = (() => { try { return execSync('git rev-parse --short HEAD 2>/dev/null').toString().trim(); } catch { return 'unknown'; } })();
const NOW        = new Date();
const DATE_STR   = NOW.toLocaleDateString('ar-SA', { year:'numeric', month:'long', day:'numeric' });
const DATE_EN    = NOW.toLocaleDateString('en-GB', { year:'numeric', month:'long', day:'numeric' });
const TIME_STR   = NOW.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });

if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });

// ── HTTP Helper ───────────────────────────────────────────────────────────────
const request = (url, opts = {}) => new Promise((resolve) => {
  try {
    const parsed  = new URL(url);
    const lib     = parsed.protocol === 'https:' ? https : http;
    const options = {
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path:     parsed.pathname + (parsed.search || ''),
      method:   opts.method || 'GET',
      headers:  { 'Content-Type': 'application/json', ...(opts.headers || {}) },
      timeout:  10000,
    };
    const req = lib.request(options, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(body); } catch {}
        resolve({ status: res.statusCode, headers: res.headers || {}, body, json, ok: res.statusCode >= 200 && res.statusCode < 300 });
      });
    });
    req.on('error', (e) => resolve({ status: 0, error: e.message, body: '', json: null, ok: false, headers: {} }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, error: 'TIMEOUT', body: '', json: null, ok: false, headers: {} }); });
    if (opts.body) req.write(JSON.stringify(opts.body));
    req.end();
  } catch (e) {
    resolve({ status: 0, error: e.message, body: '', json: null, ok: false, headers: {} });
  }
});

// ── Automated QA Checks ───────────────────────────────────────────────────────
async function runAutomatedChecks() {
  const checks = [];
  const add = (group, name, pass, detail = '') => checks.push({ group, name, pass, detail, auto: true });

  // 1. Backend Health
  const health = await request(`${BASE_URL}/api/health`);
  add('Backend', 'Backend API يعمل (/api/health)', health.status === 200, `HTTP ${health.status}`);

  // 2. Maintenance Mode
  const maint = await request(`${BASE_URL}/api/maintenance`);
  add('Backend', 'Maintenance endpoint متاح', [200,304].includes(maint.status), `HTTP ${maint.status}`);

  // 3. Frontend
  const frontendUrl = FRONTEND.startsWith('http://localhost') ? `${FRONTEND}/` : 'http://localhost:80/';
  const fe = await request(frontendUrl);
  const feOk = fe.status === 200 && (fe.body.includes('<html') || fe.body.includes('<!DOCTYPE'));
  add('Frontend', 'الواجهة الأمامية تحمّل بنجاح', feOk, feOk ? 'HTML صالح' : `HTTP ${fe.status}`);

  // 4. SPA Routes
  for (const route of ['/login', '/dashboard', '/tickets', '/analytics', '/settings']) {
    const r = await request(`${FRONTEND}${route}`);
    add('Frontend', `مسار SPA: ${route}`, [200, 304].includes(r.status), `HTTP ${r.status}`);
  }

  // 5. Auth — No Token
  const noToken = await request(`${BASE_URL}/api/tickets`);
  add('Auth', 'حماية الـ API بدون token → 401', noToken.status === 401, `HTTP ${noToken.status}`);

  // 6. Auth — Fake JWT
  const fakeJwt = await request(`${BASE_URL}/api/tickets`, {
    headers: { Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJmYWtlIn0.invalid' }
  });
  add('Auth', 'رفض JWT مزوّر → 401', fakeJwt.status === 401, `HTTP ${fakeJwt.status}`);

  // 7. Auth — Malformed
  const mal = await request(`${BASE_URL}/api/tickets`, { headers: { Authorization: 'Bearer bad' } });
  add('Auth', 'رفض token مشوّه → 401', mal.status === 401, `HTTP ${mal.status}`);

  // 8. OTP Validation
  const otp = await request(`${BASE_URL}/api/auth/otp/request`, {
    method: 'POST', body: { email: 'not-an-email' }
  });
  add('Auth', 'رفض إيميل غير صالح في OTP → 400', otp.status === 400, `HTTP ${otp.status}`);

  // 9. SSO Redirect
  const sso = await request(`${BASE_URL}/api/auth/microsoft`);
  add('Auth', 'نقطة SSO تعيد توجيهاً صحيحاً', [301,302,307,308].includes(sso.status), `HTTP ${sso.status}`);

  // 10. Security Headers
  const sec = await request(`${BASE_URL}/api/health`);
  add('Security', 'X-Frame-Options أو CSP موجود', !!(sec.headers['x-frame-options'] || sec.headers['content-security-policy']), sec.headers['x-frame-options'] || '—');
  add('Security', 'X-Content-Type-Options موجود', !!sec.headers['x-content-type-options'], sec.headers['x-content-type-options'] || '—');

  // 11. Rate Limiting
  add('Security', 'Rate limiting headers موجودة', !!(sec.headers['x-ratelimit-limit'] || sec.headers['ratelimit-limit']), '—');

  // 12. Path Traversal
  const trav = await request(`${BASE_URL}/api/../etc/passwd`);
  add('Security', 'منع Path Traversal', trav.status !== 200, `HTTP ${trav.status}`);

  return checks;
}

// ── UAT Manual Checklist ──────────────────────────────────────────────────────
const UAT_ITEMS = [
  // Login & Access
  { group: 'تسجيل الدخول', id: 'u1',  ar: 'تسجيل دخول ناجح عبر Microsoft SSO بنقرة واحدة',                     en: 'Successful SSO login via Microsoft with one click' },
  { group: 'تسجيل الدخول', id: 'u2',  ar: 'القسم يُملأ تلقائياً من Azure AD دون اختيار يدوي',                  en: 'Department auto-populated from Azure AD without manual selection' },
  { group: 'تسجيل الدخول', id: 'u3',  ar: 'الحساب المعطّل في AD لا يستطيع الدخول',                             en: 'Disabled AD account is blocked from accessing the system' },
  { group: 'تسجيل الدخول', id: 'u4',  ar: 'تسجيل الخروج يُنهي الجلسة بشكل كامل',                               en: 'Logout terminates session completely' },

  // Reporter Role
  { group: 'المبلّغ (Reporter)', id: 'u5',  ar: 'رفع تذكرة جديدة بالخطوات الثلاث بدون أخطاء',                  en: 'New ticket submission completes all 3 steps without errors' },
  { group: 'المبلّغ (Reporter)', id: 'u6',  ar: 'تحديد الموقع على الخريطة يعمل (GPS + يدوي)',                   en: 'Location tagging works (GPS auto + manual map click)' },
  { group: 'المبلّغ (Reporter)', id: 'u7',  ar: 'رفع صور كمرفقات يعمل بدون أخطاء',                             en: 'Photo attachment upload completes without errors' },
  { group: 'المبلّغ (Reporter)', id: 'u8',  ar: 'القسم يظهر كـ badge مقفول (لا يمكن تغييره)',                   en: 'Department shown as locked read-only badge (not editable)' },
  { group: 'المبلّغ (Reporter)', id: 'u9',  ar: 'تذكرة مرفوعة من أكثر من 24 ساعة تطلب سبب التأخير',            en: 'Ticket submitted >24h ago requires late report reason' },
  { group: 'المبلّغ (Reporter)', id: 'u10', ar: 'رسالة نجاح تظهر بعد رفع التذكرة مع رقمها (INC-XXXX)',          en: 'Success screen appears after submission with ticket reference number' },
  { group: 'المبلّغ (Reporter)', id: 'u11', ar: 'الرفع يعمل بدون إنترنت ويُزامَن عند العودة (Offline Mode)',     en: 'Offline submission saves locally and syncs when connection returns' },

  // Controller Role
  { group: 'مراقب السلامة (Controller)', id: 'u12', ar: 'لوحة القيادة تعرض التذاكر الجديدة فور رفعها',          en: 'Dashboard shows new tickets immediately after submission' },
  { group: 'مراقب السلامة (Controller)', id: 'u13', ar: 'تغيير مستوى الخطورة يعمل ويُحفظ',                     en: 'Severity level change saves correctly' },
  { group: 'مراقب السلامة (Controller)', id: 'u14', ar: 'تعيين القسم المسؤول يعمل ويُرسل إشعاراً',              en: 'Assigning responsible department works and sends notification' },
  { group: 'مراقب السلامة (Controller)', id: 'u15', ar: 'الكنترولر لا يستطيع مراجعة تذكرة رفعها هو (Conflict of Interest)', en: 'Controller cannot review a ticket they reported (conflict check)' },
  { group: 'مراقب السلامة (Controller)', id: 'u16', ar: 'إغلاق تذكرة بسيطة مباشرة يعمل',                       en: 'Direct closure of minor tickets works correctly' },

  // Safety Manager
  { group: 'مدير السلامة (Safety Manager)', id: 'u17', ar: 'مراجعة واعتماد خطط CAPA تعمل',                     en: 'CAPA action plan review and approval works' },
  { group: 'مدير السلامة (Safety Manager)', id: 'u18', ar: 'الموافقة النهائية وإغلاق التذاكر الحرجة تعمل',      en: 'Final approval and closure of critical tickets works' },
  { group: 'مدير السلامة (Safety Manager)', id: 'u19', ar: 'لوحة التحليلات تعرض بيانات صحيحة ومحدّثة',          en: 'Analytics dashboard displays accurate and up-to-date data' },

  // Department Rep
  { group: 'ممثل القسم (DEP_REP)', id: 'u20', ar: 'ممثل القسم يرى تذاكر قسمه فقط (لا تذاكر أقسام أخرى)',      en: 'DEP_REP sees only their department tickets (no cross-dept access)' },
  { group: 'ممثل القسم (DEP_REP)', id: 'u21', ar: 'رفع أدلة الإنجاز (صور) على خطة CAPA يعمل',                  en: 'Uploading completion evidence on CAPA action plan works' },
  { group: 'ممثل القسم (DEP_REP)', id: 'u22', ar: 'إشعار يصل عند تعيين تذكرة للقسم',                            en: 'Notification received when a ticket is assigned to the department' },

  // Admin
  { group: 'مدير النظام (Admin)', id: 'u23', ar: 'إضافة مستخدم جديد بالدور الصحيح تعمل',                        en: 'Creating new user with correct role works' },
  { group: 'مدير النظام (Admin)', id: 'u24', ar: 'تعطيل حساب مستخدم يمنعه من الدخول',                          en: 'Suspending a user account prevents them from logging in' },
  { group: 'مدير النظام (Admin)', id: 'u25', ar: 'إضافة وتعديل وحذف Zone يعمل',                                 en: 'Add, edit, and delete Zone operations work correctly' },
  { group: 'مدير النظام (Admin)', id: 'u26', ar: 'الأقسام تُزامَن تلقائياً من Azure AD',                         en: 'Departments auto-sync from Azure AD on SSO login' },
  { group: 'مدير النظام (Admin)', id: 'u27', ar: 'وضع الصيانة يعمل ويمنع الوصول',                               en: 'Maintenance mode activates and blocks user access' },

  // General UX
  { group: 'تجربة المستخدم العامة', id: 'u28', ar: 'النظام يعمل بشكل صحيح على الجوال (Responsive)',             en: 'System displays correctly on mobile devices (responsive)' },
  { group: 'تجربة المستخدم العامة', id: 'u29', ar: 'تصدير تقرير PDF يعمل ويحتوي بيانات كاملة',                  en: 'PDF export works and contains complete incident data' },
  { group: 'تجربة المستخدم العامة', id: 'u30', ar: 'تبديل اللغة عربي/إنجليزي يعمل بشكل صحيح',                  en: 'Arabic/English language toggle works correctly' },
  { group: 'تجربة المستخدم العامة', id: 'u31', ar: 'انتهاء الجلسة (Session Timeout) يعمل ويُوجّه لتسجيل الدخول', en: 'Session timeout triggers and redirects to login page' },
];

// ── HTML Report Generator ─────────────────────────────────────────────────────
function generateHTML(autoChecks, version) {
  const autoPassed  = autoChecks.filter(c => c.pass).length;
  const autoFailed  = autoChecks.filter(c => !c.pass).length;
  const autoTotal   = autoChecks.length;
  const autoPercent = Math.round((autoPassed / autoTotal) * 100);

  const statusColor  = autoFailed === 0 ? '#10b981' : '#ef4444';
  const statusLabel  = autoFailed === 0 ? 'PASS ✅' : `FAIL ❌ (${autoFailed} failures)`;

  // Group auto checks
  const autoGroups = {};
  autoChecks.forEach(c => { if (!autoGroups[c.group]) autoGroups[c.group] = []; autoGroups[c.group].push(c); });

  // Group UAT items
  const uatGroups = {};
  UAT_ITEMS.forEach(u => { if (!uatGroups[u.group]) uatGroups[u.group] = []; uatGroups[u.group].push(u); });

  const autoGroupsHtml = Object.entries(autoGroups).map(([grp, items]) => `
    <tr class="group-header"><td colspan="3">${grp}</td></tr>
    ${items.map(c => `
    <tr class="${c.pass ? 'pass-row' : 'fail-row'}">
      <td>${c.name}</td>
      <td class="center">${c.pass ? '✅ ناجح' : '❌ فاشل'}</td>
      <td class="detail">${c.detail}</td>
    </tr>`).join('')}
  `).join('');

  const uatGroupsHtml = Object.entries(uatGroups).map(([grp, items]) => `
    <tr class="group-header"><td colspan="4">${grp}</td></tr>
    ${items.map((u, i) => `
    <tr class="uat-row">
      <td class="center id-col">${u.id.toUpperCase()}</td>
      <td>${u.ar}</td>
      <td>${u.en}</td>
      <td class="center result-col">
        <label class="rb-label"><input type="radio" name="${u.id}" value="pass" onclick="updateCount()"> ✅ ناجح</label>
        <label class="rb-label"><input type="radio" name="${u.id}" value="fail" onclick="updateCount()"> ❌ فاشل</label>
        <label class="rb-label"><input type="radio" name="${u.id}" value="na" onclick="updateCount()"> — لا ينطبق</label>
      </td>
    </tr>`).join('')}
  `).join('');

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>تقرير قبول النظام UAT — HSE Incident Platform</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap');
  
  :root {
    --blue: #1e40af; --blue-light: #dbeafe; --green: #10b981; --green-light: #d1fae5;
    --red: #ef4444; --red-light: #fee2e2; --amber: #f59e0b; --slate: #1e293b;
    --gray: #64748b; --border: #e2e8f0;
  }
  
  * { box-sizing: border-box; margin: 0; padding: 0; }
  
  body {
    font-family: 'IBM Plex Sans Arabic', 'Inter', sans-serif;
    background: #f8fafc; color: #1e293b; font-size: 13px; line-height: 1.6;
  }
  
  .page { max-width: 1100px; margin: 0 auto; padding: 30px 24px; }

  /* Cover */
  .cover {
    background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%);
    color: white; padding: 48px 40px; border-radius: 16px; margin-bottom: 30px;
    text-align: center; position: relative; overflow: hidden;
  }
  .cover::before {
    content: ''; position: absolute; inset: 0;
    background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
  }
  .cover-logo { font-size: 48px; margin-bottom: 16px; }
  .cover h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
  .cover h2 { font-size: 16px; font-weight: 400; opacity: 0.7; margin-bottom: 24px; }
  .cover-meta {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;
    background: rgba(255,255,255,0.08); border-radius: 12px; padding: 16px; margin-top: 24px;
  }
  .cover-meta-item { text-align: center; }
  .cover-meta-item .label { font-size: 10px; opacity: 0.6; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
  .cover-meta-item .value { font-size: 14px; font-weight: 600; }

  /* Status Banner */
  .status-banner {
    background: ${autoFailed === 0 ? '#d1fae5' : '#fee2e2'};
    border: 2px solid ${statusColor};
    border-radius: 12px; padding: 16px 24px; margin-bottom: 24px;
    display: flex; align-items: center; gap: 16px;
  }
  .status-icon { font-size: 36px; }
  .status-text h3 { font-size: 18px; font-weight: 700; color: ${statusColor}; }
  .status-text p { color: #475569; font-size: 13px; margin-top: 2px; }

  /* Stats */
  .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 28px; }
  .stat-card {
    background: white; border: 1px solid var(--border); border-radius: 12px;
    padding: 16px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  }
  .stat-number { font-size: 32px; font-weight: 800; }
  .stat-label { font-size: 11px; color: var(--gray); margin-top: 4px; }

  /* Sections */
  .section { margin-bottom: 32px; }
  .section-title {
    font-size: 16px; font-weight: 700; color: var(--slate); padding: 14px 18px;
    background: white; border: 1px solid var(--border); border-radius: 12px 12px 0 0;
    border-bottom: 2px solid var(--blue); display: flex; align-items: center; gap: 10px;
  }
  .section-badge {
    background: var(--blue); color: white; font-size: 11px; font-weight: 600;
    padding: 3px 10px; border-radius: 20px;
  }

  /* Tables */
  table { width: 100%; border-collapse: collapse; background: white; border: 1px solid var(--border); border-top: none; border-radius: 0 0 12px 12px; overflow: hidden; }
  th { background: #f8fafc; padding: 10px 14px; font-weight: 600; font-size: 12px; color: var(--gray); border-bottom: 1px solid var(--border); text-align: right; }
  td { padding: 10px 14px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  .group-header td { background: #f1f5f9; font-weight: 700; color: var(--blue); font-size: 12px; padding: 8px 14px; border-bottom: 1px solid var(--border); }
  .pass-row td { background: #f0fdf4; }
  .fail-row td { background: #fef2f2; }
  .center { text-align: center; }
  .detail { color: var(--gray); font-size: 11px; font-family: monospace; }
  .id-col { width: 50px; font-weight: 700; color: var(--blue); font-size: 11px; }
  .result-col { width: 240px; }
  .rb-label { display: block; cursor: pointer; padding: 2px 0; white-space: nowrap; }
  .rb-label input { margin-left: 4px; }

  /* Progress */
  .progress-bar { background: #e2e8f0; border-radius: 999px; height: 8px; margin: 8px 0; overflow: hidden; }
  .progress-fill { background: ${statusColor}; height: 100%; border-radius: 999px; width: ${autoPercent}%; transition: width 0.3s; }

  /* Signature */
  .sig-section {
    background: white; border: 1px solid var(--border); border-radius: 12px;
    padding: 28px; margin-top: 28px;
  }
  .sig-title { font-size: 16px; font-weight: 700; margin-bottom: 20px; color: var(--slate); }
  .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
  .sig-box {
    border: 1px dashed #94a3b8; border-radius: 10px; padding: 20px;
    min-height: 130px; position: relative;
  }
  .sig-box-label {
    font-weight: 700; font-size: 13px; margin-bottom: 4px; color: var(--slate);
  }
  .sig-box-sub { font-size: 11px; color: var(--gray); margin-bottom: 12px; }
  .sig-line { border-bottom: 1px solid #cbd5e1; margin-top: 50px; padding-bottom: 6px; font-size: 11px; color: var(--gray); }
  .sig-date-line { display: flex; gap: 8px; align-items: center; margin-top: 10px; font-size: 11px; color: var(--gray); }
  .sig-date-field { border-bottom: 1px solid #cbd5e1; flex: 1; min-width: 120px; }

  /* UAT Counter */
  .uat-counter {
    background: var(--blue-light); border: 1px solid #93c5fd; border-radius: 10px;
    padding: 12px 16px; margin-bottom: 14px; display: flex; gap: 20px; align-items: center;
  }
  .uat-counter span { font-size: 13px; font-weight: 600; }

  /* Footer */
  .report-footer {
    text-align: center; font-size: 11px; color: var(--gray); margin-top: 32px;
    padding-top: 16px; border-top: 1px solid var(--border);
  }

  /* Print Styles */
  @media print {
    body { background: white; font-size: 11px; }
    .page { padding: 15px; max-width: 100%; }
    .cover { padding: 24px; }
    .no-print { display: none !important; }
    .section { break-inside: avoid; }
    .sig-section { break-inside: avoid; }
    table { break-inside: auto; }
    tr { break-inside: avoid; }
    .uat-counter { display: none; }
  }

  /* Buttons */
  .btn-print {
    background: var(--blue); color: white; border: none; padding: 12px 28px;
    border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer;
    margin: 0 6px; transition: background 0.2s; font-family: inherit;
  }
  .btn-print:hover { background: #1d4ed8; }
  .action-bar { text-align: center; margin-bottom: 24px; }
</style>
</head>
<body>
<div class="page">

  <!-- Action Bar (no print) -->
  <div class="action-bar no-print">
    <button class="btn-print" onclick="window.print()">🖨️ طباعة / حفظ كـ PDF</button>
    <button class="btn-print" style="background:#475569" onclick="resetAll()">🔄 إعادة ضبط</button>
  </div>

  <!-- Cover Page -->
  <div class="cover">
    <div class="cover-logo">🛡️</div>
    <h1>تقرير قبول النظام وضمان الجودة</h1>
    <h2>HSE Incident Management Platform — UAT & QA Release Acceptance Report</h2>
    <div class="cover-meta">
      <div class="cover-meta-item">
        <div class="label">إصدار النظام</div>
        <div class="value">${version}</div>
      </div>
      <div class="cover-meta-item">
        <div class="label">رقم Commit</div>
        <div class="value">${COMMIT}</div>
      </div>
      <div class="cover-meta-item">
        <div class="label">تاريخ التقرير</div>
        <div class="value">${DATE_STR}</div>
      </div>
      <div class="cover-meta-item">
        <div class="label">الخادم</div>
        <div class="value" style="font-size:11px">${BASE_URL.replace('http://localhost:3000','Production')}</div>
      </div>
    </div>
  </div>

  <!-- Status Banner -->
  <div class="status-banner">
    <div class="status-icon">${autoFailed === 0 ? '✅' : '❌'}</div>
    <div class="status-text">
      <h3>الاختبارات التلقائية: ${statusLabel}</h3>
      <p>${autoPassed} من ${autoTotal} اختبار ناجح — ${autoPercent}% نجاح &nbsp;|&nbsp; ${DATE_EN} ${TIME_STR}</p>
      <div class="progress-bar"><div class="progress-fill"></div></div>
    </div>
  </div>

  <!-- Stats -->
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-number" style="color:var(--blue)">${autoTotal + UAT_ITEMS.length}</div>
      <div class="stat-label">إجمالي الاختبارات</div>
    </div>
    <div class="stat-card">
      <div class="stat-number" style="color:var(--gray)">${autoTotal}</div>
      <div class="stat-label">اختبار تلقائي</div>
    </div>
    <div class="stat-card">
      <div class="stat-number" style="color:var(--amber)">${UAT_ITEMS.length}</div>
      <div class="stat-label">اختبار يدوي (UAT)</div>
    </div>
    <div class="stat-card">
      <div class="stat-number" style="color:var(--green)">${autoPassed}</div>
      <div class="stat-label">اختبار تلقائي ناجح</div>
    </div>
  </div>

  <!-- Section 1: Automated QA -->
  <div class="section">
    <div class="section-title">
      🤖 القسم الأول: الاختبارات التلقائية (Automated QA)
      <span class="section-badge">${autoPassed}/${autoTotal} ناجح</span>
    </div>
    <table>
      <thead>
        <tr>
          <th>الاختبار</th>
          <th class="center" style="width:120px">النتيجة</th>
          <th style="width:120px">التفاصيل</th>
        </tr>
      </thead>
      <tbody>${autoGroupsHtml}</tbody>
    </table>
  </div>

  <!-- Section 2: UAT Manual -->
  <div class="section">
    <div class="section-title">
      👤 القسم الثاني: اختبار قبول المستخدم اليدوي (UAT)
      <span class="section-badge">${UAT_ITEMS.length} حالة اختبار</span>
    </div>
    <div class="uat-counter no-print">
      <span>✅ ناجح: <span id="cnt-pass">0</span></span>
      <span>❌ فاشل: <span id="cnt-fail">0</span></span>
      <span>— لا ينطبق: <span id="cnt-na">0</span></span>
      <span style="color:var(--gray)">⬜ لم يُختبر بعد: <span id="cnt-pending">${UAT_ITEMS.length}</span></span>
    </div>
    <table>
      <thead>
        <tr>
          <th class="center" style="width:50px">#</th>
          <th>الاختبار (عربي)</th>
          <th>Test (English)</th>
          <th class="center" style="width:240px">النتيجة</th>
        </tr>
      </thead>
      <tbody>${uatGroupsHtml}</tbody>
    </table>
  </div>

  <!-- Section 3: Remarks -->
  <div class="section">
    <div class="section-title">📝 القسم الثالث: ملاحظات وتحفظات</div>
    <table>
      <tbody>
        <tr><td style="height:100px; vertical-align:top; padding:14px;">
          <div style="font-size:11px;color:var(--gray);margin-bottom:8px;">اكتب أي ملاحظات أو تحفظات أو مشاكل تم رصدها أثناء الاختبار:</div>
          <div contenteditable="true" style="min-height:70px;border:1px dashed #cbd5e1;border-radius:6px;padding:10px;font-size:12px;" class="no-print" placeholder="اكتب هنا..."></div>
          <div class="print-only" style="min-height:70px;border:1px solid #e2e8f0;border-radius:6px;padding:10px;"></div>
        </td></tr>
      </tbody>
    </table>
  </div>

  <!-- Signature Section -->
  <div class="sig-section">
    <div class="sig-title">✍️ القسم الرابع: التوقيع والاعتماد الرسمي</div>
    <p style="font-size:12px;color:var(--gray);margin-bottom:20px">
      بالتوقيع أدناه، يُقرّ الموقّع بأنه قد راجع نتائج الاختبارات وأن النظام جاهز / غير جاهز للنشر على بيئة الإنتاج.
    </p>
    <div class="sig-grid">
      <div class="sig-box">
        <div class="sig-box-label">🧑‍💼 مقدّم الطلب / ممثل الأعمال</div>
        <div class="sig-box-sub">Business Stakeholder / Product Owner</div>
        <div class="sig-line">الاسم: __________________ &nbsp;&nbsp; الصفة: __________________</div>
        <div class="sig-date-line">
          <span>التوقيع:</span>
          <div class="sig-date-field"></div>
          <span>التاريخ:</span>
          <div class="sig-date-field"></div>
        </div>
      </div>
      <div class="sig-box">
        <div class="sig-box-label">👨‍💻 المطوّر / الفريق التقني</div>
        <div class="sig-box-sub">Technical Lead / Development Team</div>
        <div class="sig-line">الاسم: __________________ &nbsp;&nbsp; الصفة: __________________</div>
        <div class="sig-date-line">
          <span>التوقيع:</span>
          <div class="sig-date-field"></div>
          <span>التاريخ:</span>
          <div class="sig-date-field"></div>
        </div>
      </div>
      <div class="sig-box">
        <div class="sig-box-label">🛡️ مسؤول السلامة / HSE Manager</div>
        <div class="sig-box-sub">HSE Manager / Safety Officer</div>
        <div class="sig-line">الاسم: __________________ &nbsp;&nbsp; الصفة: __________________</div>
        <div class="sig-date-line">
          <span>التوقيع:</span>
          <div class="sig-date-field"></div>
          <span>التاريخ:</span>
          <div class="sig-date-field"></div>
        </div>
      </div>
      <div class="sig-box" style="border-color:var(--blue);background:var(--blue-light)">
        <div class="sig-box-label" style="color:var(--blue)">📋 قرار الإصدار النهائي</div>
        <div class="sig-box-sub">Release Decision</div>
        <div style="display:grid;gap:8px;margin-top:14px">
          <label style="font-weight:600;font-size:14px;cursor:pointer">
            <input type="radio" name="decision" value="approved"> ✅ موافق على النشر — Approved for Release
          </label>
          <label style="font-weight:600;font-size:14px;cursor:pointer">
            <input type="radio" name="decision" value="conditional"> ⚠️ موافق مع تحفظات — Conditional Approval
          </label>
          <label style="font-weight:600;font-size:14px;cursor:pointer">
            <input type="radio" name="decision" value="rejected"> ❌ مرفوض — Rejected
          </label>
        </div>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <div class="report-footer">
    <strong>HSE Incident Management Platform</strong> — Saudi Motorsport Company (SMC)<br>
    تقرير مولَّد تلقائياً بواسطة وكيل QA بتاريخ ${DATE_EN} ${TIME_STR} | Commit: ${COMMIT}
  </div>

</div>

<script>
function updateCount() {
  const items = ${JSON.stringify(UAT_ITEMS.map(u => u.id))};
  let pass = 0, fail = 0, na = 0, pending = 0;
  items.forEach(id => {
    const checked = document.querySelector(\`input[name="\${id}"]:checked\`);
    if (!checked) pending++;
    else if (checked.value === 'pass') pass++;
    else if (checked.value === 'fail') fail++;
    else na++;
  });
  document.getElementById('cnt-pass').textContent = pass;
  document.getElementById('cnt-fail').textContent = fail;
  document.getElementById('cnt-na').textContent = na;
  document.getElementById('cnt-pending').textContent = pending;
}
function resetAll() {
  document.querySelectorAll('input[type="radio"]').forEach(r => r.checked = false);
  updateCount();
}
</script>
</body>
</html>`;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n══════════════════════════════════════════════════════');
  console.log('  🛡️  HSE UAT + QA REPORT GENERATOR');
  console.log(`  Server: ${BASE_URL}`);
  console.log(`  Version: ${VERSION} | Commit: ${COMMIT}`);
  console.log('══════════════════════════════════════════════════════\n');

  console.log('⏳ Running automated QA checks...');
  const autoChecks = await runAutomatedChecks();

  const passed = autoChecks.filter(c => c.pass).length;
  const failed = autoChecks.filter(c => !c.pass).length;
  console.log(`✅ Passed: ${passed}  ❌ Failed: ${failed}\n`);

  if (failed > 0) {
    console.log('FAILURES:');
    autoChecks.filter(c => !c.pass).forEach(c => console.log(`  ❌ [${c.group}] ${c.name}: ${c.detail}`));
    console.log('');
  }

  const html = generateHTML(autoChecks, VERSION);
  const dateTag = NOW.toISOString().slice(0, 10);
  const filename = path.join(REPORT_DIR, `UAT_Report_${dateTag}.html`);
  fs.writeFileSync(filename, html, 'utf8');

  console.log(`\n📄 تقرير الـ UAT جاهز:`);
  console.log(`   ${filename}`);
  console.log('\n   👉 افتح الملف في المتصفح → Ctrl+P → "Save as PDF"');
  console.log('   👉 أو شاركه مباشرة كملف HTML للمراجعة والتوقيع\n');
  console.log(`   UAT Items: ${UAT_ITEMS.length} | Auto Checks: ${autoChecks.length} | Total: ${UAT_ITEMS.length + autoChecks.length}`);
  console.log('══════════════════════════════════════════════════════\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
