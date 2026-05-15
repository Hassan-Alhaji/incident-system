const prisma = require('./prismaClient');

(async () => {
  const t = await prisma.ticket.findFirst({
    where: { ticketNo: 'INC-2026-00001' },
    include: {
      offCircuitReport: {
        select: { rcaRequired: true, rcaCompleted: true, severity: true, whatHappened: true }
      },
      department: { select: { name: true, nameAr: true } },
      actionPlans: { select: { type: true, status: true } },
      createdBy: { select: { name: true } },
    }
  });
  if (!t) { console.log('NOT FOUND'); } 
  else {
    console.log(JSON.stringify({
      ticketNo: t.ticketNo,
      type: t.type,
      status: t.status,
      severity: t.severityLevel,
      hasInjury: t.hasInjury,
      department: t.department?.nameAr || t.department?.name,
      reporter: t.createdBy?.name,
      created: t.createdAt,
      rca: { required: t.offCircuitReport?.rcaRequired, completed: t.offCircuitReport?.rcaCompleted },
      actionPlans: t.actionPlans?.map(p => ({ type: p.type, status: p.status })),
    }, null, 2));
  }
  await prisma.$disconnect();
})();
