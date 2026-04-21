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

// Get all departments
router.get('/', protect, async (req, res) => {
    try {
        const departments = await prisma.department.findMany({
            include: {
                manager: { select: { id: true, name: true, email: true, mobile: true } },
                representatives: { select: { id: true, name: true, email: true, mobile: true } }
            }
        });
        res.json(departments);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Error fetching departments' });
    }
});

// Admin adds a department
router.post('/', protect, async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN' && req.user.role !== 'HSE_CONTROLLER' && req.user.role !== 'OC_HSE_MANAGER') return res.status(403).json({ message: 'Not authorized' });
        const { nameEn, nameAr, manager, representatives } = req.body;
        
        if (!nameEn) return res.status(400).json({ message: 'English name is required.' });

        // 1. Provision Manager
        let managerId = null;
        if (manager && manager.name && manager.email) {
             const mUser = await provisionUser(manager, 'DEP_MANAGER');
             if (mUser) managerId = mUser.id;
        }

        // 2. Create the Department
        let dept = await prisma.department.create({ 
            data: { 
                name: nameEn, 
                nameAr: nameAr || null,
                managerId: managerId
            }
        });

        // 3. Provision Representatives and assign them to department
        if (representatives && Array.isArray(representatives)) {
             for (const rep of representatives) {
                 const rUser = await provisionUser(rep, 'DEP_REP');
                 if (rUser) {
                     await prisma.user.update({
                         where: { id: rUser.id },
                         data: { repDepartmentId: dept.id }
                     });
                 }
             }
        }

        const freshDept = await prisma.department.findUnique({
            where: { id: dept.id },
            include: {
                manager: { select: { id: true, name: true } },
                representatives: { select: { id: true, name: true } }
            }
        });
        res.status(201).json(freshDept);
    } catch (e) {
        console.error(e);
        if (e.code === 'P2002') return res.status(400).json({ message: 'Department email or name must be unique' });
        res.status(500).json({ message: 'Error creating department' });
    }
});

// Update department
router.put('/:id', protect, async (req, res) => {
    // Basic implementation to avoid crashing, can be expanded later
    try {
        if (req.user.role !== 'ADMIN' && req.user.role !== 'HSE_CONTROLLER' && req.user.role !== 'OC_HSE_MANAGER') return res.status(403).json({ message: 'Not authorized' });
        const dept = await prisma.department.update({
            where: { id: req.params.id },
            data: { name: req.body.nameEn || req.body.name }
        });
        res.json(dept);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Error updating' });
    }
});

// Delete department
router.delete('/:id', protect, async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN' && req.user.role !== 'HSE_CONTROLLER' && req.user.role !== 'OC_HSE_MANAGER') return res.status(403).json({ message: 'Not authorized' });
        await prisma.department.delete({ where: { id: req.params.id } });
        res.json({ message: 'Removed' });
    } catch (e) {
        res.status(500).json({ message: 'Error removing department' });
    }
});

module.exports = router;
