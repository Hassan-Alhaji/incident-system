const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { protect } = require('../middleware/authMiddleware');
const bcrypt = require('bcryptjs');

async function provisionUser(data, role) {
    if (!data.name || !data.email) return null;
    let user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) {
        const hashedPassword = await bcrypt.hash('Password123!', 10);
        
        const parts = data.name.trim().split(/\s+/);
        const firstName = parts[0] || '';
        const lastName = parts.length > 1 ? parts.slice(-1)[0] : '';
        const fatherName = parts.length > 2 ? parts.slice(1, -1).join(' ') : '';
        
        user = await prisma.user.create({
            data: {
                name: data.name,
                firstName,
                fatherName,
                lastName,
                email: data.email,
                mobile: data.mobile || null,
                password: hashedPassword,
                role: role,
                isProfileCompleted: true
            }
        });
    } else {
        user = await prisma.user.update({
            where: { id: user.id },
            data: { role: role }
        });
    }
    return user;
}

// Permission gate — ADMIN only
const canManageSPs = (req, res, next) => {
    if (req.user?.role === 'ADMIN') return next();
    return res.status(403).json({ message: 'Not authorized. Only Admins can manage service providers.' });
};

// Get all service providers
router.get('/', protect, async (req, res) => {
    try {
        const { active } = req.query;
        const where = active === 'true' ? { status: 'ACTIVE' } : {};
        const providers = await prisma.serviceProvider.findMany({
            where,
            include: {
                department: true,
                representatives: { select: { id: true, name: true, email: true, mobile: true } }
            }
        });
        res.json(providers);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Error fetching service providers' });
    }
});

// Admin adds a service provider
router.post('/', protect, canManageSPs, async (req, res) => {
    try {
        const { name, nameAr, commercialRegistrationNumber, responsibleDepartmentId,
                representativeName, representativeEmail, representativeMobile,
                representatives } = req.body;

        if (!name || !commercialRegistrationNumber || !responsibleDepartmentId) {
             return res.status(400).json({ message: 'Missing required fields' });
        }

        // 1. Create the Service Provider
        const provider = await prisma.serviceProvider.create({
            data: {
                name,
                nameAr: nameAr || null,
                commercialRegistrationNumber,
                responsibleDepartmentId,
                representativeName: representativeName || null,
                representativeEmail: representativeEmail || null,
                representativeMobile: representativeMobile || null,
            }
        });

        // 2. Provision Representatives and assign to provider
        if (representatives && Array.isArray(representatives)) {
             for (const rep of representatives) {
                 const rUser = await provisionUser(rep, 'SERVICE_PROVIDER_REP');
                 if (rUser) {
                     await prisma.user.update({
                         where: { id: rUser.id },
                         data: { serviceProviderId: provider.id }
                     });
                 }
             }
        }

        const freshProv = await prisma.serviceProvider.findUnique({
            where: { id: provider.id },
             include: { 
                department: true,
                representatives: { select: { id: true, name: true } }
            }
        });

        res.status(201).json(freshProv);
    } catch (e) {
        console.error(e);
        if (e.code === 'P2002') return res.status(400).json({ message: 'Commercial Registration Number or email must be unique' });
        res.status(500).json({ message: 'Error creating service provider' });
    }
});

// Update service provider
router.put('/:id', protect, canManageSPs, async (req, res) => {
    try {
        const { name, nameAr, commercialRegistrationNumber, responsibleDepartmentId,
                representativeName, representativeEmail, representativeMobile,
                representatives } = req.body;

        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (nameAr !== undefined) updateData.nameAr = nameAr;
        if (commercialRegistrationNumber) updateData.commercialRegistrationNumber = commercialRegistrationNumber;
        if (responsibleDepartmentId) updateData.responsibleDepartmentId = responsibleDepartmentId;
        if (representativeName !== undefined)   updateData.representativeName   = representativeName;
        if (representativeEmail !== undefined)  updateData.representativeEmail  = representativeEmail;
        if (representativeMobile !== undefined) updateData.representativeMobile = representativeMobile;

        await prisma.serviceProvider.update({ where: { id: req.params.id }, data: updateData });

        // Handle representatives update
        if (representatives && Array.isArray(representatives)) {
            await prisma.user.updateMany({
                where: { serviceProviderId: req.params.id },
                data: { serviceProviderId: null }
            });
            for (const rep of representatives) {
                if (!rep.name || !rep.email) continue;
                const rUser = await provisionUser(rep, 'SERVICE_PROVIDER_REP');
                if (rUser) {
                    await prisma.user.update({
                        where: { id: rUser.id },
                        data: { serviceProviderId: req.params.id }
                    });
                }
            }
        }

        const freshProv = await prisma.serviceProvider.findUnique({
            where: { id: req.params.id },
            include: { department: true, representatives: { select: { id: true, name: true, email: true, mobile: true } } }
        });
        res.json(freshProv);
    } catch (e) {
        console.error('Update provider error:', e);
        if (e.code === 'P2002') return res.status(400).json({ message: 'CR Number must be unique' });
        res.status(500).json({ message: 'Error updating provider' });
    }
});

// Admin blacklists / toggles status of a service provider
router.patch('/:id/status', protect, canManageSPs, async (req, res) => {
    try {
        const { status } = req.body; // ACTIVE or INACTIVE / BLACKLISTED
        
        const provider = await prisma.serviceProvider.update({
            where: { id: req.params.id },
            data: { status }
        });
        res.json(provider);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Error updating status' });
    }
});

// Get violation history for a service provider (controller-only)
router.get('/:id/violation-history', protect, async (req, res) => {
    try {
        const allowedRoles = ['HSE_CONTROLLER', 'SAFETY_MANAGER', 'OC_HSE_MANAGER', 'ADMIN'];
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const tickets = await prisma.ticket.findMany({
            where: {
                serviceProviderId: req.params.id,
                status: 'CLOSED',
                OR: [
                    { hasFinancialViolation: true },
                    { violationDescription: { not: null } },
                ],
            },
            select: {
                id: true,
                ticketNo: true,
                type: true,
                severityLevel: true,
                hasFinancialViolation: true,
                violationDescription: true,
                violationAmount: true,
                closedAt: true,
                closedBy: true,
            },
            orderBy: { closedAt: 'desc' },
        });

        // Determine violation type from stored fields
        const history = tickets.map(t => ({
            ticketId: t.id,
            ticketNo: t.ticketNo,
            type: t.type,
            severityLevel: t.severityLevel,
            violationType: t.hasFinancialViolation ? 'FINANCIAL' : 'WARNING',
            violationDescription: t.violationDescription,
            violationAmount: t.violationAmount,
            closedAt: t.closedAt,
            closedBy: t.closedBy,
        }));

        res.json(history);
    } catch (e) {
        console.error('Violation history error:', e);
        res.status(500).json({ message: 'Error fetching violation history' });
    }
});

// Delete provider
router.delete('/:id', protect, canManageSPs, async (req, res) => {
    try {
        await prisma.serviceProvider.delete({ where: { id: req.params.id } });
        res.json({ message: 'Removed' });
    } catch (e) {
        res.status(500).json({ message: 'Error removing' });
    }
});

module.exports = router;
