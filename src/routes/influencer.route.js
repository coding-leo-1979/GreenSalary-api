// src/routes/influencer.route.js

const express = require('express');
const router = express.Router();
const { verifyToken, verifyRole } = require('../middlewares/auth.middleware');
const { inputCode, readContract, joinContract, readContracts, inputURL, readURL, readMypage, updateMypageProfile, updateMypagePassword } = require('../controllers/influencer.controller');

router.post('/contract/code', verifyToken, verifyRole('influencer'), inputCode);
router.get('/contract/:contractId', verifyToken, verifyRole('influencer'), readContract);
router.post('/contract/:contractId/join', verifyToken, verifyRole('influencer'), joinContract);
router.get('/contract', verifyToken, verifyRole('influencer'), readContracts);

router.post('/contract/:contractId/url', verifyToken, verifyRole('influencer'), inputURL);
router.get('/contract/:contractId/url', verifyToken, verifyRole('influencer'), readURL);

router.get('/mypage', verifyToken, verifyRole('influencer'), readMypage);
router.post('/mypage/profile', verifyToken, verifyRole('influencer'), updateMypageProfile);
router.post('/mypage/password', verifyToken, verifyRole('influencer'), updateMypagePassword);


module.exports = router;