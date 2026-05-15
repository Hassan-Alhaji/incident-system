const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const ticket = await prisma.ticket.findFirst();
        console.log("Ticket ID:", ticket?.id);
        
        if (ticket) {
            await prisma.ticket.update({
                where: { id: ticket.id },
                data: { type: 'ACCIDENT' }
            });
            console.log("Successfully updated to ACCIDENT");
        }
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
