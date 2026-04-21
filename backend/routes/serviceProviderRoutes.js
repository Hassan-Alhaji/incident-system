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
        user = await prisma.user.create({
            data: {
                name: data.name,
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

// Get all service providers
router.get('/', protect, async (req, res) => {
    try {
        const providers = await prisma.serviceProvider.findMany({
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
router.post('/', protect, async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Not authorized' });
        const { name, commercialRegistrationNumber, responsibleDepartmentId, representatives } = req.body;
        
        if (!name || !commercialRegistrationNumber || !responsibleDepartmentId) {
             return res.status(400).json({ message: 'Missing required fields' });
        }

        // 1. Create the Service Provider
        const provider = await prisma.serviceProvider.create({
            data: { 
                name, 
                commercialRegistrationNumber,
                responsibleDepartmentId
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

// Admin blacklists / toggles status of a service provider
router.patch('/:id/status', protect, async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Not authorized' });
        const { status } = req.body; // ACTIVE or BLACKLISTED
        
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

// Delete provider
router.delete('/:id', protect, async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Not authorized' });
        await prisma.serviceProvider.delete({ where: { id: req.params.id } });
        res.json({ message: 'Removed' });
    } catch (e) {
        res.status(500).json({ message: 'Error removing' });
    }
});

module.exports = router;
