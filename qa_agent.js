#!/usr/bin/env node
/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║          HSE Incident System — QA Deployment Agent          ║
 * ║  Runs automatically after every OCI deployment              ║
 * ║  Covers: Health · Auth · RBAC · API · Frontend · E2E        ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * Usage:
 *   node qa_agent.js                        # default: http://localhost:3000
 *   node qa_agent.js --url=https://hsedev.saudimotorsport.com
 *   node qa_agent.js --url=http://localhost:3000 --email=admin@example.com
 */

'use strict';

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const { execSync } = require('child_process');

// ── Configuration ─────────────────────────────────────────────────────────────
const args        = Object.fromEntries(process.argv.slice(2).map(a => a.replace('--','').split('=')));
const BASE_URL    = (args.url || process.env.QA_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const FRONTEND_URL = (args.frontend || process.env.QA_FRONTEND_URL || BASE_URL.replace(':3000', '')).replace(/\/$/, '');
const ADMIN_TOKEN = args.token || process.env.QA_ADMIN_TOKEN || '';
const NOTIFY_EMAIL= args.email || process.env.QA_NOTIFY_EMAIL || process.env.SMTP_FROM || '';
const REPORT_DIR  = path.join(__dirname, 'qa_reports');
const COMMIT_HASH = (() => { try { return execSync('git rev-parse --short HEAD', { stdio: ['pipe','pipe','ignore'] }).toString().trim(); } catch { return 'unknown'; } })();

if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });

// ── HTTP Helper ────────────────────────────────────────────────────────────────
const request = (url, opts = {}) => new Promise((resolve) => {
  const parsed  = new URL(url);
  const lib     = parsed.protocol === 'https:' ? https : http;
  const options = {
    hostname: parsed.hostname,
    port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
    path:     parsed.pathname + parsed.search,
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
      resolve({ status: res.statusCode, headers: res.headers, body, json, ok: res.statusCode >= 200 && res.statusCode < 300 });
    });
  });
  req.on('error', (e) => resolve({ status: 0, error: e.message, body: '', json: null, ok: false }));
  req.on('timeout', () => { req.destroy(); resolve({ status: 0, error: 'TIMEOUT', body: '', json: null, ok: false }); });
  if (opts.body) req.write(JSON.stringify(opts.body));
  req.end();
});

// ── Test Runner ────────────────────────────────────────────────────────────────
const results = { passed: [], failed: [], warnings: [], startTime: Date.now() };

const pass = (name, detail = '') => {
  results.passed.push({ name, detail });
  process.stdout.write(`  ✅ ${name}${detail ? ' — ' + detail : ''}\n`);
};
const fail = (name, detail = '', critical = false) => {
  results.failed.push({ name, detail, critical });
  process.stdout.write(`  ❌ ${name}${detail ? ' — ' + detail : ''}${critical ? ' [CRITICAL]' : ''}\n`);
};
const warn = (name, detail = '') => {
  results.warnings.push({ name, detail });
  process.stdout.write(`  ⚠️  ${name}${detail ? ' — ' + detail : ''}\n`);
};
const section = (title) => process.stdout.write(`\n${'─'.repeat(60)}\n  ${title}\n${'─'.repeat(60)}\n`);

// ── Test Suites ────────────────────────────────────────────────────────────────

async function testHealth() {
  section('🔵 [1/6] Health & Connectivity');

  // Backend health
  const r = await request(`${BASE_URL}/api/health`);
  if (r.status === 200) pass('Backend /api/health', `status 200`);
  else fail('Backend /api/health', `status ${r.status} — ${r.error || r.body.slice(0,80)}`, true);

  // Maintenance endpoint
  const m = await request(`${BASE_URL}/api/maintenance`);
  if ([200, 304].includes(m.status)) pass('Maintenance endpoint');
  else warn('Maintenance endpoint', `Unexpected status ${m.status}`);

  // Frontend HTML served
  const f = await request(`${FRONTEND_URL}/`);
  if (f.body.includes('<html') || f.body.includes('<!DOCTYPE')) pass('Frontend HTML served');
  else if (f.status === 200) warn('Frontend HTML', 'Response 200 but missing <html> tag');
  else fail('Frontend served', `status ${f.status}`, true);

  // Nginx proxy intact
  if (f.headers && f.headers['server']?.toLowerCase().includes('nginx'))
    pass('Nginx proxy active');
  else if (f.headers)
    warn('Nginx header', 'Server header not found (might be fine)');
}

async function testAuthentication() {
  section('🔐 [2/6] Authentication & Security');

  // Protected endpoint without token → 401
  const noToken = await request(`${BASE_URL}/api/tickets`);
  if (noToken.status === 401) pass('No-token request → 401');
  else fail('No-token protection', `Expected 401 got ${noToken.status}`, true);

  // Fake JWT → 401
  const fakeJwt = await request(`${BASE_URL}/api/tickets`, {
    headers: { Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJmYWtlIn0.invalid' }
  });
  if (fakeJwt.status === 401) pass('Fake JWT → 401');
  else fail('Fake JWT rejected', `Expected 401 got ${fakeJwt.status}`, true);

  // Malformed token
  const malformed = await request(`${BASE_URL}/api/tickets`, {
    headers: { Authorization: 'Bearer not-a-token' }
  });
  if (malformed.status === 401) pass('Malformed token → 401');
  else warn('Malformed token', `Expected 401 got ${malformed.status}`);

  // OTP with invalid email format
  const badEmail = await request(`${BASE_URL}/api/auth/otp/request`, {
    method: 'POST', body: { email: 'not-an-email' }
  });
  if (badEmail.status === 400) pass('Invalid email OTP → 400');
  else warn('Email validation', `Expected 400 got ${badEmail.status}`);

  // SSO redirect endpoint accessible
  const sso = await request(`${BASE_URL}/api/auth/microsoft`);
  // Should redirect (302/301) or return 500 only if MS config missing
  if ([301, 302, 307, 308].includes(sso.status)) pass('SSO redirect endpoint → redirect');
  else if (sso.status === 500) warn('SSO redirect', 'MS credentials may not be configured');
  else warn('SSO endpoint', `Unexpected status ${sso.status}`);
}

async function testRBAC() {
  section('🛡️  [3/6] Role-Based Access Control (RBAC)');

  if (!ADMIN_TOKEN) {
    warn('RBAC tests', 'QA_ADMIN_TOKEN not set — skipping authenticated RBAC tests');
    warn('To enable', 'Set QA_ADMIN_TOKEN in .env or pass --token=<jwt>');
    return;
  }

  const authHeader = { Authorization: `Bearer ${ADMIN_TOKEN}` };

  // Admin can access analytics
  const analytics = await request(`${BASE_URL}/api/analytics`, { headers: authHeader });
  if ([200, 304].includes(analytics.status)) pass('Admin → analytics 200');
  else fail('Admin analytics access', `status ${analytics.status}`);

  // Admin can list users
  const users = await request(`${BASE_URL}/api/users`, { headers: authHeader });
  if ([200, 304].includes(users.status) && Array.isArray(users.json))
    pass('Admin → users list', `${users.json.length} users`);
  else fail('Admin users list', `status ${users.status}`);

  // Admin can list tickets
  const tickets = await request(`${BASE_URL}/api/tickets`, { headers: authHeader });
  if ([200, 304].includes(tickets.status)) pass('Admin → tickets list');
  else fail('Admin tickets list', `status ${tickets.status}`, true);

  // Admin can access departments
  const depts = await request(`${BASE_URL}/api/departments`, { headers: authHeader });
  if ([200, 304].includes(depts.status)) pass('Admin → departments');
  else fail('Admin departments', `status ${depts.status}`);

  // Admin can access zones
  const zones = await request(`${BASE_URL}/api/zones`, { headers: authHeader });
  if ([200, 304].includes(zones.status)) pass('Admin → zones');
  else fail('Admin zones', `status ${zones.status}`);

  // Admin can access notifications
  const notifs = await request(`${BASE_URL}/api/notifications`, { headers: authHeader });
  if ([200, 304].includes(notifs.status)) pass('Admin → notifications');
  else warn('Admin notifications', `status ${notifs.status}`);
}

async function testAPIContracts() {
  section('📋 [4/6] API Response Contracts');

  if (!ADMIN_TOKEN) {
    warn('API contracts', 'QA_ADMIN_TOKEN not set — skipping authenticated API tests');
    return;
  }

  const authHeader = { Authorization: `Bearer ${ADMIN_TOKEN}` };

  // Departments → array with name field
  const depts = await request(`${BASE_URL}/api/departments`, { headers: authHeader });
  if (Array.isArray(depts.json)) {
    pass('Departments response is array', `${depts.json.length} items`);
    if (depts.json.length > 0 && depts.json[0].name)
      pass('Department has name field');
    else if (depts.json.length === 0)
      warn('Departments', 'List is empty — no departments defined');
    else
      fail('Department name field missing', JSON.stringify(depts.json[0]).slice(0,80));
  } else fail('Departments not array', `got: ${typeof depts.json}`);

  // Zones → array
  const zones = await request(`${BASE_URL}/api/zones`, { headers: authHeader });
  if (Array.isArray(zones.json)) pass('Zones response is array', `${zones.json.length} zones`);
  else fail('Zones not array', `got: ${typeof zones.json}`);

  // Analytics → has totalTickets
  const analytics = await request(`${BASE_URL}/api/analytics`, { headers: authHeader });
  if (analytics.json && typeof analytics.json.totalTickets === 'number')
    pass('Analytics has totalTickets', `value: ${analytics.json.totalTickets}`);
  else if (analytics.json && analytics.json.totalTickets !== undefined)
    pass('Analytics totalTickets present');
  else
    warn('Analytics contract', 'totalTickets field missing or unexpected shape');

  // Tickets → array or object with tickets property
  const tickets = await request(`${BASE_URL}/api/tickets`, { headers: authHeader });
  if (Array.isArray(tickets.json))
    pass('Tickets response is array', `${tickets.json.length} tickets`);
  else if (tickets.json?.tickets && Array.isArray(tickets.json.tickets))
    pass('Tickets response has tickets array');
  else
    warn('Tickets contract', `Unexpected shape: ${JSON.stringify(tickets.json || '').slice(0,80)}`);

  // Non-existent ticket → 404
  const notFound = await request(`${BASE_URL}/api/tickets/00000000-0000-0000-0000-000000000000`, { headers: authHeader });
  if ([404, 403].includes(notFound.status)) pass('Non-existent ticket → 404/403');
  else warn('Non-existent ticket', `Expected 404 got ${notFound.status}`);

  // Events endpoint
  const events = await request(`${BASE_URL}/api/events`, { headers: authHeader });
  if ([200, 304].includes(events.status)) pass('Events endpoint');
  else warn('Events endpoint', `status ${events.status}`);

  // Service providers
  const sp = await request(`${BASE_URL}/api/service-providers`, { headers: authHeader });
  if ([200, 304].includes(sp.status)) pass('Service providers endpoint');
  else warn('Service providers', `status ${sp.status}`);
}

async function testFrontendAssets() {
  section('🌐 [5/6] Frontend Assets & Routing');

  // index.html
  const index = await request(`${FRONTEND_URL}/`);
  if (index.status === 200 && (index.body.includes('<html') || index.body.includes('<!DOCTYPE')))
    pass('index.html loads');
  else
    fail('index.html', `status ${index.status}`, true);

  // SPA routing — all routes should return index.html (not 404)
  const routes = ['/login', '/dashboard', '/tickets', '/analytics', '/settings'];
  for (const route of routes) {
    const r = await request(`${FRONTEND_URL}${route}`);
    if ([200, 304].includes(r.status)) pass(`SPA route ${route}`);
    else fail(`SPA route ${route}`, `status ${r.status} — nginx may not be configured for SPA`);
  }

  // No open redirects via API
  const redirect = await request(`${BASE_URL}/api/../etc/passwd`);
  if (redirect.status !== 200) pass('Path traversal blocked');
  else warn('Path traversal', 'Suspicious 200 on traversal attempt');
}

async function testSecurityHeaders() {
  section('🔒 [6/6] Security Headers & Best Practices');

  const r = await request(`${BASE_URL}/api/health`);

  const checks = [
    ['X-Frame-Options or CSP', r.headers['x-frame-options'] || r.headers['content-security-policy']],
    ['X-Content-Type-Options', r.headers['x-content-type-options']],
  ];

  for (const [name, val] of checks) {
    if (val) pass(`Security header: ${name}`, val.slice(0,60));
    else warn(`Missing header: ${name}`, 'Consider adding via helmet.js');
  }

  // CORS — check if restricted
  const corsCheck = await request(`${BASE_URL}/api/health`, {
    headers: { Origin: 'https://evil.example.com' }
  });
  const corsHeader = corsCheck.headers ? corsCheck.headers['access-control-allow-origin'] : null;
  if (!corsHeader || corsHeader === '*')
    warn('CORS', `Allow-Origin is "${corsHeader || 'not set'}" — verify CORS policy`);
  else
    pass('CORS restricted', `Allow-Origin: ${corsHeader}`);

  // Rate limit headers present
  const rl = corsCheck.headers ? (corsCheck.headers['x-ratelimit-limit'] || corsCheck.headers['ratelimit-limit']) : null;
  if (rl) pass('Rate limit headers present');
  else warn('Rate limiting', 'No rate-limit headers detected — verify express-rate-limit is active');
}

// ── Report Generation ──────────────────────────────────────────────────────────
function generateReport() {
  const duration = ((Date.now() - results.startTime) / 1000).toFixed(1);
  const timestamp = new Date().toISOString();
  const total = results.passed.length + results.failed.length + results.warnings.length;
  const criticalFails = results.failed.filter(f => f.critical);

  const report = {
    timestamp,
    commit: COMMIT_HASH,
    baseUrl: BASE_URL,
    duration: `${duration}s`,
    summary: {
      total,
      passed: results.passed.length,
      failed: results.failed.length,
      warnings: results.warnings.length,
      critical: criticalFails.length,
      status: criticalFails.length > 0 ? 'FAIL' : results.failed.length > 0 ? 'WARN' : 'PASS'
    },
    failures: results.failed,
    warnings: results.warnings,
    passed: results.passed,
  };

  // Save JSON report
  const reportFile = path.join(REPORT_DIR, `qa_${timestamp.replace(/[:.]/g,'_')}.json`);
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

  // Console summary
  console.log('\n' + '═'.repeat(60));
  console.log('  QA DEPLOYMENT REPORT');
  console.log('═'.repeat(60));
  console.log(`  Commit   : ${COMMIT_HASH}`);
  console.log(`  Server   : ${BASE_URL}`);
  console.log(`  Duration : ${duration}s`);
  console.log(`  Total    : ${total} checks`);
  console.log(`  ✅ Passed : ${results.passed.length}`);
  console.log(`  ❌ Failed : ${results.failed.length} (${criticalFails.length} critical)`);
  console.log(`  ⚠️  Warnings: ${results.warnings.length}`);
  console.log(`  Status   : ${report.summary.status}`);
  console.log(`  Report   : ${reportFile}`);
  console.log('═'.repeat(60) + '\n');

  if (results.failed.length > 0) {
    console.log('FAILURES:');
    results.failed.forEach(f => console.log(`  • [${f.critical ? 'CRITICAL' : 'ERROR'}] ${f.name}: ${f.detail}`));
    console.log('');
  }
  if (results.warnings.length > 0) {
    console.log('WARNINGS:');
    results.warnings.forEach(w => console.log(`  • ${w.name}: ${w.detail}`));
    console.log('');
  }

  return report;
}

function generateHtmlEmail(report) {
  const statusColor = report.summary.status === 'PASS' ? '#10b981'
    : report.summary.status === 'WARN' ? '#f59e0b' : '#ef4444';

  const rows = (items, icon, color) => items.map(i =>
    `<tr><td style="padding:6px 10px;border-bottom:1px solid #f1f5f9">${icon}</td>
     <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-weight:500">${i.name}</td>
     <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;color:${color};font-size:13px">${i.detail || ''}</td></tr>`
  ).join('');

  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f8fafc;margin:0;padding:20px">
<div style="max-width:700px;margin:0 auto;background:#fff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.1);overflow:hidden">
  <div style="background:${statusColor};padding:24px 30px;color:white">
    <h1 style="margin:0;font-size:22px">🛡️ HSE QA Report — ${report.summary.status}</h1>
    <p style="margin:8px 0 0;opacity:0.9">Commit: <strong>${report.commit}</strong> · ${report.timestamp}</p>
  </div>
  <div style="padding:24px 30px">
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px">
      ${[['Total',report.summary.total,'#64748b'],['✅ Passed',report.summary.passed,'#10b981'],
         ['❌ Failed',report.summary.failed,'#ef4444'],['⚠️ Warnings',report.summary.warnings,'#f59e0b']]
        .map(([l,v,c])=>`<div style="background:#f8fafc;border-radius:8px;padding:14px;text-align:center">
          <div style="font-size:28px;font-weight:bold;color:${c}">${v}</div>
          <div style="font-size:12px;color:#64748b;margin-top:4px">${l}</div></div>`).join('')}
    </div>
    <p style="color:#475569"><strong>Server:</strong> ${report.baseUrl} &nbsp;|&nbsp; <strong>Duration:</strong> ${report.duration}</p>
    ${report.failures.length > 0 ? `
    <h3 style="color:#ef4444;margin:20px 0 10px">❌ Failures (${report.failures.length})</h3>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      ${rows(report.failures, '❌', '#ef4444')}
    </table>` : ''}
    ${report.warnings.length > 0 ? `
    <h3 style="color:#f59e0b;margin:20px 0 10px">⚠️ Warnings (${report.warnings.length})</h3>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      ${rows(report.warnings, '⚠️', '#92400e')}
    </table>` : ''}
    ${report.passed.length > 0 ? `
    <details style="margin-top:20px">
      <summary style="cursor:pointer;color:#64748b;font-size:14px">✅ Passed checks (${report.passed.length}) — click to expand</summary>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:8px">
        ${rows(report.passed, '✅', '#10b981')}
      </table>
    </details>` : ''}
  </div>
  <div style="background:#f8fafc;padding:16px 30px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8">
    HSE Incident System QA Agent · Auto-generated · Do not reply
  </div>
</div></body></html>`;
}

async function sendEmailReport(report) {
  if (!NOTIFY_EMAIL) return;

  // Use nodemailer if available, otherwise log
  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });

    const subject = `[QA] ${report.summary.status} — ${report.summary.failed} failures, ${report.summary.warnings} warnings · ${report.commit}`;
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: NOTIFY_EMAIL,
      subject,
      html: generateHtmlEmail(report),
      text: `QA Report: ${report.summary.status}\nCommit: ${report.commit}\nPassed: ${report.summary.passed}\nFailed: ${report.summary.failed}\nWarnings: ${report.summary.warnings}\nSee attached report.`
    });
    console.log(`  📧 Email report sent to ${NOTIFY_EMAIL}`);
  } catch (e) {
    console.log(`  ⚠️  Email send failed: ${e.message} (nodemailer may not be installed)`);
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log('  🚀 HSE QA DEPLOYMENT AGENT');
  console.log(`  Commit: ${COMMIT_HASH}  |  ${new Date().toLocaleString()}`);
  console.log(`  Target: ${BASE_URL}`);
  console.log('═'.repeat(60));

  await testHealth();
  await testAuthentication();
  await testRBAC();
  await testAPIContracts();
  await testFrontendAssets();
  await testSecurityHeaders();

  const report = generateReport();
  await sendEmailReport(report);

  // Exit with error code if critical failures exist
  const criticalFails = results.failed.filter(f => f.critical);
  if (criticalFails.length > 0) {
    console.log(`\n🔴 CRITICAL FAILURES DETECTED (${criticalFails.length}) — Deployment should be rolled back!\n`);
    process.exit(1); // Non-zero exit triggers rollback in deploy script
  } else if (results.failed.length > 0) {
    console.log(`\n🟡 Non-critical failures detected — deployment kept but review required.\n`);
    process.exit(2); // Warning exit
  } else {
    console.log(`\n🟢 All checks passed — deployment is healthy.\n`);
    process.exit(0);
  }
}

main().catch(e => {
  console.error('QA Agent crashed:', e.message);
  process.exit(1);
});
