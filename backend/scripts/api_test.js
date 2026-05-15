const http = require('http');
const jwt = require('jsonwebtoken');

const BASE = 'http://localhost:3000/api';
let TOKEN = '';
let TICKET_ID = '';
const results = [];

// Generate a valid JWT for testing (using the same secret from .env)
function generateTestToken(userId, role) {
  const secret = '9a94eb94d8a90df75d775f5058c6ef997b0f608535b720e3f2426ac8cfad8ba9efe53fcbab6ef26af3c2ebe5168fd6941949383a81f67f6062a6449cf234da0a';
  return jwt.sign({ id: userId, role }, secret, { expiresIn: '1h' });
}

function req(method, path, body = null) {
  return new Promise((resolve) => {
    const url = new URL(BASE + path);
    const opts = {
      hostname: url.hostname, port: url.port, path: url.pathname + url.search,
      method, headers: { 'Content-Type': 'application/json' }
    };
    if (TOKEN) opts.headers['Authorization'] = `Bearer ${TOKEN}`;
    const r = http.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        let json;
        try { json = JSON.parse(data); } catch { json = data; }
        resolve({ status: res.statusCode, data: json });
      });
    });
    r.on('error', (e) => resolve({ status: 0, data: e.message }));
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

function log(test, status, expected, detail = '') {
  const pass = expected.includes(status);
  results.push({ test, status, pass, detail });
  console.log(`${pass ? '✅' : '❌'} ${test} — ${status} ${detail}`);
}

async function run() {
  console.log('================================================');
  console.log('  Backend API Integration Test (Local DB)');
  console.log('================================================\n');

  // 1. Health check
  let r = await req('GET', '/health');
  log('Health Check', r.status, [200]);

  // 2. Get a user from DB to create a valid JWT
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  
  // Find admin or controller user
  let testUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!testUser) testUser = await prisma.user.findFirst({ where: { role: 'HSE_CONTROLLER' } });
  if (!testUser) testUser = await prisma.user.findFirst();
  
  if (!testUser) {
    console.log('❌ No users in database!');
    await prisma.$disconnect();
    return;
  }
  
  console.log(`📌 Testing as: ${testUser.name} (${testUser.role})\n`);
  TOKEN = generateTestToken(testUser.id, testUser.role);

  // 3. Auth - OTP request
  r = await req('POST', '/auth/otp/request', { email: testUser.email });
  log('POST /auth/otp/request', r.status, [200], `→ OTP sent to ${testUser.email}`);

  // 4. Auth - bad token
  const old = TOKEN;
  TOKEN = 'invalid-token';
  r = await req('GET', '/tickets');
  log('Auth guard (bad token)', r.status, [401, 403], '→ should reject');
  TOKEN = old;

  // === CORE READ ENDPOINTS ===
  console.log('\n--- Read Endpoints ---');

  const t0 = Date.now();
  r = await req('GET', '/tickets');
  const ticketMs = Date.now() - t0;
  const ticketCount = Array.isArray(r.data) ? r.data.length : (r.data?.tickets?.length || 0);
  log('GET /tickets', r.status, [200], `→ ${ticketCount} tickets (${ticketMs}ms)`);

  r = await req('GET', '/departments');
  log('GET /departments', r.status, [200], `→ ${Array.isArray(r.data) ? r.data.length : '?'} depts`);

  r = await req('GET', '/zones');
  log('GET /zones', r.status, [200], `→ ${Array.isArray(r.data) ? r.data.length : '?'} zones`);

  r = await req('GET', '/users');
  log('GET /users', r.status, [200], `→ ${Array.isArray(r.data) ? r.data.length : '?'} users`);

  r = await req('GET', '/service-providers');
  log('GET /service-providers', r.status, [200], `→ ${Array.isArray(r.data) ? r.data.length : '?'} providers`);

  r = await req('GET', '/notifications');
  log('GET /notifications', r.status, [200]);

  r = await req('GET', '/events');
  log('GET /events', r.status, [200]);

  // === ADMIN ANALYTICS ===
  console.log('\n--- Admin/Analytics ---');
  r = await req('GET', '/admin/analytics');
  log('GET /admin/analytics', r.status, [200], `→ tickets: ${r.data?.totalTickets ?? '?'}`);

  // === WRITE: Create Ticket ===
  console.log('\n--- Write Endpoints ---');

  // Need a reporter user for creating tickets
  let reporter = await prisma.user.findFirst({ where: { role: 'OC_REPORTER' } });
  if (reporter) {
    TOKEN = generateTestToken(reporter.id, reporter.role);
    r = await req('POST', '/tickets', {
      incidentType: 'OBSERVATION',
      incidentDate: new Date().toISOString().split('T')[0],
      incidentTime: '10:00',
      whatHappened: 'API test ticket - safe to delete',
      hasInjury: false
    });
    if (r.status === 201 && r.data?.id) {
      TICKET_ID = r.data.id;
      log('POST /tickets (create)', r.status, [201], `→ ${r.data.ticketNo}`);
    } else {
      log('POST /tickets (create)', r.status, [201], `→ ${JSON.stringify(r.data).slice(0,100)}`);
    }
    TOKEN = generateTestToken(testUser.id, testUser.role);
  } else {
    console.log('⚠️  No OC_REPORTER user found — skipping ticket creation');
  }

  // Get single ticket
  if (TICKET_ID) {
    const t1 = Date.now();
    r = await req('GET', `/tickets/${TICKET_ID}`);
    const detailMs = Date.now() - t1;
    log('GET /tickets/:id', r.status, [200], `→ ${r.data?.ticketNo} (${detailMs}ms)`);
  }

  // === SPEED SUMMARY ===
  console.log('\n--- Speed Test ---');
  const speeds = [];
  for (let i = 0; i < 3; i++) {
    const s = Date.now();
    await req('GET', '/tickets');
    speeds.push(Date.now() - s);
  }
  const avg = Math.round(speeds.reduce((a,b) => a+b, 0) / speeds.length);
  log(`AVG GET /tickets (3 runs)`, 200, [200], `→ ${avg}ms ${avg < 200 ? '🚀 EXCELLENT' : avg < 500 ? '⚡ GOOD' : avg < 2000 ? '👍 OK' : '🐌 SLOW'}`);

  // === SUMMARY ===
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log('\n================================================');
  console.log(`  Results: ${passed} ✅ passed, ${failed} ❌ failed`);
  console.log('================================================');
  if (failed > 0) {
    console.log('\nFailed:');
    results.filter(r => !r.pass).forEach(r => console.log(`  ❌ ${r.test} (${r.status}) ${r.detail}`));
  }

  await prisma.$disconnect();
}

run();
