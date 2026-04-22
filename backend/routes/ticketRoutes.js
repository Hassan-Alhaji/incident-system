const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/dbUploadMiddleware');
const multer = require('multer');
const fileUpload = multer({ dest: 'uploads/' });
const {
    createOCTicket,
    getOCTickets,
    getOCTicketById,
    updateReporterSection,
    submitInvestigation,
    departmentRepAction,
    departmentManagerApprove,
    finalDecision,
    hseControllerAction,
    uploadOCAttachments,
    getOCUsers,
    createOCUser,
    updateOCUser,
    deleteOCUser,
    toggleOCUserStatus,
    getOCAnalytics,
    downloadOCUserTemplate,
    importOCUsers,
    exportOCTickets,
    reporterReply,
    submitHRAction
} = require('../controllers/ocTicketController');

// All routes require authentication

// Ticket routes
router.route('/tickets')
    .post(protect, createOCTicket)
    .get(protect, getOCTickets);

router.get('/tickets/export', protect, exportOCTickets);

router.route('/tickets/:id')
    .get(protect, getOCTicketById);

router.route('/tickets/:id/reporter')
    .put(protect, updateReporterSection);

router.route('/tickets/:id/reporter-reply')
    .put(protect, reporterReply);



router.route('/tickets/:id/hse-action')
    .put(protect, hseControllerAction);

router.route('/tickets/:id/dep-rep')
    .put(protect, departmentRepAction);

router.route('/tickets/:id/investigation')
    .put(protect, submitInvestigation);

router.route('/tickets/:id/dep-manager-approve')
    .put(protect, departmentManagerApprove);

router.route('/tickets/:id/final-review')
    .put(protect, finalDecision);

router.route('/tickets/:id/hr-action')
    .put(protect, submitHRAction);

router.route('/tickets/:id/attachments')
    .post(protect, upload.array('files'), uploadOCAttachments);

// User Management routes (HSE Manager / Admin only)
router.route('/users')
    .get(protect, getOCUsers)
    .post(protect, createOCUser);

// Excel Import/Export routes (MUST be before /users/:id)
router.get('/users/template', protect, downloadOCUserTemplate);
router.post('/users/import', protect, fileUpload.single('file'), importOCUsers);

router.route('/users/:id')
    .put(protect, updateOCUser)
    .delete(protect, deleteOCUser);

router.route('/users/:id/status')
    .patch(protect, toggleOCUserStatus);

// Analytics route
router.route('/analytics')
    .get(protect, getOCAnalytics);

module.exports = router;
