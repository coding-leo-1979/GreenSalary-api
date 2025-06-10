// src/services/blockchainService.js

const blockchainConfig = require('../config/blockchain');

class BlockchainService {
    constructor() {
        this.contract = blockchainConfig.getContract();
        this.web3 = blockchainConfig.web3;

        if (!this.contract) {
            throw new Error('BlockchainService: Failed to get contract instance. Check blockchain config.');
        }
    }

    // 광고 정보 조회
    async getAdInfo(adId) {
        try {
            const ad = await this.contract.methods.getAd(adId).call();
            return {
                advertiser: ad.advertiser,
                reward: blockchainConfig.weiToEther(ad.reward),
                rewardWei: ad.reward,
                maxInfluencer: parseInt(ad.maxInfluencer),
                deadline: new Date(parseInt(ad.deadline) * 1000),
                acceptedCount: parseInt(ad.acceptedCount),
                isClosed: ad.isClosed
            };
        } catch (error) {
            throw new Error(`Failed to get ad info: ${error.message}`);
        }
    }

    // 컨트랙트 잔액 확인
    async getContractBalance() {
        try {
            const balance = await this.contract.methods.getBalance().call();
            return {
                ether: blockchainConfig.weiToEther(balance),
                wei: balance
            };
        } catch (error) {
            throw new Error(`Failed to get balance: ${error.message}`);
        }
    }

    // 인플루언서 정보 확인
    async getInfluencerInfo(adId, influencerAddress) {
        try {
            const info = await this.contract.methods
                .getInfluencerInfo(adId, influencerAddress)
                .call();
            
            return {
                influencer: info[0],
                paid: info[1],
                joinTime: new Date(parseInt(info[2]) * 1000)
            };
        } catch (error) {
            throw new Error(`Failed to get influencer info: ${error.message}`);
        }
    }

    // 인플루언서에게 지급 
    async payInfluencer(adId, influencerId, walletAddress) {
        try {
            const adminAccount = await blockchainConfig.getAdminAccount();
            
            console.log(`💰 Paying influencer ${walletAddress} (id: ${influencerId}) for ad ${adId}...`);

            const result = await this.contract.methods
                .payInfluencer(adId, influencerId, walletAddress)
                .send({
                    from: adminAccount,
                    gas: 300000
                });

            console.log(`✅ Payment successful! Tx: ${result.transactionHash}`);

            return {
                success: true,
                transactionHash: result.transactionHash,
                blockNumber: result.blockNumber,
                gasUsed: result.gasUsed
            };
        } catch (error) {
            console.error(`❌ Payment failed:`, error.message);
            throw new Error(`Payment failed: ${error.message}`);
        }
    }

    // 광고주에게 잔액 환불
    async refundAdvertiser(smartContractId, advertiserWalletAddress) {
        try {
            const adminAccount = await blockchainConfig.getAdminAccount();
            
            console.log(`💰 Refunding advertiser... (smartContractId: ${smartContractId})`);

            const result = await this.contract.methods
                .refundAdvertiser(smartContractId, advertiserWalletAddress)
                .send({
                    from: adminAccount,
                    gas: 300000
                })

            console.log(`✅ Refund successful: ${result.transactionHash}`);
            
            return {
                success: true,
                transactionHash: result.transactionHash,
                blockNumber: result.blockNumber,
                gasUsed: result.gasUsed
            };

        } catch (error) {
            console.error('❌ Refund failed:', error);
            throw error;
        }
    }


    // 연결 상태 확인
    async getStatus() {
        return await blockchainConfig.testConnection();
    }
}

module.exports = new BlockchainService();