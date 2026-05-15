const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const users = await p.user.count();
  const tickets = await p.ticket.count();
  const depts = await p.department.count();
  const zones = await p.zone.count();
  const logs = await p.activityLog.count();
  const plans = await p.actionPlan.count();
  const attachments = await p.attachment.count();

  console.log('=== Local DB Data ===');
  console.log('Users:', users);
  console.log('Tickets:', tickets);
  console.log('Departments:', depts);
  console.log('Zones:', zones);
  console.log('ActivityLogs:', logs);
  console.log('ActionPlans:', plans);
  console.log('Attachments:', attachments);
  await p.$disconnect();
}
main();
