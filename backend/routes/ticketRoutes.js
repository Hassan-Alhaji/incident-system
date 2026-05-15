const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/dbUploadMiddleware');
const multer = require('multer');
const fileUpload = multer({ dest: 'uploads/' });

// Import controllers
const { createTicket, getTickets, getTicketById, reporterReply, uploadAttachments } = require('../controllers/ticketCrud');
const { controllerAction, hrAction, departmentAction, controllerFinalReview, safetyManagerAction } = require('../controllers/ticketWorkflow');
const { createActionPlan, getActionPlans, updateActionPlan, deleteActionPlan, uploadActionPlanAttachment, getActionPlanAttachmentContent, deleteActionPlanAttachment, createReminder, getReminders, completeReminder, getTicketQRCode } = require('../controllers/actionPlanController');

const { getUsers, createUser, updateUser, suspendUser, toggleUserStatus, getAnalytics, downloadUserTemplate, importUsers, exportTickets } = require('../controllers/ticketAdmin');

// ===== TICKET CRUD =====
router.route('/tickets')
    .post(protect, createTicket)
    .get(protect, getTickets);

router.get('/tickets/export', protect, exportTickets);

router.route('/tickets/:id')
    .get(protect, getTicketById);

// ===== TICKET WORKFLOW =====
router.put('/tickets/:id/reporter-reply', protect, reporterReply);
router.put('/tickets/:id/controller-action', protect, controllerAction);
router.put('/tickets/:id/hr-action', protect, hrAction);
router.put('/tickets/:id/department-action', protect, departmentAction);
router.put('/tickets/:id/controller-review', protect, controllerFinalReview);
router.put('/tickets/:id/safety-manager', protect, safetyManagerAction);

// ===== ATTACHMENTS =====
router.post('/tickets/:id/attachments', protect, upload.array('files'), uploadAttachments);

// ===== ACTION PLANS =====
router.route('/tickets/:id/action-plans')
    .post(protect, createActionPlan)
    .get(protect, getActionPlans);

router.put('/action-plans/:id', protect, updateActionPlan);
router.delete('/action-plans/:id', protect, deleteActionPlan);

// Action plan file upload — wrap multer errors explicitly
router.post('/action-plans/:id/attachments', protect, (req, res, next) => {
    upload.array('files')(req, res, (err) => {
        if (err) return res.status(400).json({ message: `Upload error: ${err.message}` });
        next();
    });
}, uploadActionPlanAttachment);

// Attachment content served with auth
router.get('/action-plan-attachments/:id/content', protect, getActionPlanAttachmentContent);
router.delete('/action-plan-attachments/:id', protect, deleteActionPlanAttachment);


// ===== QR CODE =====
router.get('/tickets/:id/qrcode', protect, getTicketQRCode);

// ===== REMINDERS =====
router.route('/tickets/:id/reminders')
    .post(protect, createReminder)
    .get(protect, getReminders);

router.put('/reminders/:id/complete', protect, completeReminder);

// ===== USER MANAGEMENT =====
router.route('/users')
    .get(protect, getUsers)
    .post(protect, createUser);

router.get('/users/template', protect, downloadUserTemplate);
router.post('/users/import', protect, fileUpload.single('file'), importUsers);

router.route('/users/:id')
    .put(protect, updateUser)
    .delete(protect, suspendUser);

router.patch('/users/:id/status', protect, toggleUserStatus);

// ===== ANALYTICS =====
router.get('/analytics', protect, getAnalytics);

module.exports = router;
