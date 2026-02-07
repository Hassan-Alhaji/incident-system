const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Get all events
exports.getEvents = async (req, res) => {
    try {
        const { active } = req.query;
        const where = {};

        if (active === 'true') {
            where.isActive = true;
        }

        const events = await prisma.event.findMany({
            where,
            orderBy: { createdAt: 'desc' }
        });

        res.json(events);
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({ error: 'Failed to fetch events' });
    }
};

// Create a new event
exports.createEvent = async (req, res) => {
    try {
        const { name, isActive } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Event name is required' });
        }

        const event = await prisma.event.create({
            data: {
                name,
                isActive: isActive !== undefined ? isActive : true
            }
        });

        res.status(201).json(event);
    } catch (error) {
        // Unique constraint violation P2002
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Event name must be unique' });
        }
        console.error('Error creating event:', error);
        res.status(500).json({ error: 'Failed to create event' });
    }
};

// Update event (e.g., status)
exports.updateEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, isActive } = req.body;

        const event = await prisma.event.update({
            where: { id },
            data: {
                ...(name && { name }),
                ...(isActive !== undefined && { isActive })
            }
        });

        res.json(event);
    } catch (error) {
        console.error('Error updating event:', error);
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
        console.error('Error deleting event:', error);
        res.status(500).json({ error: 'Failed to delete event' });
    }
};
