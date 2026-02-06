const express = require('express');
const router = express.Router();
const { verifyReport } = require('../controllers/reportController');

router.get('/:token', verifyReport);

module.exports = router;
