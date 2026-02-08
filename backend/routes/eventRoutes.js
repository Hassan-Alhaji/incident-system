const express = require('express');
const router = express.Router();
const { getEvents, createEvent, updateEvent, deleteEvent } = require('../controllers/eventController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.route('/')
    .get(protect, getEvents) // Authenticated users can list
    .post(protect, authorize('ADMIN', 'CHIEF_OF_CONTROL'), createEvent);

router.route('/:id')
    .patch(protect, authorize('ADMIN', 'CHIEF_OF_CONTROL'), updateEvent)
    .delete(protect, authorize('ADMIN', 'CHIEF_OF_CONTROL'), deleteEvent);

module.exports = router;
