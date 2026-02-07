const express = require('express');
const router = express.Router();
const { getEvents, createEvent, updateEvent, deleteEvent } = require('../controllers/eventController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.route('/')
    .get(protect, getEvents) // Authenticated users can list
    .post(protect, authorize('ADMIN'), createEvent); // Only Admins

router.route('/:id')
    .patch(protect, authorize('ADMIN'), updateEvent)
    .delete(protect, authorize('ADMIN'), deleteEvent);

module.exports = router;
