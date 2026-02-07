const express = require('express');
const router = express.Router({ mergeParams: true });
const { submitMedicalReport, getMedicalReport } = require('../controllers/medicalController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.route('/medical-report')
    .post(protect, authorize('ADMIN', 'MEDICAL'), submitMedicalReport)
    .get(protect, authorize('ADMIN', 'MEDICAL'), getMedicalReport);

module.exports = router;
