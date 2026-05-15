const https = require('https');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const TOTAL_CHECKS = 10;
const INTERVAL_MS = 6000; // every 6 seconds = ~1 minute total
let checks = 0;
let passed = 0;
let failed = 0;
const results = [];

async function checkDB() {
  const start = Date.now();
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    const ms = Date.now() - start;
    return { status: 'OK', ms };
  } catch (e) {
    return { status: 'FAIL', ms: Date.now() - start, error: e.message };
  }
}

function checkAPI() {
  return new Promise((resolve) => {
    const start = Date.now();
    const req = https.get('https://incident-system-api-v2.onrender.com/api/health', (res) => {
      res.on('data', () => {});
      res.on('end', () => resolve({ status: res.statusCode === 200 ? 'OK' : 'FAIL', ms: Date.now() - start }));
    });
    req.on('error', (e) => resolve({ status: 'FAIL', ms: Date.now() - start, error: e.message }));
    req.setTimeout(10000, () => { req.destroy(); resolve({ status: 'TIMEOUT', ms: 10000 }); });
  });
}

async function runCheck() {
  checks++;
  const [db, api] = await Promise.all([checkDB(), checkAPI()]);
  const ok = db.status === 'OK' && api.status === 'OK';
  if (ok) passed++; else failed++;
  
  const time = new Date().toLocaleTimeString('en-US', { hour12: false });
  const dbIcon = db.status === 'OK' ? '✅' : '❌';
  const apiIcon = api.status === 'OK' ? '✅' : '❌';
  
  console.log(`[${checks}/${TOTAL_CHECKS}] ${time} | DB: ${dbIcon} ${db.ms}ms | API: ${apiIcon} ${api.ms}ms`);
  results.push({ check: checks, db, api });
  
  if (checks >= TOTAL_CHECKS) {
    const uptime = ((passed / TOTAL_CHECKS) * 100).toFixed(0);
    const avgDbMs = Math.round(results.reduce((s, r) => s + r.db.ms, 0) / TOTAL_CHECKS);
    const avgApiMs = Math.round(results.reduce((s, r) => s + r.api.ms, 0) / TOTAL_CHECKS);
    
    console.log('\n' + '='.repeat(50));
    console.log(`📊 AVAILABILITY REPORT`);
    console.log('='.repeat(50));
    console.log(`Total Checks:  ${TOTAL_CHECKS}`);
    console.log(`Passed:        ${passed} ✅`);
    console.log(`Failed:        ${failed} ❌`);
    console.log(`Uptime:        ${uptime}%`);
    console.log(`Avg DB Latency:  ${avgDbMs}ms`);
    console.log(`Avg API Latency: ${avgApiMs}ms`);
    console.log('='.repeat(50));
    
    if (uptime >= 100) console.log('🟢 EXCELLENT - System is fully stable!');
    else if (uptime >= 80) console.log('🟡 GOOD - Minor intermittent issues');
    else console.log('🔴 UNSTABLE - Significant connectivity problems');
    
    await prisma.$disconnect();
    process.exit(0);
  } else {
    setTimeout(runCheck, INTERVAL_MS);
  }
}

console.log('🔍 Starting availability check (10 tests over ~1 minute)...\n');
runCheck();
