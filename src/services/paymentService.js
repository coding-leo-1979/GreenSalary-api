// src/services/paymentService.js

const blockchainService = require('./blockchainService');

const Advertiser = require('../models/advertiser');
const Influencer = require('../models/influencer');
const Contract = require('../models/contract');
const InfluencerContract = require('../models/influencer_contract');

// 한국 시간으로 Date 객체 반환
function nowKST() {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60 * 1000); // UTC 시간 (밀리초)
    const koreaTimeDiff = 9 * 60 * 60 * 1000; // 한국은 UTC+9
    return new Date(utc + koreaTimeDiff);
}

class PaymentService {
    /**
     * 만료된 계약들에 대해 자동 지급 및 환불을 실행합니다.
     * @returns {Promise<object>} 처리 결과 요약
     */
    async executeAutoPay() {
        try {
            console.log(`⏰ [PaymentService] Starting automatic payment and refund process (KST: ${nowKST().toISOString()})...`);

            // 1. 지급 대상 계약 가져오기 (upload_end_date로부터 2일 지난 계약들)
            const now = new Date();
            const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

            const expiredContracts = await Contract.find({
                upload_end_date: { $lt: twentyFourHoursAgo },
                refund_processed: { $ne: true } // 이미 환불 처리된 계약은 제외
            }).lean();

            if (expiredContracts.length === 0) {
                console.log('✅ [PaymentService] No expired contracts to process.');
                return {
                    success: true,
                    message: 'No expired contracts to process',
                    results: []
                };
            }

            console.log(`🔎 [PaymentService] Found ${expiredContracts.length} expired contracts to process.`);
            const results = [];

            // 2. 각 계약별로 처리
            for (const contract of expiredContracts) {
                try {
                    const contractResult = await this.processContractPayments(contract);
                    results.push(contractResult);
                } catch (err) {
                    console.error(`❌ [PaymentService] Contract ${contract.id} processing error:`, err);
                    results.push({
                        contractId: contract.id,
                        status: 'failed',
                        error: err.message,
                        payments: [],
                        refund: null
                    });
                }
            }

            console.log('✅ [PaymentService] Auto payment and refund process completed.');
            return {
                success: true,
                message: 'Auto payment and refund finished',
                results
            };

        } catch (err) {
            console.error('❌ [PaymentService] executeAutoPay failed:', err);
            throw new Error(`Automatic payment process failed: ${err.message}`);
        }
    }

    /**
     * 단일 계약에 대한 인플루언서 지급 및 광고주 환불을 처리합니다.
     * @param {object} contract - 처리할 계약 문서 (Mongoose lean object)
     * @returns {Promise<object>} 계약 처리 결과
     */
    async processContractPayments(contract) {
        if (!contract || !contract.id || !contract.smartContractId || !contract.advertiser_id) {
            throw new Error('Invalid contract object provided for processing.');
        }

        const contractResult = {
            contractId: contract.id,
            status: 'processing',
            payments: [],
            refund: null
        };

        try {
            console.log(`--- Processing payments for contract ID: ${contract.id} (SmartContractId: ${contract.smartContractId}) ---`);

            // 1. 해당 계약에서 지급 대상 인플루언서들 찾기
            const eligibleInfluencerContracts = await InfluencerContract.find({
                contract_id: contract.id,
                reward_paid: false,
                review_status: 'APPROVED'
            }).lean();

            // 2. 각 인플루언서에게 보수 지급
            for (const ic of eligibleInfluencerContracts) {
                try {
                    const influencer = await Influencer.findOne({
                        influencerId: ic.influencer_id
                    }).lean();

                    if (!influencer) {
                        const errMsg = `Influencer with ID ${ic.influencer_id} not found for contract ${contract.id}. Skipping payment.`;
                        console.warn(`⚠️ [PaymentService] ${errMsg}`);
                        contractResult.payments.push({
                            status: 'skipped',
                            influencerId: ic.influencer_id,
                            error: errMsg
                        });
                        continue;
                    }

                    if (!influencer.wallet_address) {
                        const errMsg = `Influencer ${ic.influencer_id} has no wallet address. Skipping payment for contract ${contract.id}.`;
                        console.warn(`⚠️ [PaymentService] ${errMsg}`);
                        contractResult.payments.push({
                            status: 'skipped',
                            influencerId: ic.influencer_id,
                            error: errMsg
                        });
                        continue;
                    }

                    const paymentResult = await blockchainService.payInfluencer(
                        contract.smartContractId,
                        influencer.influencerId, // 스마트 컨트랙트에서 사용하는 ID
                        influencer.wallet_address
                    );

                    // DB 업데이트
                    await InfluencerContract.updateOne(
                        { _id: ic._id }, // Mongoose의 _id 사용
                        {
                            reward_paid: true,
                            reward_paid_at: new Date(), // 한국 시간으로 통일
                            payment_tx_hash: paymentResult.transactionHash
                        }
                    );

                    contractResult.payments.push({
                        status: 'success',
                        influencerId: ic.influencer_id,
                        txHash: paymentResult.transactionHash
                    });

                } catch (err) {
                    console.error(`❌ [PaymentService] Payment error for influencer ${ic.influencer_id} (Contract ${contract.id}):`, err);
                    contractResult.payments.push({
                        status: 'failed',
                        influencerId: ic.influencer_id,
                        error: err.message
                    });
                }
            }

            // 3. 광고주에게 잔액 환불
            try {
                const advertiser = await Advertiser.findOne({
                    advertiserId: contract.advertiser_id
                }).lean();

                if (!advertiser) {
                    throw new Error(`Advertiser with ID ${contract.advertiser_id} not found for contract ${contract.id}.`);
                }
                if (!advertiser.wallet_address) {
                    throw new Error(`Advertiser ${contract.advertiser_id} has no wallet address for contract ${contract.id}.`);
                }

                const refundTxResult = await blockchainService.refundAdvertiser(
                    contract.smartContractId,
                    advertiser.wallet_address
                );

                await Contract.updateOne(
                    { id: contract.id },
                    {
                        refund_processed: true,
                        refund_processed_at: new Date(), // 한국 시간으로 통일
                        refund_tx_hash: refundTxResult.transactionHash
                    }
                );

                contractResult.refund = {
                    status: 'success',
                    advertiserId: contract.advertiser_id,
                    txHash: refundTxResult.transactionHash
                };

            } catch (err) {
                console.error(`❌ [PaymentService] Refund error for contract ${contract.id}:`, err);
                contractResult.refund = {
                    status: 'failed',
                    advertiserId: contract.advertiser_id,
                    error: err.message
                };
            }

            contractResult.status = 'completed';
            console.log(`--- Finished processing contract ID: ${contract.id} ---`);
            return contractResult;

        } catch (err) {
            console.error(`❌ [PaymentService] processContractPayments error for contract ${contract.id}:`, err);
            // 최상위 catch에서는 상세 에러를 던져서 executeAutoPay에서 처리
            throw err; 
        }
    }

    /**
     * 개별 인플루언서에게 수동으로 보수를 지급합니다.
     * @param {string} influencerId - 인플루언서의 ID (백엔드 DB 기준)
     * @param {string} contractId - 계약의 ID (백엔드 DB 기준)
     * @returns {Promise<object>} 지급 결과
     */
    async payIndividualInfluencer(influencerId, contractId) {
        try {
            console.log(`[PaymentService] Attempting manual payment for influencer ${influencerId} on contract ${contractId}.`);

            const ic = await InfluencerContract.findOne({
                influencer_id: influencerId,
                contract_id: contractId,
                reward_paid: false,
                review_status: 'APPROVED'
            }).lean();

            if (!ic) {
                throw new Error('No eligible influencer contract found for manual payment (already paid, not approved, or not found).');
            }

            const contract = await Contract.findOne({ id: ic.contract_id }).lean();
            const influencer = await Influencer.findOne({
                influencerId: ic.influencer_id
            }).lean();

            if (!contract) {
                throw new Error(`Contract with ID ${ic.contract_id} not found for manual payment.`);
            }
            if (!influencer) {
                throw new Error(`Influencer with ID ${ic.influencer_id} not found for manual payment.`);
            }
            if (!influencer.wallet_address) {
                throw new Error(`Influencer ${influencer.influencerId} has no wallet address for manual payment.`);
            }

            const paymentResult = await blockchainService.payInfluencer(
                contract.smartContractId,
                influencer.influencerId, // 스마트 컨트랙트에서 사용하는 ID
                influencer.wallet_address
            );

            await InfluencerContract.updateOne(
                { _id: ic._id }, // Mongoose의 _id 사용
                {
                    reward_paid: true,
                    reward_paid_at: new Date(), // 한국 시간으로 통일
                    payment_tx_hash: paymentResult.transactionHash
                }
            );

            console.log(`✅ [PaymentService] Manual payment successful for influencer ${influencerId}. Tx: ${paymentResult.transactionHash}`);
            return {
                success: true,
                message: 'Manual payment successful',
                txHash: paymentResult.transactionHash
            };

        } catch (err) {
            console.error(`❌ [PaymentService] payIndividualInfluencer failed for influencer ${influencerId}, contract ${contractId}:`, err);
            throw new Error(`Manual payment failed: ${err.message}`);
        }
    }

    /**
     * 수동으로 특정 계약의 잔액 환불을 처리합니다.
     * @param {string} contractId - 환불할 계약의 ID (백엔드 DB 기준)
     * @returns {Promise<object>} 환불 결과
     */
    async processContractRefund(contractId) {
        try {
            console.log(`[PaymentService] Attempting manual refund for contract ${contractId}.`);

            const contract = await Contract.findOne({
                _id: contractId, // _id 사용
                refund_processed: { $ne: true }
            }).lean();

            if (!contract) {
                throw new Error('Contract not found or already refunded for manual processing.');
            }

            const advertiser = await Advertiser.findOne({
                advertiserId: contract.advertiser_id
            }).lean();

            if (!advertiser) {
                throw new Error(`Advertiser with ID ${contract.advertiser_id} not found for contract ${contract.id}.`);
            }
            if (!advertiser.wallet_address) {
                throw new Error(`Advertiser ${advertiser.advertiserId} has no wallet address for contract ${contract.id}.`);
            }

            const refundResult = await blockchainService.refundAdvertiser(
                contract.smartContractId,
                advertiser.wallet_address
            );

            await Contract.updateOne(
                { _id: contract._id }, // _id 사용
                {
                    refund_processed: true,
                    refund_processed_at: new Date(),
                    refund_tx_hash: refundResult.transactionHash
                }
            );

            console.log(`✅ [PaymentService] Manual refund successful for contract ${contractId}. Tx: ${refundResult.transactionHash}`);
            return {
                success: true,
                message: 'Refund processed successfully',
                txHash: refundResult.transactionHash
            };

        } catch (err) {
            console.error(`❌ [PaymentService] processContractRefund failed for contract ${contractId}:`, err);
            throw new Error(`Manual refund failed: ${err.message}`);
        }
    }

    /**
     * 특정 계약의 정산 상태를 조회합니다.
     * @param {string} contractId - 조회할 계약의 ID
     * @returns {Promise<object>} 정산 상태 요약 및 인플루언서 계약 정보
     */
    async getContractPaymentStatus(contractId) {
        try {
            const contract = await Contract.findOne({ _id: contractId }).lean(); // _id 사용
            if (!contract) {
                throw new Error('Contract not found for status query.');
            }

            const influencerContracts = await InfluencerContract.find({
                contract_id: contractId
            }).lean();

            const paymentSummary = {
                totalInfluencers: influencerContracts.length,
                approvedInfluencers: influencerContracts.filter(ic => ic.review_status === 'APPROVED').length,
                paidInfluencers: influencerContracts.filter(ic =>
                    ic.review_status === 'APPROVED' && ic.reward_paid === true
                ).length,
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
                    rewardPaidAt: ic.reward_paid_at ? ic.reward_paid_at.toISOString() : null,
                    paymentTxHash: ic.payment_tx_hash
                }))
            };

        } catch (err) {
            console.error(`❌ [PaymentService] getContractPaymentStatus failed for contract ${contractId}:`, err);
            throw new Error(`Failed to get contract payment status: ${err.message}`);
        }
    }
}

module.exports = new PaymentService();