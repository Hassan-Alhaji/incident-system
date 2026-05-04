const prisma = require('./prismaClient');

(async () => {
  // Get all tickets with their type and current rcaRequired
  const tickets = await prisma.ticket.findMany({
    select: { id: true, ticketNo: true, type: true, offCircuitReport: { select: { id: true, rcaRequired: true } } }
  });

  let fixed = 0;
  for (const t of tickets) {
    if (!t.offCircuitReport) continue;
    const shouldRequire = t.type !== 'OBSERVATION';
    if (t.offCircuitReport.rcaRequired !== shouldRequire) {
      await prisma.offCircuitReport.update({
        where: { id: t.offCircuitReport.id },
        data: { rcaRequired: shouldRequire }
      });
      console.log(`${t.ticketNo} (${t.type}): rcaRequired ${t.offCircuitReport.rcaRequired} -> ${shouldRequire}`);
      fixed++;
    }
  }

  console.log(`\nDone. Updated ${fixed} ticket(s) out of ${tickets.length} total.`);
  await prisma.$disconnect();
})();
