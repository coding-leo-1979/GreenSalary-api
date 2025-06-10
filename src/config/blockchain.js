// src/config/blockchain.js

const Web3 = require('web3');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

class BlockchainConfig {
    constructor() {
        // 현재 실행 환경 설정 (NODE_ENV에 따라 분기)
        this.currentEnv = process.env.NODE_ENV || 'development'; // 기본값은 development
        console.log(`🚀 Current Blockchain Environment: ${this.currentEnv.toUpperCase()}`);

        let rpcUrl;
        let networkId;
        let privateKey; // 백엔드에서 트랜잭션을 서명할 때 사용할 개인 키

        // 환경에 따라 RPC URL, Network ID, Private Key 설정
        if (this.currentEnv === 'development') {
            rpcUrl = process.env.GANACHE_RPC_URL || 'http://localhost:8545';
            networkId = process.env.GANACHE_NETWORK_ID || '5777';
            privateKey = process.env.GANACHE_ACCOUNT_PRIVATE_KEY;
            console.log(`✅ Connecting to Ganache at: ${rpcUrl}`);
        } else if (this.currentEnv === 'sepolia') {
            rpcUrl = process.env.SEPOLIA_RPC_URL;
            networkId = process.env.SEPOLIA_NETWORK_ID;
            privateKey = process.env.SEPOLIA_ACCOUNT_PRIVATE_KEY;

            if (!rpcUrl || !networkId || !privateKey) {
                throw new Error('❌ Sepolia environment variables (RPC_URL, NETWORK_ID, PRIVATE_KEY) are not set.');
            }
            console.log(`✅ Connecting to Sepolia Testnet at: ${rpcUrl.split('/v3/')[0]}/v3/XXXX...`); // 보안을 위해 URL 노출 제한
        } 
        // else if (this.currentEnv === 'mainnet') { ... } // 필요시 메인넷 설정 추가
        else {
            throw new Error(`❌ Invalid NODE_ENV: ${this.currentEnv}. Must be 'development' or 'sepolia'.`);
        }

        // Web3 인스턴스 초기화
        this.web3 = new Web3(new Web3.providers.HttpProvider(rpcUrl));
        this.privateKey = privateKey; // 백엔드에서 사용할 개인 키 저장
        this.networkId = networkId; // 현재 네트워크 ID 저장

        // 컨트랙트 정보 로드
        this.contractInfo = this.loadContractInfo();

        if (!this.contractInfo) {
            throw new Error('Cannot load deployed contract information. Ensure AdContract.json exists.');
        }

        // 로드된 컨트랙트 정보와 현재 환경의 네트워크 ID가 일치하는지 확인
        // 백엔드는 특정 네트워크에 배포된 컨트랙트와만 상호작용해야 하므로 중요.
        if (this.contractInfo.networkId !== this.networkId.toString()) {
            console.warn(`⚠️ Warning: Contract deployed on network ID ${this.contractInfo.networkId}, but current environment is set to network ID ${this.networkId}. This might cause issues.`);
            // 이 경고가 뜨면 `NODE_ENV` 설정과 `truffle migrate` 시 사용한 네트워크를 확인해야 합니다.
            // 예를 들어, 로컬에서 development로 돌리는데 contractInfo가 sepolia로 로드되었다면 문제 발생 가능성.
        }

        console.log(`✅ Connected to AdContract at: ${this.contractInfo.address}`);
        console.log(`✅ Network ID: ${this.networkId}`);
    }

    // 컨트랙트 정보 로드 (AdContract.json)
    // 환경에 맞는 네트워크 ID의 컨트랙트 주소를 로드하도록 수정
    loadContractInfo() {
        try {
            // truffle compile 시 생성되는 build/contracts 폴더의 JSON 파일을 직접 참조
            // 현재 blockchain.js의 위치에 따라 경로 조정 필요
            const contractPath = path.join(__dirname, 'AdContract.json');
            
            if (!fs.existsSync(contractPath)) {
                console.error('❌ AdContract.json not found at:', contractPath);
                return null;
            }

            const contractData = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
            
            // 현재 설정된 networkId에 맞는 배포 정보 찾기
            const deployedContract = contractData.networks[this.networkId];

            if (!deployedContract || !deployedContract.address) {
                console.error(`❌ No deployed contract found for network ID: ${this.networkId}.`);
                return null;
            }

            return {
                name: contractData.contractName,
                abi: contractData.abi,
                address: deployedContract.address,
                networkId: this.networkId.toString() // 현재 설정된 네트워크 ID 사용
            };
            
        } catch (error) {
            console.error('❌ Error loading contract info:', error.message);
            return null;
        }
    }

    // 컨트랙트 인스턴스 생성 (백엔드에서 트랜잭션 서명용)
    getContract() {
        if (!this.contractInfo) {
            throw new Error('Contract not loaded');
        }
        
        const contract = new this.web3.eth.Contract(
            this.contractInfo.abi,
            this.contractInfo.address
        );

        // 백엔드에서 직접 트랜잭션을 보낼 경우, 계정 추가 및 서명 설정
        if (this.privateKey) {
            // 계정을 web3 인스턴스에 추가
            const account = this.web3.eth.accounts.privateKeyToAccount(this.privateKey);
            this.web3.eth.accounts.wallet.add(account);
            // 기본 트랜잭션 발신자 주소 설정 (from)
            contract.options.from = account.address;
            console.log(`✅ Admin account set for transactions: ${account.address}`);
        } else {
            console.warn('⚠️ Warning: No private key configured. Contract will be read-only from backend.');
        }

        return contract;
    }

    // 계정 목록 가져오기 (주로 개발/테스트 환경에서만 유용)
    async getAccounts() {
        return await this.web3.eth.getAccounts();
    }

    // 관리자 계정 설정 (이제 this.privateKey를 통해 설정되므로 이 함수는 보조적)
    async getAdminAccount() {
        if (this.privateKey) {
            const account = this.web3.eth.accounts.privateKeyToAccount(this.privateKey);
            return account.address;
        }
        const accounts = await this.getAccounts(); // 개인 키가 없는 경우 첫 번째 계정 반환
        return accounts[0];
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
            const isListening = await this.web3.eth.net.isListening();
            const currentNetworkId = await this.web3.eth.net.getId();
            const blockNumber = await this.web3.eth.getBlockNumber();
            
            return {
                connected: isListening,
                configuredNetworkId: this.networkId,
                actualNetworkId: currentNetworkId,
                latestBlock: blockNumber,
                contractAddress: this.contractInfo?.address,
                adminAccount: await this.getAdminAccount()
            };
        } catch (error) {
            console.error('❌ Blockchain connection test failed:', error.message);
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