const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Truncating tables...');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Ticket" CASCADE;');
  console.log('Database truncated!');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
