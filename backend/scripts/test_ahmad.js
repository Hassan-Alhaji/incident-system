const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const ROLES = { SAFETY_PROCESSORS: ['SAFETY_OP_TEAM', 'OPERATION_SAFETY_TEAM', 'DEPUTY_SAFETY_OFFICER', 'DEPUTY_CHIEF_SAFETY_OFFICER', 'SAFETY_OFFICER_CHIEF', 'CHIEF_SAFETY_OFFICER'] };
    const userId = '7914a8b1-0e23-411b-bfd8-26a322c3dde3'; // Ahmad
    const role = 'OPERATION_SAFETY_TEAM';
    const userGroup = 'IN_CIRCUIT';
    const canViewMedical = false;
    const canViewSafety = true;
    const canViewSport = true;
    
    const orConditions = [
        { createdById: userId },
        { assignedToId: userId }
    ];
    let escalatedRoles = [role];
    if (ROLES.SAFETY_PROCESSORS.includes(role)) escalatedRoles = ROLES.SAFETY_PROCESSORS;
    orConditions.push({ escalatedToRole: { in: escalatedRoles } });

    if (canViewMedical) orConditions.push({ type: 'MEDICAL', status: { not: 'DRAFT' } });
    if (canViewSafety) orConditions.push({ type: 'SAFETY', status: { not: 'DRAFT' } });
    if (canViewSport) orConditions.push({ type: 'SPORT', status: { not: 'DRAFT' } });

    const tickets = await prisma.ticket.findMany({
        where: {
            userGroup: userGroup,
            OR: orConditions
        }
    });

    console.log("Tickets found:", tickets.map(t => t.ticketNo));
}
main().catch(console.error).finally(()=>prisma.$disconnect());
