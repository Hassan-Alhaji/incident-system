const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('admin123', 10);
  await prisma.user.create({
    data: {
      name: 'Admin',
      email: 'admin@smc.com',
      password: hash,
      role: 'ADMIN',
      mobile: '0500000000',
      status: 'ACTIVE'
    }
  });
  console.log('Admin user created: admin@smc.com / admin123');
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
