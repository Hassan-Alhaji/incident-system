const { PrismaClient } = require('@prisma/client');
const logger = require('../lib/logger').child({ module: 'eventController' });
const prisma = new PrismaClient();

// Get all events
exports.getEvents = async (req, res) => {
    try {
        const { active } = req.query;
        const where = {};

        if (active === 'true') {
            where.status = 'ACTIVE';
        }

        const events = await prisma.event.findMany({
            where,
            orderBy: { createdAt: 'desc' }
        });

        res.json(events);
    } catch (error) {
        logger.error({ err: error }, 'Error fetching events:');
        res.status(500).json({ error: 'Failed to fetch events' });
    }
};

// Create a new event
exports.createEvent = async (req, res) => {
    try {
        const { nameEn, nameAr, status } = req.body;

        if (!nameEn || !nameAr) {
            return res.status(400).json({ error: 'Both English and Arabic names are required' });
        }

        const event = await prisma.event.create({
            data: {
                nameEn,
                nameAr,
                status: status || 'ACTIVE'
            }
        });

        res.status(201).json(event);
    } catch (error) {
        // Unique constraint violation P2002
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Event name must be unique' });
        }
        logger.error({ err: error }, 'Error creating event:');
        res.status(500).json({ error: 'Failed to create event' });
    }
};

// Update event (e.g., status)
exports.updateEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const { nameEn, nameAr, status } = req.body;

        const event = await prisma.event.update({
            where: { id },
            data: {
                ...(nameEn && { nameEn }),
                ...(nameAr && { nameAr }),
                ...(status && { status })
            }
        });

        res.json(event);
    } catch (error) {
        logger.error({ err: error }, 'Error updating event:');
        res.status(500).json({ error: 'Failed to update event' });
    }
};

// Delete event
exports.deleteEvent = async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.event.delete({
            where: { id }
        });

        res.json({ message: 'Event deleted successfully' });
    } catch (error) {
        logger.error({ err: error }, 'Error deleting event:');
        res.status(500).json({ error: 'Failed to delete event' });
    }
};
