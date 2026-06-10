const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { protect, authorize } = require('../middleware/authMiddleware');
const bcrypt = require('bcryptjs');

// Detect special department types by name pattern to assign correct role
const FINANCE_PATTERN = /financ|مالي|حساب/i;
const HR_PATTERN = /human\s*resource|موارد\s*بشري|hr/i;

function resolveRepRole(deptName, deptNameAr) {
    const combined = `${deptName || ''} ${deptNameAr || ''}`;
    if (FINANCE_PATTERN.test(combined)) return 'FINANCE_REP';
    if (HR_PATTERN.test(combined)) return 'HR_REP';
    return 'DEP_REP';
}

function resolveManagerRole(deptName, deptNameAr) {
    // Managers always get DEP_MANAGER — special dept type doesn't change this
    return 'DEP_MANAGER';
}

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
router.post('/', protect, authorize('ADMIN', 'HSE_CONTROLLER', 'OC_HSE_MANAGER'), async (req, res) => {
    try {
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
        const repRole = resolveRepRole(nameEn, nameAr);
        if (representatives && Array.isArray(representatives)) {
             for (const rep of representatives) {
                 const rUser = await provisionUser(rep, repRole);
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
router.put('/:id', protect, authorize('ADMIN', 'HSE_CONTROLLER', 'OC_HSE_MANAGER'), async (req, res) => {
    try {
        const { nameEn, nameAr, manager, representatives } = req.body;
        
        // 1. Update basic department info
        const updateData = {};
        if (nameEn) updateData.name = nameEn;
        if (nameAr !== undefined) updateData.nameAr = nameAr || null;

        // 2. Handle manager update
        if (manager && manager.name && manager.email) {
            const mUser = await provisionUser(manager, 'DEP_MANAGER');
            if (mUser) updateData.managerId = mUser.id;
        }

        await prisma.department.update({
            where: { id: req.params.id },
            data: updateData
        });

        // 3. Handle representatives update
        // Resolve correct role: look up existing dept name if nameEn not in payload
        const existingDept = await prisma.department.findUnique({ where: { id: req.params.id }, select: { name: true, nameAr: true } });
        const effectiveName = nameEn || existingDept?.name || '';
        const effectiveNameAr = nameAr !== undefined ? nameAr : (existingDept?.nameAr || '');
        const repRole = resolveRepRole(effectiveName, effectiveNameAr);
        if (representatives && Array.isArray(representatives)) {
            // Disconnect existing reps
            await prisma.user.updateMany({
                where: { repDepartmentId: req.params.id },
                data: { repDepartmentId: null }
            });
            // Provision and connect new reps
            for (const rep of representatives) {
                if (!rep.name || !rep.email) continue;
                const rUser = await provisionUser(rep, repRole);
                if (rUser) {
                    await prisma.user.update({
                        where: { id: rUser.id },
                        data: { repDepartmentId: req.params.id }
                    });
                }
            }
        }

        const freshDept = await prisma.department.findUnique({
            where: { id: req.params.id },
            include: {
                manager: { select: { id: true, name: true, email: true, mobile: true } },
                representatives: { select: { id: true, name: true, email: true, mobile: true } }
            }
        });
        res.json(freshDept);
    } catch (e) {
        console.error('Update department error:', e);
        if (e.code === 'P2002') return res.status(400).json({ message: 'Department name must be unique' });
        res.status(500).json({ message: 'Error updating department' });
    }
});

// Delete department
router.delete('/:id', protect, authorize('ADMIN', 'HSE_CONTROLLER', 'OC_HSE_MANAGER'), async (req, res) => {
    try {
        
        // Check for tickets linked to this department
        const ticketCount = await prisma.ticket.count({ where: { departmentId: req.params.id } });
        if (ticketCount > 0) {
            return res.status(400).json({ message: `Cannot delete: ${ticketCount} ticket(s) are linked to this department. (لا يمكن الحذف: يوجد ${ticketCount} تذكرة مرتبطة بهذا القسم)` });
        }

        // Disconnect representatives from department before deleting
        await prisma.user.updateMany({
            where: { repDepartmentId: req.params.id },
            data: { repDepartmentId: null }
        });

        // Disconnect manager
        await prisma.department.update({
            where: { id: req.params.id },
            data: { managerId: null }
        });

        // Now delete
        await prisma.department.delete({ where: { id: req.params.id } });
        res.json({ message: 'Department removed successfully' });
    } catch (e) {
        console.error('Delete department error:', e);
        res.status(500).json({ message: e.code === 'P2003' ? 'Cannot delete: department has related records.' : 'Error removing department' });
    }
});

module.exports = router;
