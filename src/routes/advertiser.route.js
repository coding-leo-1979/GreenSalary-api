// src/routes/advetiser.route.js

const express = require('express');
const router = express.Router();
const { verifyToken, verifyRole } = require('../middlewares/auth.middleware');
const { createContract, readContracts, readContract, readInfluencers } = require('../controllers/advertiser.controller');

router.post('/contract', verifyToken, verifyRole('advertiser'), createContract);
router.get('/contract', verifyToken, verifyRole('advertiser'), readContracts);
router.get('/contract/:contractId', verifyToken, verifyRole('advertiser'), readContract);
router.get('/contract/:contractId/influencers', verifyToken, verifyRole('advertiser'), readInfluencers);


module.exports = router;