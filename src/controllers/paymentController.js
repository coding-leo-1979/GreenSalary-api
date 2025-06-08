// src/controllers/paymentController.js

const paymentService = require('../services/paymentService');
const blockchainService = require('../services/blockchainService');
const paymentScheduler = require('../services/paymentScheduler');

// 자동 지급 실행
exports.autoPay = async (req, res) => {
    try {
        console.log('🚀 Starting auto payment process...');
        
        const result = await paymentService.executeAutoPay();
        
        res.status(200).json(result);
    } catch (error) {
        console.error('Auto payment controller error:', error);
        res.status(500).json({
            success: false,
            message: 'Auto payment failed',
            error: error.message
        });
    }
};

// 수동 자동지급 실행
exports.runManualAutoPay = async (req, res) => {
    try {
        const result = await paymentScheduler.runManually();
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// 개별 지급
exports.payIndividual = async (req, res) => {
    try {
        const { influencerId, contractId } = req.body;
        
        if (!influencerId || !contractId) {
            return res.status(400).json({
                success: false,
                message: 'influencerId and contractId are required'
            });
        }

        const result = await paymentService.payIndividualInfluencer(influencerId, contractId);
        
        res.status(200).json(result);
    } catch (error) {
        console.error('Individual payment error:', error);
        res.status(500).json({
            success: false,
            message: 'Payment failed',
            error: error.message
        });
    }
};

// 블록체인 상태 확인
exports.getBlockchainStatus = async (req, res) => {
    try {
        const status = await blockchainService.getStatus();
        res.status(200).json({
            success: true,
            data: status
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// 컨트랙트 잔액 확인
exports.getContractBalance = async (req, res) => {
    try {
        const balance = await blockchainService.getContractBalance();
        res.status(200).json({
            success: true,
            data: balance
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// 스케줄러 상태 확인
exports.getSchedulerStatus = async (req, res) => {
    try {
        const status = paymentScheduler.getStatus();
        res.status(200).json({
            success: true,
            data: status
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};