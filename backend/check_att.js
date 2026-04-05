const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const attachments = await prisma.attachment.findMany({ take: 5, orderBy: { createdAt: 'desc' }, select: { id: true, url: true, mimeType: true, size: true } });
    console.log(attachments);
    if (attachments.length > 0) {
        const withData = await prisma.attachment.findUnique({ where: { id: attachments[0].id }, select: { data: true } });
        console.log("Has data buffer:", withData && withData.data !== null && Buffer.isBuffer(withData.data), "size in DB:", withData && withData.data ? withData.data.length : 0);
    }
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
