// src/controllers/advertiser.controller.js

const bcrypt = require('bcrypt');
const { nanoid } = require('nanoid');
const Contract = require('../models/contract');
const Advertiser = require('../models/advertiser');
const Influencer = require('../models/influencer');
const Transaction = require('../models/transaction');
const InfluencerContract = require('../models/influencer_contract');

// 상태 계산 함수
function getStatus(contract, now) {
    if (contract.upload_start_date > now) {
        return '대기중';
    } else if (
        contract.upload_start_date <= now &&
        contract.upload_end_date >= now
    ) {
        return '진행중';
    } else {
        return '마감';
    }
}

// 광고 생성하기
// POST /api/advertiser/contract
exports.createContract = async (req, res) => {
    try {
        const {
            title,
            reward,
            recruits,
            uploadPeriod,
            maintainPeriod,
            keywords,
            conditions,
            site,
            media,
            description,
        } = req.body;

        // 필수 항목 검증
        if (!title || !reward || !recruits || !uploadPeriod?.startDate || !uploadPeriod?.endDate) {
            return res.status(400).json({ message: '필수 항목이 누락되었습니다.' });
        }

        const advertiser_id = req.user.userId;

        const newContract = new Contract({
            advertiser_id,
            title,
            reward,
            recruits,
            upload_start_date: uploadPeriod.startDate,
            upload_end_date: uploadPeriod.endDate,
            maintain_start_date: maintainPeriod?.startDate || null,
            maintain_end_date: maintainPeriod?.endDate || null,
            keywords: keywords || [],
            conditions: conditions || [],
            site,
            media: media || [],
            description: description || '',
            // ⚠️ id, access_code는 Schema에서 자동 생성 및 중복 방지
        });

        await newContract.save();

        return res.status(201).json({
            message: '광고가 정상적으로 생성되었습니다.',
            contractId: newContract.id,
            accessCode: newContract.access_code
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
};

// 광고 목록 조회하기
// GET /api/advertiser/contract
exports.readContracts = async (req, res) => {
    try {
        const advertiser_id = req.user.userId;

        // 파라미터
        const sort = req.query.sort || 'latest';
        const status = req.query.status || 'all';

        // 정렬
        let sortOption;
        if (sort === 'oldest') {
            sortOption = { created_at: 1 };
        } else {
            sortOption = { created_at: -1 };
        }

        // 상태별 필터링
        let statusFilter = {};
        const now = new Date();
        if (status === 'pending') {
            statusFilter = { upload_start_date: { $gt: now }};
        } else if (status === 'active') {
            statusFilter = { upload_start_date: { $lte: now }, upload_end_date: { $gte: now }};
        } else if (status === 'ended') {
            statusFilter = { upload_end_date: { $lt: now }};
        }

        // 광고 목록 불러오기
        const filter = { advertiser_id, ...statusFilter };
        const contracts = await Contract.find(filter).sort(sortOption);

        // 응답 데이터 형태 맞추기
        const contractList = contracts.map((contract) => ({
            id: contract.id,
            title: contract.title,
            uploadStartDate: contract.upload_start_date,
            uploadEndDate: contract.upload_end_date,
            participants: contract.participants,
            recruits: contract.recruits,
            status: getStatus(contract, now),
            accessCode: contract.access_code
        }));

        res.status(200).json({ contracts: contractList });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
}

// 광고 내용 조회하기
// GET /api/advertiser/contract/:contractId
exports.readContract = async (req, res) => {
    try {
        const { contractId } = req.params;

        if (!contractId) {
            return res.status(400).json({ message: '잘못된 요청입니다.' });
        }

        // DB에서 계약 찾기
        const contract = await Contract.findOne({
            id: contractId,
            advertiser_id: req.user.userId
        });

        if (!contract) {
            return res.status(404).json({ message: '존재하지 않습니다.' });
        }

        const response = {
            title: contract.title,
            reward: contract.reward,
            recruits: contract.recruits,
            participants: contract.participants,
            uploadPeriod: {
                startDate: contract.upload_start_date,
                endDate: contract.upload_end_date
            },
            maintainPeriod: {
                startDate: contract.maintain_start_date,
                endDate: contract.maintain_end_date
            },
            keywords: contract.keywords,
            conditions: contract.conditions,
            site: contract.site,
            media: {
                minTextLength: contract.media?.[0]?.media_text || 0,
                minImageCount: contract.media?.[0]?.media_image || 0
            },
            description: contract.description,
            photo_url: contract.photo_url,
            accessCode: contract.access_code
        }

        return res.status(200).json(response);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
}

// 광고 인플루언서 조회하기
// GET /api/advertiser/contract/:contractId/influencers
exports.readInfluencers = async (req, res) => {
    // 기능 1: review_available 확인하기
    // upload_start_date부터 upload_end_date + 하루 동안만 리뷰 가능

    // 기능 2: InfluencerContract 테이블에서 다음 정보를 불러오기
    // 1. InfluencerContract.influencer_id
    // 2. influencer_name: influencer_id를 통해 influencer 테이블에서 불러와야 함
    // 3. influencer_description: influencer_id를 통해 influencer 테이블에서 불러와야 함
    // 4. InfluencerContract.url
    // 5. InfluencerContract.keywordTest
    // 6. InfluencerContract.conditionTest
    // 7. InfluencerContract.review_status
    // 8. InfluencerContract.reward_paid
    // 9. submit_review_available: review_available == true && InfluencerContract.review_status == APPROVED 때만 가능함
    // 10. submit_reward_available: review_available == true && InfluencerContract.review_status != PENDING 때만 가능함
    try {
        const { contractId } = req.params;

        // 파라미터
        const sort = req.query.sort || 'latest';
        const status = req.query.status || 'ALL';

        // 계약 조회
        const contract = await Contract.findOne({ id: contractId });
        if (!contract) {
            return res.status(404).json({ message: '광고 계약이 존재하지 않습니다.' });
        }

        // 리뷰 신청 가능 여부 계산
        const today = new Date();
        const uploadStart = new Date(contract.upload_start_date);
        const uploadEnd = new Date(contract.upload_end_date);
        const reviewDeadline = new Date(uploadEnd);
        reviewDeadline.setDate(reviewDeadline.getDate() + 1);

        const review_available = today >= uploadStart && today <= reviewDeadline;
        
        // InfluencerContract 조회
        const influencerContracts = await InfluencerContract.find({ contract_id: contractId });

        const influencers = await Promise.all(
        influencerContracts.map(async (ic) => {
            const influencer = await Influencer.findOne({ influencerId: ic.influencer_id });
            if (!influencer) return null;

            const review_status = ic.review_status;
            const submit_review_available = review_available && review_status === 'APPROVED';
            const submit_reward_available = review_available && review_status !== 'PENDING';

            return {
                influencer_id: ic.influencer_id,
                influencer_name: influencer.name,
                influencer_description: influencer.description,

                url: ic.url,
                keywordTest: ic.keywordTest,
                conditionTest: ic.conditionTest,

                review_status,
                reward_paid: ic.reward_paid,

                submit_review_available,
                submit_reward_available,

                joined_at: ic.joined_at
        };
      })
    );

    // null 필터링 (influencer 정보가 없는 경우 제외)
    let filteredInfluencers = influencers.filter((inf) => inf !== null);

    // status 필터링
    if (status !== 'ALL') {
        filteredInfluencers = filteredInfluencers.filter(
            (inf) => inf.review_status === status
        );
    }

    // sort 정렬
    filteredInfluencers.sort((a, b) => {
        const timeA = new Date(a.joined_at).getTime();
        const timeB = new Date(b.joined_at).getTime();
        return sort === 'oldest' ? timeA - timeB : timeB - timeA;
    });

    filteredInfluencers = filteredInfluencers.map(({ joined_at, ...rest }) => rest);

    res.json({
      review_available,
      influencers: filteredInfluencers
    });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
};

// 광고 거래 내역 조회하기
// GET /api/advertiser/contract/:contractId/transactions
exports.readTransactions = async (req, res) => {
    // 정렬: sort (latest, oldest) (default: latest)
    // Transaction.contract_id == Contract.id 인 계약을 불러와야 함
    // influencer_name: Transaction.influencer_id == Influencer.influencerId인 Influencer.name을 가져와야 함
    // amount: Transaction.amount
    // paid_at: Transaction.paid_at
    // txHash: Transaction.txHash
    try {
        const { contractId } = req.params;
        const { sort = 'latest' } = req.query;

        // Contract 유효성 검사
        const contract = await Contract.findOne({ id: contractId });
        if (!contract) {
            return res.status(404).json({ message: '계약이 존재하지 않습니다. '});
        }

        // Sort
        const sortOrder = sort === 'oldest' ? 1 : -1;

        // Transaction 테이블에서 해당 Contract의 거래 내역 조회
        const transations = await Transaction
            .find({ contract_id: contractId })
            .sort({ paid_at: sortOrder });

        // 각 Transaction에서 Response 구성
        const response = await Promise.all(
            transations.map(async (tx) => {
                const influencer = await Influencer.findOne({ influencerId: tx.influencer_id });
                return {
                    influencer_name: influencer?.name || 'Unknown',
                    amount: tx.amount,
                    paid_at: tx.paid_at,
                    txHash: tx.txHash
                };
            })
        );

        return res.status(200).json(response);
    } catch (error) {
        console.error('readPayments error:', error);
        return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
};

// 마이페이지
// GET /api/advertiser/mypage
exports.readMypage = async (req, res) => {
    // email: Advertiser.email
    // name: Advertiser.name
    // description: Advertiser.description
    // walletAddress: Advertiser.wallet_address
    try {
        const advertiser = await Advertiser.findOne({ advertiserId: req.user.userId }).lean();
        if (!advertiser) {
            return res.status(404).json({ message: '존재하지 않는 사용자입니다.' });
        }

        return res.status(200).json({
            email: advertiser.email,
            name: advertiser.name,
            description: advertiser.description || '',
            walletAddress: advertiser.wallet_address
        });
    } catch (error) {
        console.error('readMypage error:', error);
        return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
};

// 마이페이지 정보 수정
// POST /api/advertiser/mypage/profile
exports.updateMypageProfile = async (req, res) => {
    // 다음 3개 수정 가능
    // name: Advertiser.name
    // description: Advertiser.description
    // walletAddress: Advertiser.wallet_address
    try {
        const { name, description, walletAddress } = req.body;

        if (!name) {
            return res.status(400).json({ message: '이름은 공백일 수 없습니다.' });
        }
        if (!walletAddress) {
            return res.status(400).json({ message: '지갑 주소는 공백일 수 없습니다.' });
        }

        const updated = await Advertiser.findOneAndUpdate(
            { advertiserId: req.user.userId },
            {
                name,
                description: description || '',
                wallet_address: walletAddress
            },
            { new: true }
        ).lean();

        if (!updated) {
            return res.status(404).json({ message: '존재하지 않습니다.' });
        }

        return res.status(200).json({
            message: '프로필이 수정되었습니다.',
            name: updated.name,
            description: updated.description,
            walletAddress: updated.wallet_address
        });

    } catch (error) {
        console.error('updateMypageProfile error: ', error);
        return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
};

// 마이페이지 비밀번호 수정
// POST /api/advertiser/mypage/password
exports.updateMypagePassword = async (req, res) => {
    // 기존 비밀번호
    // 새 비밀번호
    // 새 비밀번호 확인
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;

        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({ message: '잘못된 요청입니다.' });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({ message: '새 비밀번호가 일치하지 않습니다.' });
        }

        if (currentPassword == newPassword) {
            return res.status(400).json({ message: '새 비밀번호가 기존 비밀번호와 동일합니다.' });
        }

        const advertiser = await Advertiser.findOne({ advertiserId: req.user.userId });
        if (!advertiser) {
            return res.status(404).json({ message: '존재하지 않습니다.' });
        }

        const isMatch = await bcrypt.compare(currentPassword, advertiser.password);
        if (!isMatch) {
            return res.status(401).json({ message: '기존 비밀번호가 올바르지 않습니다.' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        advertiser.password = hashedPassword;
        await advertiser.save();

        return res.status(200).json({ message: '비밀번호가 성공적으로 변경되었습니다.' });

    } catch (error) {
        console.error('updateMypagePassword error: ', error);
        return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
};