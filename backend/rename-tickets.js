const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

p.$executeRawUnsafe(`UPDATE "Ticket" SET "ticketNo" = REPLACE("ticketNo", 'OC-', 'IC-') WHERE "ticketNo" LIKE 'OC-%'`)
  .then(c => { console.log('Updated', c, 'tickets from OC- to IC-'); process.exit(0); })
  .catch(e => { console.error(e); process.exit(1); });
