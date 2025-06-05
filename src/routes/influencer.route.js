// src/routes/influencer.route.js

const express = require('express');
const router = express.Router();
const { verifyToken, verifyRole } = require('../middlewares/auth.middleware');
const { inputCode, readContract, joinContract, readContracts } = require('../controllers/influencer.controller');

router.post('/contract/code', verifyToken, verifyRole('influencer'), inputCode);
router.get('/contract/:contractId', verifyToken, verifyRole('influencer'), readContract);
router.post('/contract/:contractId/join', verifyToken, verifyRole('influencer'), joinContract);
router.get('/contract', verifyToken, verifyRole('influencer'), readContracts);

module.exports = router;