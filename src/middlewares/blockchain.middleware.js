const { ethers } = require("ethers");
const contractABI = require("./AdContractABI.json");
const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.ADVERTISER_PRIVATE_KEY, provider);
const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, contractABI, wallet);

async function payToInfluencer(joinId) {
    // joinId로부터 adId, influencerAddress 조회 (DB에서 조회)
    const ic = await InfluencerContract.findOne({ influencerContractId: joinId });
    if (!ic) throw new Error("Invalid joinId");
    
    const adId = ic.contract_id; // 또는 실제 광고 ID 필드
    const influencerAddress = ic.wallet_address; // 인플루언서 지갑 주소 저장 필요

    const tx = await contract.payInfluencer(adId, influencerAddress);
    const receipt = await tx.wait();

    return receipt;
}