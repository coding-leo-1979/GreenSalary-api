// src/routes/advetiser.route.js

const express = require('express');
const router = express.Router();
const { verifyToken, verifyRole } = require('../middlewares/auth.middleware');
const { createContract, readContracts, readContract, readInfluencers, payInfluencers, readTransactions, ask, readMypage, updateMypageProfile, updateMypagePassword } = require('../controllers/advertiser.controller');

router.post('/contract', verifyToken, verifyRole('advertiser'), createContract);
router.get('/contract', verifyToken, verifyRole('advertiser'), readContracts);

router.get('/contract/:contractId', verifyToken, verifyRole('advertiser'), readContract);
router.get('/contract/:contractId/influencers', verifyToken, verifyRole('advertiser'), readInfluencers);
router.post('/contract/:contractId/pay', verifyToken, verifyRole('advertiser'), payInfluencers);
router.get('/contract/:contractId/transactions', verifyToken, verifyRole('advertiser'), readTransactions);

router.post('/ask/:joinId', verifyToken, verifyRole('advertiser'), ask);

router.get('/mypage', verifyToken, verifyRole('advertiser'), readMypage);
router.post('/mypage/profile', verifyToken, verifyRole('advertiser'), updateMypageProfile);
router.post('/mypage/password', verifyToken, verifyRole('advertiser'), updateMypagePassword);

module.exports = router;