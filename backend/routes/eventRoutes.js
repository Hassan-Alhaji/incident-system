const express = require('express');
const router = express.Router();
const { getEvents, createEvent, updateEvent, deleteEvent } = require('../controllers/eventController');
const { protect } = require('../middleware/authMiddleware');

// Permission gate: ADMIN or user with canManageEvents flag
const canManageEvents = (req, res, next) => {
    if (req.user?.role === 'ADMIN' || req.user?.canManageEvents) return next();
    return res.status(403).json({ message: 'Not authorized to manage events' });
};

router.route('/')
    .get(protect, getEvents)
    .post(protect, canManageEvents, createEvent);

router.route('/:id')
    .patch(protect, canManageEvents, updateEvent)
    .delete(protect, canManageEvents, deleteEvent);

module.exports = router;
