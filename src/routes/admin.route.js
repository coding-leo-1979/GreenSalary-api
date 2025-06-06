// src/routes/admin.route.js

const express = require('express');
const router = express.Router();
const { verifyToken, verifyRole } = require('../middlewares/auth.middleware');
const {  } = require('../controllers/admin.controller');

// router.post('/contract/code', verifyToken, verifyRole('admin'), inputCode);
// router.get('/contract/:contractId', verifyToken, verifyRole('admin'), readContract);

module.exports = router;