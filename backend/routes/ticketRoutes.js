const express = require('express');
const router = express.Router();
const {
    createTicket,
    getTickets,
    getTicketById,
    updateTicket,
    submitTicket,
    closeTicket,
    uploadAttachments,
    addComment
} = require('../controllers/ticketController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');
const {
    escalateTicket,
    transferTicket,
    returnTicket,
    reopenTicket
} = require('../controllers/workflowController');

const { submitMedicalReport, getMedicalReport } = require('../controllers/medicalController');

const { exportExcel } = require('../controllers/reportController');

router.route('/export-excel').get(protect, exportExcel);

router.route('/')
    .post(protect, createTicket)
    .get(protect, getTickets);

router.route('/:id')
    .get(protect, getTicketById)
    .put(protect, updateTicket);

router.route('/:id/submit').post(protect, submitTicket);
router.route('/:id/close').post(protect, closeTicket);
router.route('/:id/reopen').post(protect, reopenTicket);

router.route('/:id/escalate').post(protect, escalateTicket);
router.route('/:id/transfer').post(protect, transferTicket);
router.route('/:id/return').post(protect, returnTicket);

router.route('/:id/attachments')
    .post(protect, upload.array('files'), uploadAttachments);



router.route('/:id/comments')
    .post(protect, addComment);

router.route('/:id/medical-report')
    .post(protect, submitMedicalReport)
    .get(protect, getMedicalReport);


module.exports = router;
