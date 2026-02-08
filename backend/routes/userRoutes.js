const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Public-ish routes (Protected but for all roles)
router.use(protect);

router.put('/profile', userController.updateProfile);

// Admin only routes
router.use(authorize('ADMIN', 'CHIEF_OF_CONTROL'));

const upload = require('../middleware/uploadMiddleware');

router.get('/', userController.getUsers);
router.post('/', userController.createUser);
router.put('/:id', userController.updateUser);
router.delete('/:id', userController.deleteUser);
router.post('/import', upload.single('file'), userController.importRegistry);
router.patch('/:id/status', userController.toggleUserStatus);

module.exports = router;
