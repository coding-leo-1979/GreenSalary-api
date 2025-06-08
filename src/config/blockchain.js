// src/config/blockchain.js

const Web3 = require('web3');
const fs = require('fs');
const path = require('path');

class BlockchainConfig {
    constructor() {
        // 가나슈 연결
        this.web3 = new Web3('http://localhost:8545');
        
        // 블록체인 프로젝트 경로
        this.blockchainPath = path.join(__dirname, '../../../GreenSalaryBlockchain/BlockChain');
        
        // 컨트랙트 정보 로드
        this.contractInfo = this.loadContractInfo();
        
        if (!this.contractInfo) {
            throw new Error('Cannot load deployed contract information');
        }

        console.log(`✅ Connected to AdContract at: ${this.contractInfo.address}`);
        console.log(`✅ Network: http://localhost:8545`);
    }

    // 컨트랙트 정보 로드
    loadContractInfo() {
        try {
            const contractPath = path.join(this.blockchainPath, 'build/contracts/AdContract.json');
            
            if (!fs.existsSync(contractPath)) {
                console.error('❌ AdContract.json not found at:', contractPath);
                return null;
            }

            const contractData = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
            
            // 배포된 네트워크 찾기
            const networks = contractData.networks;
            const networkIds = Object.keys(networks);
            
            if (networkIds.length === 0) {
                console.error('❌ No deployed contract found');
                return null;
            }

            // 가장 최근 배포된 네트워크 사용
            const latestNetworkId = networkIds[networkIds.length - 1];
            const deployedContract = networks[latestNetworkId];

            return {
                name: contractData.contractName,
                abi: contractData.abi,
                address: deployedContract.address,
                networkId: latestNetworkId
            };
            
        } catch (error) {
            console.error('❌ Error loading contract info:', error.message);
            return null;
        }
    }

    // 컨트랙트 인스턴스 생성
    getContract() {
        if (!this.contractInfo) {
            throw new Error('Contract not loaded');
        }
        
        return new this.web3.eth.Contract(
            this.contractInfo.abi,
            this.contractInfo.address
        );
    }

    // 계정 목록 가져오기
    async getAccounts() {
        return await this.web3.eth.getAccounts();
    }

    // 관리자 계정 설정
    async getAdminAccount() {
        const accounts = await this.getAccounts();
        return accounts[0]; // 첫 번째 계정을 관리자로 사용
    }

    // Wei ↔ Ether 변환
    weiToEther(wei) {
        return this.web3.utils.fromWei(wei.toString(), 'ether');
    }

    etherToWei(ether) {
        return this.web3.utils.toWei(ether.toString(), 'ether');
    }

    // 연결 테스트
    async testConnection() {
        try {
            const isConnected = await this.web3.eth.net.isListening();
            const networkId = await this.web3.eth.net.getId();
            const blockNumber = await this.web3.eth.getBlockNumber();
            
            return {
                connected: isConnected,
                networkId: networkId,
                latestBlock: blockNumber,
                contractAddress: this.contractInfo?.address
            };
        } catch (error) {
            return {
                connected: false,
                error: error.message
            };
        }
    }
}

// 싱글톤 인스턴스
const blockchainConfig = new BlockchainConfig();

module.exports = blockchainConfig;