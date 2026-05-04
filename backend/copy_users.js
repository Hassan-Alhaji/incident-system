const { PrismaClient } = require('@prisma/client');

const source = new PrismaClient({
  datasources: {
    db: { url: 'postgresql://postgres.ymliwapczkojcbpjmusi:Hana223203!@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true' }
  }
});
const target = new PrismaClient();

async function main() {
  const users = await source.user.findMany();
  console.log(`Found ${users.length} users on Supabase`);
  let ok = 0, skip = 0;
  for (const u of users) {
    try {
      await target.user.upsert({ where: { id: u.id }, update: u, create: u });
      ok++;
    } catch (e) {
      // Try by email
      try {
        await target.user.upsert({ where: { email: u.email }, update: u, create: u });
        ok++;
      } catch (e2) {
        console.log(`  Skip: ${u.name} (${u.email}) - ${e2.message.slice(0,60)}`);
        skip++;
      }
    }
  }
  console.log(`\nDone! ${ok} copied, ${skip} skipped.`);
  await source.$disconnect();
  await target.$disconnect();
}
main().catch(e => { console.error(e.message); process.exit(1); });
