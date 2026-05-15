const { PrismaClient } = require('@prisma/client');

const source = new PrismaClient({
  datasources: {
    db: { url: 'postgresql://postgres.ymliwapczkojcbpjmusi:Hana223203!@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true' }
  }
});
const target = new PrismaClient();

async function copy(name, model, findFn, upsertFn) {
  const items = await findFn();
  let ok = 0;
  for (const item of items) {
    try { await upsertFn(item); ok++; } catch(e) { console.log(`  Skip ${name}: ${e.message.slice(0,80)}`); }
  }
  console.log(`${name}: ${ok}/${items.length}`);
}

async function main() {
  console.log('=== Copying from Supabase to Local ===\n');

  await copy('Zones', null,
    () => source.zone.findMany(),
    (z) => target.zone.upsert({ where: { id: z.id }, update: z, create: z })
  );

  await copy('Departments', null,
    () => source.department.findMany(),
    (d) => target.department.upsert({ where: { id: d.id }, update: d, create: d })
  );

  await copy('ServiceProviders', null,
    () => source.serviceProvider.findMany(),
    (sp) => target.serviceProvider.upsert({ where: { id: sp.id }, update: sp, create: sp })
  );

  await copy('Users', null,
    () => source.user.findMany(),
    (u) => target.user.upsert({ where: { id: u.id }, update: u, create: u })
  );

  console.log('\n✅ All done!');
  await source.$disconnect();
  await target.$disconnect();
}
main().catch(e => { console.error(e.message); process.exit(1); });
