// src/services/paymentService.js

const blockchainService = require('./blockchainService');

const Advertiser = require('../models/advertiser');
const Influencer = require('../models/influencer');
const Contract = require('../models/contract');
const InfluencerContract = require('../models/influencer_contract');

// 한국 시간
function nowKST() {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
    const koreaTimeDiff = 9 * 60 * 60 * 1000;
    return new Date(utc + koreaTimeDiff);
}

class PaymentService {
    async executeAutoPay() {
        try {
            // 1. 지급 대상 계약 가져오기 (upload_end_date로부터 2일 지난 계약들)
            const now = nowKST();
            const twoDaysAgo = new Date(now.getTime() - (2 * 24 * 60 * 60 * 1000));

            const expiredContracts = await Contract.find({
                upload_end_date: { $lt: twoDaysAgo },
                refund_processed: { $ne: true } // 이미 환불 처리된 계약은 제외
            }).lean();

            if (expiredContracts.length === 0) {
                return {
                    success: true,
                    message: 'No expired contracts to process',
                    results: []
                };
            }

            const results = [];

            // 2. 각 계약별로 처리
            for (const contract of expiredContracts) {
                try {
                    const contractResult = await this.processContractPayments(contract);
                    results.push(contractResult);
                } catch (err) {
                    console.error(`❌ Contract ${contract.id} processing error:`, err);
                    results.push({
                        contractId: contract.id,
                        status: 'failed',
                        error: err.message,
                        payments: [],
                        refund: null
                    });
                }
            }

            return {
                success: true,
                message: 'Auto payment and refund finished',
                results
            };

        } catch (err) {
            console.error('❌ executeAutoPay error:', err);
            throw err;
        }
    }

    async processContractPayments(contract) {
        try {
            // 1. 해당 계약에서 지급 대상 인플루언서들 찾기
            const eligibleInfluencerContracts = await InfluencerContract.find({
                contract_id: contract.id,
                reward_paid: false,
                review_status: 'APPROVED'
            }).lean();

            const paymentResults = [];

            // 2. 각 인플루언서에게 보수 지급
            for (const ic of eligibleInfluencerContracts) {
                try {
                    // influencer_id로 Influencer 찾기
                    const influencer = await Influencer.findOne({ 
                        influencerId: ic.influencer_id 
                    }).lean();

                    if (!influencer) {
                        console.warn(`Influencer with advertiserId ${ic.influencer_id} not found`);
                        continue;
                    }

                    const paymentResult = await blockchainService.payInfluencer(
                        contract.smartContractId,
                        influencer.influencerId, // 스마트 컨트랙트에서 사용하는 ID
                        influencer.wallet_address
                    );

                    // DB 업데이트
                    await InfluencerContract.updateOne(
                        { _id: ic._id },
                        {
                            reward_paid: true,
                            reward_paid_at: new nowKST(),
                            payment_tx_hash: paymentResult.transactionHash
                        }
                    );

                    paymentResults.push({
                        status: 'success',
                        influencerId: ic.influencer_id,
                        txHash: paymentResult.transactionHash
                    });

                } catch (err) {
                    console.error(`❌ Payment error for influencer ${ic.influencer_id}:`, err);
                    paymentResults.push({
                        status: 'failed',
                        influencerId: ic.influencer_id,
                        error: err.message
                    });
                }
            }

            // 3. 광고주에게 잔액 환불
            let refundResult = null;
            try {
                // advertiser_id로 Advertiser 찾기 (advertiserId 기준)
                const advertiser = await Advertiser.findOne({ 
                    advertiserId: contract.advertiser_id 
                }).lean();

                if (!advertiser) {
                    throw new Error(`Advertiser with advertiserId ${contract.advertiser_id} not found`);
                }

                if (!advertiser.wallet_address) {
                    throw new Error(`Advertiser ${contract.advertiser_id} has no wallet address`);
                }

                const refundTxResult = await blockchainService.refundAdvertiser(
                    contract.smartContractId,
                    advertiser.wallet_address
                );

                // 계약 상태 업데이트
                await Contract.updateOne(
                    { id: contract.id },
                    {
                        refund_processed: true,
                        refund_processed_at: new Date(),
                        refund_tx_hash: refundTxResult.transactionHash
                    }
                );

                refundResult = {
                    status: 'success',
                    advertiserId: contract.advertiser_id,
                    txHash: refundTxResult.transactionHash
                };

            } catch (err) {
                console.error(`❌ Refund error for contract ${contract.id}:`, err);
                refundResult = {
                    status: 'failed',
                    advertiserId: contract.advertiser_id,
                    error: err.message
                };
            }

            return {
                contractId: contract.id,
                status: 'completed',
                payments: paymentResults,
                refund: refundResult
            };

        } catch (err) {
            console.error(`❌ processContractPayments error for contract ${contract.id}:`, err);
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
            const influencer = await Influencer.findOne({ 
                advertiserId: ic.influencer_id 
            }).lean();

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

    // 수동으로 특정 계약의 환불 처리
    async processContractRefund(contractId) {
        try {
            const contract = await Contract.findOne({ 
                id: contractId,
                refund_processed: { $ne: true }
            }).lean();

            if (!contract) {
                throw new Error('Contract not found or already refunded');
            }

            const advertiser = await Advertiser.findOne({ 
                advertiserId: contract.advertiser_id 
            }).lean();

            if (!advertiser || !advertiser.wallet_address) {
                throw new Error('Advertiser not found or has no wallet address');
            }

            const refundResult = await blockchainService.refundAdvertiser(
                contract.smartContractId,
                advertiser.wallet_address
            );

            await Contract.updateOne(
                { id: contractId },
                {
                    refund_processed: true,
                    refund_processed_at: new Date(),
                    refund_tx_hash: refundResult.transactionHash
                }
            );

            return {
                success: true,
                message: 'Refund processed successfully',
                txHash: refundResult.transactionHash
            };

        } catch (err) {
            console.error('❌ processContractRefund error:', err);
            throw err;
        }
    }

    // 계약별 정산 상태 조회
    async getContractPaymentStatus(contractId) {
        try {
            const contract = await Contract.findOne({ id: contractId }).lean();
            if (!contract) {
                throw new Error('Contract not found');
            }

            const influencerContracts = await InfluencerContract.find({
                contract_id: contractId
            }).lean();

            const paymentSummary = {
                totalInfluencers: influencerContracts.length,
                approvedInfluencers: influencerContracts.filter(ic => ic.review_status === 'APPROVED').length,
                paidInfluencers: influencerContracts.filter(ic => ic.reward_paid === true).length,
                pendingPayments: influencerContracts.filter(ic => 
                    ic.review_status === 'APPROVED' && ic.reward_paid === false
                ).length,
                refundProcessed: contract.refund_processed || false,
                refundTxHash: contract.refund_tx_hash || null
            };

            return {
                success: true,
                contractId,
                paymentSummary,
                influencerContracts: influencerContracts.map(ic => ({
                    influencerId: ic.influencer_id,
                    reviewStatus: ic.review_status,
                    rewardPaid: ic.reward_paid,
                    paymentTxHash: ic.payment_tx_hash
                }))
            };

        } catch (err) {
            console.error('❌ getContractPaymentStatus error:', err);
            throw err;
        }
    }
}

module.exports = new PaymentService();