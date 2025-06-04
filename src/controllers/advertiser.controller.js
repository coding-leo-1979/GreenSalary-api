// src/controllers/advertiser.controller.js

const Contract = require('../models/contract');
const Influencer = require('../models/influencer');
const InfluencerContract = require('../models/influencer_contract')
const { nanoid } = require('nanoid');

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
exports.createContract = async (req, res) => {
    try {
        const { title, reward, recruits, uploadPeriod, maintainPeriod, keywords, conditions, site, media, description } = req.body;

        // 필수 항목 검증
        if ( !title || !reward || !recruits || !uploadPeriod || !uploadPeriod.startDate || !uploadPeriod.endDate ) {
            return res.status(400).json({ message: '필수 항목이 누락되었습니다.' });
        }

        // 사용자 정보
        const advertiser_id = req.user.userId;
        const contractId = nanoid();

        const newContract = new Contract({
            id: contractId,
            advertiser_id,
            title,
            reward,
            recruits,
            upload_start_date: uploadPeriod.startDate,
            upload_end_date: uploadPeriod.endDate,
            maintain_start_date: maintainPeriod?.startDate,
            maintain_end_date: maintainPeriod?.endDate,
            keywords,
            conditions,
            site,
            media,
            description,
            access_code: contractId,
        })
        await newContract.save();

        return res.status(201).json({ message: "광고가 정상적으로 생성되었습니다." });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
}

// 광고 목록 조회하기
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
            code: contract.id
        }));

        res.status(200).json({ contracts: contractList });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
}

// 광고 조회하기
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
            photo_url: contract.photo_url
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

// 광고 입금내역 조회하기
// GET /api/advertiser/contract/:contractId/payments
exports.readPayments = async (req, res) => {
    // 정렬: sort (latest, oldest) (default: latest)
};