// src/services/paymentService.js

const blockchainService = require('./blockchainService');

const Influencer = require('../models/influencer');
const Contract = require('../models/contract');
const InfluencerContract = require('../models/influencer_contract');

class PaymentService {
    async executeAutoPay() {
        try {
            // 1. 지급 대상 계약 가져오기
            const influencerContracts = await InfluencerContract.find({
                reward_paid: false,
                review_status: 'APPROVED'
            }).lean();

            const now = new Date();
            const twoDaysAgo = new Date(now.setDate(now.getDate() - 2));

            const eligibleContracts = [];

            for (const ic of influencerContracts) {
                const contract = await Contract.findOne({ id: ic.contract_id }).lean();
                if (!contract) continue;

                const uploadEndDate = new Date(contract.upload_end_date);
                if (uploadEndDate < twoDaysAgo) {
                    const influencer = await Influencer.findOne({ influencerId: ic.influencer_id }).lean();
                    if (!influencer) continue;

                    eligibleContracts.push({
                        influencerContract: ic,
                        contract,
                        influencer
                    });
                }
            }

            if (eligibleContracts.length === 0) {
                return {
                    success: true,
                    message: 'No payments to process',
                    results: []
                };
            }

            const results = [];

            for (const { influencerContract, contract, influencer } of eligibleContracts) {
                try {
                    const paymentResult = await blockchainService.payInfluencer(
                        contract.smartContractId,
                        influencer.influencerId,
                        influencer.wallet_address
                    );

                    await InfluencerContract.updateOne(
                        { _id: influencerContract._id },
                        {
                            reward_paid: true,
                            reward_paid_at: new Date(),
                            payment_tx_hash: paymentResult.transactionHash
                        }
                    );

                    results.push({
                        status: 'success',
                        influencerId: influencer.id,
                        contractId: contract.id,
                        txHash: paymentResult.transactionHash
                    });

                } catch (err) {
                    console.error('❌ Payment error:', err);
                    results.push({
                        status: 'failed',
                        influencerId: influencerContract.influencer_id,
                        contractId: influencerContract.contract_id,
                        error: err.message
                    });
                }
            }

            return {
                success: true,
                message: 'Auto payment finished',
                results
            };

        } catch (err) {
            console.error('❌ executeAutoPay error:', err);
            throw err;
        }
    }

    async payIndividualInfluencer(influencerId, contractId) {
        try {
            const ic = await InfluencerContract.findOne({
                influencer_id: influencerId,
                contract_id: contractId,
                reward_paid: false,
                review_status: 'APPROVED'
            }).lean();

            if (!ic) {
                throw new Error('No eligible influencer contract found');
            }

            const contract = await Contract.findOne({ id: ic.contract_id }).lean();
            const influencer = await Influencer.findOne({ id: ic.influencer_id }).lean();

            if (!contract || !influencer) {
                throw new Error('Related data missing');
            }

            const paymentResult = await blockchainService.payInfluencer(
                contract.smartContractId,
                influencer.influencerId,
                influencer.wallet_address
            );

            await InfluencerContract.updateOne(
                { _id: ic._id },
                {
                    reward_paid: true,
                    reward_paid_at: new Date(),
                    payment_tx_hash: paymentResult.transactionHash
                }
            );

            return {
                success: true,
                message: 'Payment successful',
                txHash: paymentResult.transactionHash
            };

        } catch (err) {
            console.error('❌ payIndividualInfluencer error:', err);
            throw err;
        }
    }
}

module.exports = new PaymentService();