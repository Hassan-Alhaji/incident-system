const prisma = require('../prismaClient');
const logger = require('../lib/logger').child({ module: 'notificationController' });

const getNotifications = async (req, res) => {
    try {
        const notifications = await prisma.notification.findMany({
            where: { userId: req.user.id },
            orderBy: { createdAt: 'desc' },
            take: 50
        });
        res.json(notifications);
    } catch (error) {
        logger.error({ err: error }, 'Error fetching notifications:');
        res.status(500).json({ message: 'Error fetching notifications' });
    }
};

const markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        const notification = await prisma.notification.findUnique({ where: { id } });
        
        if (!notification) return res.status(404).json({ message: 'Notification not found' });
        
        if (notification.userId !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized to mark this notification as read' });
        }

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
        logger.error({ err: error }, 'Failed to create notification');
    }
};

// Utility function to bulk create notifications
const createNotificationsBulk = async (userIds, title, message, type = 'INFO', link = null) => {
    if (!userIds || userIds.length === 0) return;
    try {
        const data = userIds.map(userId => ({
            userId,
            title,
            message,
            type,
            link
        }));
        await prisma.notification.createMany({ data });
    } catch (error) {
        logger.error({ err: error }, 'Failed to bulk create notifications');
    }
};

module.exports = {
    getNotifications,
    markAsRead,
    markAllAsRead,
    createNotification,
    createNotificationsBulk
};
