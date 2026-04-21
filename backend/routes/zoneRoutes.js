const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { protect } = require('../middleware/authMiddleware');

// Get all active zones (Public)
router.get('/', async (req, res) => {
    try {
        const zones = await prisma.zone.findMany({ where: { isActive: true } });
        res.json(zones);
    } catch (e) {
        res.status(500).json({ message: 'Error fetching zones' });
    }
});

// Admin: Create Zone
router.post('/', protect, async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Not authorized' });
        const { name, description, coordinates } = req.body;
        const zone = await prisma.zone.create({
            data: { 
                name, 
                description,
                coordinates: coordinates ? JSON.stringify(coordinates) : null
            }
        });
        res.status(201).json(zone);
    } catch (e) {
        res.status(500).json({ message: 'Error creating zone' });
    }
});

// Admin: Delete (Deactivate) Zone
router.delete('/:id', protect, async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Not authorized' });
        await prisma.zone.update({
            where: { id: req.params.id },
            data: { isActive: false }
        });
        res.json({ message: 'Zone deactivated' });
    } catch (e) {
        res.status(500).json({ message: 'Error deleting zone' });
    }
});

module.exports = router;
