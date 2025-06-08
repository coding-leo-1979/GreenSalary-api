// src/routes/payment.js

const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

// 자동 지급 실행
router.post('/auto-pay', paymentController.autoPay);

// 개별 지급
router.post('/pay-individual', paymentController.payIndividual);

// 블록체인 상태 확인
router.get('/blockchain/status', paymentController.getBlockchainStatus);

// 컨트랙트 잔액 확인
router.get('/contract/balance', paymentController.getContractBalance);

// 수동 자동지급 실행
router.post('/manual-auto-pay', paymentController.runManualAutoPay);

// 스케줄러 상태 확인
router.get('/scheduler/status', paymentController.getSchedulerStatus)

module.exports = router;