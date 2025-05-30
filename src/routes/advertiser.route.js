// src/routes/advetiser.route.js

const express = require('express');
const router = express.Router();
const { verifyToken, verifyRole } = require('../middlewares/auth.middleware');
const { createContract, readContracts } = require('../controllers/advertiser.controller');

router.post('/contract', verifyToken, verifyRole('advertiser'), createContract);
router.get('/contract', verifyToken, verifyRole('advertiser'), readContracts);

module.exports = router;