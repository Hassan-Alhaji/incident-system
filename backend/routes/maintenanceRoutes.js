const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { protect, authorize } = require('../middleware/authMiddleware');

const FILE = path.join(__dirname, '..', 'maintenance.json');

// Helper: read maintenance state
const readState = () => {
    try {
        return JSON.parse(fs.readFileSync(FILE, 'utf-8'));
    } catch {
        return { enabled: false, message: '', updatedAt: null };
    }
};

// Helper: write maintenance state
const writeState = (state) => {
    fs.writeFileSync(FILE, JSON.stringify(state, null, 2), 'utf-8');
};

// GET /api/maintenance — Public (no auth required)
// Returns the current maintenance mode status
router.get('/', (req, res) => {
    const state = readState();
    res.json({ enabled: state.enabled, message: state.message || '' });
});

// PUT /api/maintenance — Admin only
// Toggle maintenance mode on/off
router.put('/', protect, authorize('ADMIN', 'OC_HSE_MANAGER'), (req, res) => {
    const { enabled, message } = req.body;
    const state = {
        enabled: Boolean(enabled),
        message: message || '',
        updatedAt: new Date().toISOString(),
        updatedBy: req.user?.name || 'Unknown',
    };
    writeState(state);
    res.json({ success: true, ...state });
});

module.exports = router;
