// src/controllers/influencer.controller.js

const bcrypt = require('bcrypt');
const Contract = require('../models/contract');
const Advertiser = require('../models/advertiser');
const Influencer = require('../models/influencer');
const Transaction = require('../models/transaction');
const InfluencerContract = require('../models/influencer_contract');

// 
// POST GET 
exports.example = async (req, res) => {
    /*
    
    */
    try {

    } catch (error) {
        console.log('example error: ', error);
        return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
};

// 계약 코드 입력하기
// POST /api/influencer/contract/code
exports.inputCode = async (req, res) => {
    /*
    ### Request Body
    {
        "accessCode": "string"
    }
    */
    try {
        const { accessCode } = req.body;

        if ( !accessCode ) {
            return res.status(400).json({ message: '계약 코드는 필수 입력입니다.' });
        }

        // 1. accessCode로 계약 찾기
        const contract = await Contract.findOne({ access_code: accessCode });
        if (!contract) {
            return res.status(400).json({ message: '해당 계약을 찾을 수 없습니다.' });
        }

        // 2. 이미 참여한 계약인지 확인하기
        const existingParticipation = await InfluencerContract.findOne({
            contract_id: contract.id,
            influencer_id: req.user.userId,
        });
        if (existingParticipation) {
            return res.status(409).json({ message: '이미 참여한 계약입니다.' });
        }

        // 3. 모집 인원 초과 여부 확인하기
        if (contract.participants >= contract.recruits) {
            return res.status(400).json({ message: '이미 모집이 완료된 계약입니다.' });
        }

        // 4. 업로드 마감일 확인하기
        const now = new Date();
        if (contract.upload_end_date < now) {
            return res.status(400).json({ message: '이미 종료된 계약입니다.' });
        }

        // 5. 통과: contract.id 응답
        return res.status(200).json({
            message: '참가 가능한 계약입니다.',
            contractId: contract.id
        });

    } catch (error) {
        console.log('example error: ', error);
        return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
};

// 계약 내용 조회하기
// GET /api/influencer/contract/:contractId
exports.readContract = async (req, res) => {
    try {
        const { contractId } = req.params;
        if (!contractId) {
            return res.status(400).json({ message: '잘못된 요청입니다.' });
        }

        const contract = await Contract.findOne({ id: contractId }).lean();
        if (!contract) {
            return res.status(404).json({ message: '존재하지 않는 계약입니다.' });
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
        console.log('readContract error: ', error);
        return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
};

// 계약 수락하기
// POST /api/influencer/contract/:contractId/join
exports.joinContract = async (req, res) => {
    try {
        const { contractId } = req.params;
        const influencerId = req.user.userId;

        if (!contractId || !influencerId) {
            return res.status(400).json({ message: '잘못된 요청입니다.' });
        }

        // 1. 계약 찾기
        const contract = await Contract.findOne({ id: contractId }).lean();
        if (!contract) {
            return res.status(404).json({ message: '계약을 찾을 수 없습니다.' });
        }

        // 2. 이미 참여한 계약인지 확인하기
        const alreadyJoined = await InfluencerContract.exists({
            contract_id: contract.id,
            influencer_id: influencerId
        });
        if (alreadyJoined) {
            return res.status(409).json({ message: '이미 참여한 계약입니다.' });
        }

        // 3. 모집 인원 초과 여부 확인하기
        if (contract.participants >= contract.recruits) {
            return res.status(400).json({ message: '이미 모집이 완료된 계약입니다.' });
        }

        // 4. 업로드 마감일 확인하기
        const now = new Date();
        if (contract.upload_end_date < now) {
            return res.status(400).json({ message: '이미 종료된 계약입니다.' });
        }

        // 5. 통과: 계약하기
        const influencerContract = new InfluencerContract({
            contract_id: contractId,
            advertiser_id: contract.advertiser_id,
            influencer_id: influencerId,
            joined_at: now
        });

        await influencerContract.save();
        return res.status(201).json({ message: '계약에 성공적으로 참여하였습니다.' });

    } catch (error) {
        console.log('example error: ', error);
        return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
};

// 계약 목록 조회하기
// GET /api/influencer/contract
exports.readContracts = async (req, res) => {
    /*
    ### Request Parameter
    sort: deadline, latest (default: deadline) (deadline: Contract.upload_end_date 마감임박순) (latest: Contract.upload_start_date 최신순)
    status: PENDING, APPROVED, REJECTED, ALL (default: ALL)

    ### Response
    {
        "contracts": [
            {
                "contractId": Contract.id
                "title": Contract.title
                "uploadStartDate": Contract.upload_start_date
                "uploadEndDate": Contract.upload_end_date
                "reward": Contract.reward
                "keywordTest": InfluencerContract.keywordTest
                "conditionTest": InfluencerContract.conditionTest
                "status": InfluencerContract.review_status
                "rewardPaid": InfluencerContract.reward_paid
                "reviewAvailable": uploadStartDate부터 (uploadEndDate+하루) 사이이면서 status가 REJECTED인 경우
            }
        ]
    }
    */
    try {
        const influencerId = req.user.userId;
        const { sort = 'deadline', status = 'ALL' } = req.query;

        // 인플루언서가 참여한 계약 목록 조회하기
        const influencerContracts = await InfluencerContract.find({ influencer_id: influencerId }).lean();
        const contractIds = influencerContracts.map(ic => ic.contract_id);
        
        // 계약 정보 조회
        const contracts = await Contract.find({ id: { $in: contractIds } }).lean();

        // 계약 목록
        const result = influencerContracts.map(ic => {
            const contract = contracts.find(c => c.id === ic.contract_id);
            if (!contract) return null;

            const uploadStartDate = new Date(contract.upload_start_date);
            const uploadEndDate = new Date(contract.upload_end_date);
            const now = new Date();

            const reviewAvailable = (
                now >= uploadStartDate &&
                now <= new Date(uploadEndDate.getTime() + 24 * 60 * 60 * 1000) && // 하루 추가
                ic.review_status === 'REJECTED'
            );

            return {
                contractId: contract.id,
                title: contract.title,
                uploadStartDate: contract.upload_start_date,
                uploadEndDate: contract.upload_end_date,
                reward: contract.reward,
                keywordTest: ic.keywordTest,
                conditionTest: ic.conditionTest,
                status: ic.review_status,
                rewardPaid: ic.reward_paid,
                reviewAvailable,
            };
        }).filter(Boolean);


        // 상태 필터링
        let filtered = result;
        if (status !== 'ALL') {
            filtered = result.filter(item => item.status === status);
        }

        // 정렬
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (sort === 'deadline') {
            filtered.sort((a, b) => {
                const endA = new Date(a.uploadEndDate);
                const endB = new Date(b.uploadEndDate);

                const isPastA = endA < today;
                const isPastB = endB < today;

                if (isPastA && !isPastB) return 1;   // A는 지났고 B는 아직 → B가 위
                if (!isPastA && isPastB) return -1;  // A는 아직이고 B는 지남 → A가 위

                // 둘 다 아직인 경우 → 가까운 날짜가 위
                // 둘 다 지난 경우   → 그래도 가까운 날짜가 위
                return endA - endB;
            });
        } else if (sort === 'latest') {
            filtered.sort((a, b) => new Date(b.uploadStartDate) - new Date(a.uploadStartDate));
        }

        return res.status(200).json({ contracts: filtered });

    } catch (error) {
        console.log('readContracts error: ', error);
        return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
};

// URL 입력하기
// POST /api/influencer/contract/:contractId/url
exports.inputURL = async (req, res) => {
    /*
    InfluencerContract
    */
    try {

    } catch (error) {
        console.log('example error: ', error);
        return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
};

// URL 조회하기
// GET /api/influencer/contract/:contractId/url
exports.readURL = async (req, res) => {
    /*
    
    */
    try {

    } catch (error) {
        console.log('example error: ', error);
        return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
};