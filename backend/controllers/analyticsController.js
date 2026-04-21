const prisma = require('../prismaClient');

// @desc    Get Analytics Dashboard Stats
// @route   GET /api/analytics
// @access  Private (Admin or canViewAnalytics)
const getDashboardStats = async (req, res) => {
    try {
        const { role, canViewAnalytics } = req.user;

        if (role !== 'ADMIN' && !canViewAnalytics) {
            return res.status(403).json({ message: 'Not authorized to view analytics' });
        }

        // 1. Overall volume
        const totalTickets = await prisma.ticket.count();
        const ticketsByStatus = await prisma.ticket.groupBy({
            by: ['status'],
            _count: {
                id: true
            }
        });

        // 2. Volume by Type (Category)
        const ticketsByType = await prisma.ticket.groupBy({
            by: ['type'],
            _count: {
                id: true
            }
        });

        // 3. Average closure time by type
        // Prisma doesn't have a direct raw AVG date diff helper across simple SQL in an agnostic way,
        // so we'll fetch closed tickets and calculate manually for reliability.
        const closedTickets = await prisma.ticket.findMany({
            where: {
                status: { in: ['CLOSED', 'RESOLVED'] },
                closedAt: { not: null }
            },
            select: {
                type: true,
                createdAt: true,
                closedAt: true
            }
        });

        const durationsByType = {};
        closedTickets.forEach(t => {
            const durationMs = new Date(t.closedAt).getTime() - new Date(t.createdAt).getTime();
            if (durationMs > 0) {
                if (!durationsByType[t.type]) {
                    durationsByType[t.type] = { sum: 0, count: 0 };
                }
                durationsByType[t.type].sum += durationMs;
                durationsByType[t.type].count++;
            }
        });

        const averageClosureTimeMsByType = {};
        for (const type in durationsByType) {
            averageClosureTimeMsByType[type] = durationsByType[type].sum / durationsByType[type].count;
        }

        // 4. Top Reporters (Marshals)
        const topReportersData = await prisma.ticket.groupBy({
            by: ['createdById'],
            _count: { id: true },
            orderBy: { _count: { id: 'desc' } },
            take: 5
        });

        // Hydrate Reporter Names
        const reporterIds = topReportersData.map(t => t.createdById);
        const users = await prisma.user.findMany({
            where: { id: { in: reporterIds } },
            select: { id: true, name: true, role: true }
        });

        const topReporters = topReportersData.map(t => {
            const user = users.find(u => u.id === t.createdById);
            return {
                id: t.createdById,
                name: user ? user.name : 'Unknown User',
                role: user ? user.role : 'UNKNOWN',
                count: t._count.id
            };
        });

        // 5. Severity/Priority Analysis
        const ticketsByPriority = await prisma.ticket.groupBy({
            by: ['priority'],
            _count: { id: true }
        });

        // 6. Top Incident Locations
        const topLocations = await prisma.ticket.groupBy({
            by: ['location'],
            _count: { id: true },
            orderBy: { _count: { id: 'desc' } },
            take: 5
        });

        // 7. Top Service Providers
        const topServiceProvidersData = await prisma.ticket.groupBy({
            by: ['serviceProviderId'],
            where: { serviceProviderId: { not: null } },
            _count: { id: true },
            orderBy: { _count: { id: 'desc' } },
            take: 5
        });

        const spIds = topServiceProvidersData.map(sp => sp.serviceProviderId);
        const serviceProviders = await prisma.serviceProvider.findMany({
            where: { id: { in: spIds } },
            select: { id: true, name: true, commercialRegistrationNumber: true, status: true, department: { select: { id: true, name: true } } }
        });

        const topServiceProviders = topServiceProvidersData.map(sp => {
            const match = serviceProviders.find(p => p.id === sp.serviceProviderId);
            return {
                id: sp.serviceProviderId,
                name: match ? match.name : 'Unknown SP',
                commercialRegistrationNumber: match ? match.commercialRegistrationNumber : 'N/A',
                status: match ? match.status : 'UNKNOWN',
                departmentName: match?.department ? match.department.name : 'N/A',
                count: sp._count.id
            };
        });

        // 8. Top Departments (aggregated by serviceProvider's department or Ticket's direct department if we had one)
        // Currently, incidents are grouped by the responsible department of the service provider.
        const topDepartments = {};
        for(const sp of topServiceProvidersData) {
             const match = serviceProviders.find(p => p.id === sp.serviceProviderId);
             if (match && match.department) {
                const depName = match.department.name;
                if (!topDepartments[depName]) topDepartments[depName] = 0;
                topDepartments[depName] += sp._count.id;
             }
        }
        
        const topDepartmentsArray = Object.keys(topDepartments).map(name => ({
            name,
            count: topDepartments[name]
        })).sort((a,b) => b.count - a.count).slice(0, 5);

        // Compile Response Payload
        const analyticsData = {
            totalTickets,
            statusDistribution: ticketsByStatus.reduce((acc, curr) => ({ ...acc, [curr.status]: curr._count.id }), {}),
            typeDistribution: ticketsByType.reduce((acc, curr) => ({ ...acc, [curr.type]: curr._count.id }), {}),
            priorityDistribution: ticketsByPriority.reduce((acc, curr) => ({ ...acc, [curr.priority || 'NORMAL']: curr._count.id }), {}),
            averageClosureTimeMsByType,
            topReporters,
            topLocations: topLocations.filter(l => l.location).map(l => ({ name: l.location, count: l._count.id })),
            topServiceProviders,
            topDepartments: topDepartmentsArray
        };

        res.json(analyticsData);
    } catch (error) {
        console.error('Analytics Error:', error);
        res.status(500).json({ message: 'Failed to fetch analytics' });
    }
};

module.exports = {
    getDashboardStats
};
