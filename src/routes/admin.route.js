// src/routes/admin.route.js

const express = require('express');
const router = express.Router();
const { verifyToken, verifyRole } = require('../middlewares/auth.middleware');
const { readAsks, readAsk, approveAsk, rejectAsk } = require('../controllers/admin.controller');

router.get('/ask', verifyToken, verifyRole('admin'), readAsks);
router.get('/ask/:askId', verifyToken, verifyRole('admin'), readAsk);

router.post('/ask/:askId/approve', verifyToken, verifyRole('admin'), approveAsk);
router.post('/ask/:askId/reject', verifyToken, verifyRole('admin'), rejectAsk);

module.exports = router;