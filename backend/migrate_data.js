const { PrismaClient } = require('@prisma/client');

// Source: Supabase (Singapore)
const source = new PrismaClient({
  datasources: {
    db: { url: 'postgresql://postgres.ymliwapczkojcbpjmusi:Hana223203!@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true' }
  }
});

// Target: Local PostgreSQL
const target = new PrismaClient();

async function migrate() {
  console.log('Connecting to Supabase...');

  // 1. Zones
  const zones = await source.zone.findMany();
  console.log(`Zones: ${zones.length}`);
  for (const z of zones) {
    await target.zone.upsert({ where: { id: z.id }, update: z, create: z });
  }

  // 2. Departments (depends on Zone)
  const depts = await source.department.findMany();
  console.log(`Departments: ${depts.length}`);
  for (const d of depts) {
    await target.department.upsert({ where: { id: d.id }, update: d, create: d });
  }

  // 3. ServiceProviders (depends on Department)
  const sps = await source.serviceProvider.findMany();
  console.log(`ServiceProviders: ${sps.length}`);
  for (const sp of sps) {
    await target.serviceProvider.upsert({ where: { id: sp.id }, update: sp, create: sp });
  }

  // 4. Users (depends on Department, ServiceProvider)
  const users = await source.user.findMany();
  console.log(`Users: ${users.length}`);
  for (const u of users) {
    await target.user.upsert({ where: { id: u.id }, update: u, create: u });
  }

  // 5. Tickets (depends on User, Department, Zone, ServiceProvider)
  const tickets = await source.ticket.findMany();
  console.log(`Tickets: ${tickets.length}`);
  for (const t of tickets) {
    await target.ticket.upsert({ where: { id: t.id }, update: t, create: t });
  }

  // 6. OffCircuitReports (depends on Ticket)
  const ocrs = await source.offCircuitReport.findMany();
  console.log(`OffCircuitReports: ${ocrs.length}`);
  for (const o of ocrs) {
    await target.offCircuitReport.upsert({ where: { id: o.id }, update: o, create: o });
  }

  // 7. ActionPlans (depends on Ticket, Department)
  const plans = await source.actionPlan.findMany();
  console.log(`ActionPlans: ${plans.length}`);
  for (const p of plans) {
    await target.actionPlan.upsert({ where: { id: p.id }, update: p, create: p });
  }

  // 8. Attachments (depends on Ticket) - includes binary data!
  const atts = await source.attachment.findMany();
  console.log(`Attachments: ${atts.length}`);
  for (const a of atts) {
    await target.attachment.upsert({ where: { id: a.id }, update: a, create: a });
  }

  // 9. ActionPlanAttachments
  const apAtts = await source.actionPlanAttachment.findMany();
  console.log(`ActionPlanAttachments: ${apAtts.length}`);
  for (const a of apAtts) {
    await target.actionPlanAttachment.upsert({ where: { id: a.id }, update: a, create: a });
  }

  // 10. ActivityLogs (depends on Ticket, User)
  const logs = await source.activityLog.findMany();
  console.log(`ActivityLogs: ${logs.length}`);
  for (const l of logs) {
    await target.activityLog.upsert({ where: { id: l.id }, update: l, create: l });
  }

  // 11. Notifications (depends on User)
  const notifs = await source.notification.findMany();
  console.log(`Notifications: ${notifs.length}`);
  for (const n of notifs) {
    await target.notification.upsert({ where: { id: n.id }, update: n, create: n });
  }

  // 12. Reminders (depends on Ticket)
  const rems = await source.reminder.findMany();
  console.log(`Reminders: ${rems.length}`);
  for (const r of rems) {
    await target.reminder.upsert({ where: { id: r.id }, update: r, create: r });
  }

  // 13. Events
  const events = await source.event.findMany();
  console.log(`Events: ${events.length}`);
  for (const e of events) {
    await target.event.upsert({ where: { id: e.id }, update: e, create: e });
  }

  console.log('\n✅ Migration complete!');
  await source.$disconnect();
  await target.$disconnect();
}

migrate().catch(err => {
  console.error('Migration error:', err.message);
  process.exit(1);
});
