// src/services/blockchainService.js

const blockchainConfig = require('../config/blockchain');

class BlockchainService {
    constructor() {
        // blockchainConfig는 싱글톤으로 이미 초기화되어 있다고 가정
        this.contract = blockchainConfig.getContract();
        this.web3 = blockchainConfig.web3;

        if (!this.contract) {
            // 이 에러는 blockchainConfig에서 컨트랙트 로드 실패 시 발생해야 함.
            throw new Error('BlockchainService: Failed to get contract instance. Check blockchain config.');
        }
    }

    /**
     * 광고 정보 조회
     * @param {string} adId - 광고 ID
     * @returns {Promise<object>} 광고 정보 객체
     */
    async getAdInfo(adId) {
        try {
            const ad = await this.contract.methods.getAd(adId).call();
            return {
                advertiser: ad.advertiser,
                reward: blockchainConfig.weiToEther(ad.reward), // Ether 단위
                rewardWei: ad.reward.toString(), // BigInt to string
                maxInfluencer: Number(ad.maxInfluencer), // BigInt to Number
                deadline: new Date(Number(ad.deadline) * 1000), // BigInt to Number
                acceptedCount: Number(ad.acceptedCount), // BigInt to Number
                isClosed: ad.isClosed
            };
        } catch (error) {
            console.error(`❌ [BlockchainService] Failed to get ad info for ID ${adId}:`, error);
            throw new Error(`Failed to get ad info: ${error.message}`);
        }
    }

    /**
     * 컨트랙트 잔액 확인
     * @returns {Promise<object>} 이더 및 웨이 단위 잔액
     */
    async getContractBalance() {
        try {
            const balance = await this.contract.methods.getBalance().call();
            return {
                ether: blockchainConfig.weiToEther(balance),
                wei: balance.toString() // BigInt to string
            };
        } catch (error) {
            console.error('❌ [BlockchainService] Failed to get contract balance:', error);
            throw new Error(`Failed to get contract balance: ${error.message}`);
        }
    }

    /**
     * 특정 인플루언서의 광고 이행 정보 확인
     * @param {string} adId - 광고 ID
     * @param {string} influencerAddress - 인플루언서 지갑 주소
     * @returns {Promise<object>} 인플루언서 정보 객체
     */
    async getInfluencerInfo(adId, influencerAddress) {
        try {
            // 솔리디티 함수 getInfluencerInfo의 반환 타입에 따라 배열 인덱스 사용
            const info = await this.contract.methods
                .getInfluencerInfo(adId, influencerAddress)
                .call();
            
            return {
                influencer: info[0],
                paid: info[1],
                joinTime: new Date(Number(info[2]) * 1000) // BigInt to Number
            };
        } catch (error) {
            console.error(`❌ [BlockchainService] Failed to get influencer info for ad ${adId}, influencer ${influencerAddress}:`, error);
            throw new Error(`Failed to get influencer info: ${error.message}`);
        }
    }

    /**
     * 인플루언서에게 보수 지급 (백엔드 관리자 계정으로 서명)
     * @param {string} adId - 광고 ID
     * @param {string} influencerId - 인플루언서 ID (컨트랙트에 따라 address일 수도 있음)
     * @param {string} walletAddress - 인플루언서 지갑 주소
     * @returns {Promise<object>} 트랜잭션 결과
     */
    async payInfluencer(adId, influencerId, walletAddress) {
        try {
            console.log(`💰 Paying influencer ${walletAddress} (id: ${influencerId}) for ad ${adId}...`);

            // 가스 예측 (from 주소는 this.contract.options.from에 이미 설정됨)
            const estimatedGas = await this.contract.methods
                .payInfluencer(adId, influencerId, walletAddress)
                .estimateGas({ from: this.contract.options.from });
            
            // 예측 가스에 여유분 추가 (예: 20%)
            const gasLimit = Math.floor(estimatedGas * 1.2); 
            console.log(`Estimated gas for payment: ${estimatedGas}, Using gas limit: ${gasLimit}`);

            const result = await this.contract.methods
                .payInfluencer(adId, influencerId, walletAddress)
                .send({
                    // from: this.contract.options.from, // 이미 설정되어 있으므로 생략 가능
                    gas: gasLimit 
                });

            console.log(`✅ Payment successful! Tx: ${result.transactionHash}`);

            return {
                success: true,
                transactionHash: result.transactionHash,
                blockNumber: result.blockNumber,
                gasUsed: result.gasUsed.toString() // BigInt to string
            };
        } catch (error) {
            console.error(`❌ [BlockchainService] Payment failed for ad ${adId}, influencer ${walletAddress}:`, error);
            throw new Error(`Payment failed: ${error.message}`);
        }
    }

    /**
     * 광고주에게 잔액 환불 (백엔드 관리자 계정으로 서명)
     * @param {string} adId - 광고 ID (smartContractId -> adId로 용어 통일)
     * @param {string} advertiserWalletAddress - 광고주 지갑 주소
     * @returns {Promise<object>} 트랜잭션 결과
     */
    async refundAdvertiser(adId, advertiserWalletAddress) {
        try {
            console.log(`💰 Refunding advertiser ${advertiserWalletAddress} for ad ${adId}...`);

            // 가스 예측 (from 주소는 this.contract.options.from에 이미 설정됨)
            const estimatedGas = await this.contract.methods
                .refundAdvertiser(adId, advertiserWalletAddress)
                .estimateGas({ from: this.contract.options.from });

            // 예측 가스에 여유분 추가
            const gasLimit = Math.floor(estimatedGas * 1.2); 
            console.log(`Estimated gas for refund: ${estimatedGas}, Using gas limit: ${gasLimit}`);

            const result = await this.contract.methods
                .refundAdvertiser(adId, advertiserWalletAddress)
                .send({
                    // from: this.contract.options.from, // 이미 설정되어 있으므로 생략 가능
                    gas: gasLimit 
                });

            console.log(`✅ Refund successful: ${result.transactionHash}`);
            
            return {
                success: true,
                transactionHash: result.transactionHash,
                blockNumber: result.blockNumber,
                gasUsed: result.gasUsed.toString() // BigInt to string
            };

        } catch (error) {
            console.error(`❌ [BlockchainService] Refund failed for ad ${adId}, advertiser ${advertiserWalletAddress}:`, error);
            throw new Error(`Refund failed: ${error.message}`);
        }
    }

    /**
     * 블록체인 연결 상태 확인
     * @returns {Promise<object>} 연결 상태 정보
     */
    async getStatus() {
        return await blockchainConfig.testConnection();
    }
}

// 싱글톤 인스턴스
module.exports = new BlockchainService();