const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function test() {
  try {
    const result = await p.$queryRawUnsafe('SELECT 1 as test');
    console.log('✅ DB Connected OK:', JSON.stringify(result));
  } catch (e) {
    console.log('❌ DB Error:', e.message);
  } finally {
    await p.$disconnect();
  }
}

test();
