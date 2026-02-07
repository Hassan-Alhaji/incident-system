const prisma = require('../prismaClient');

const getNotifications = async (req, res) => {
    try {
        const notifications = await prisma.notification.findMany({
            where: { userId: req.user.id },
            orderBy: { createdAt: 'desc' },
            take: 50
        });
        res.json(notifications);
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ message: 'Error fetching notifications' });
    }
};

const markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.notification.update({
            where: { id },
            data: { read: true }
        });
        res.json({ message: 'Marked as read' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating notification' });
    }
};

const markAllAsRead = async (req, res) => {
    try {
        await prisma.notification.updateMany({
            where: { userId: req.user.id, read: false },
            data: { read: true }
        });
        res.json({ message: 'All marked as read' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating notifications' });
    }
};

// Utility function to be used by other controllers
const createNotification = async (userId, title, message, type = 'INFO', link = null) => {
    try {
        await prisma.notification.create({
            data: {
                userId,
                title,
                message,
                type,
                link
            }
        });
    } catch (error) {
        console.error('Failed to create notification', error);
    }
};

module.exports = {
    getNotifications,
    markAsRead,
    markAllAsRead,
    createNotification
};
