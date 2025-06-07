// src/controllers/admin.controller.js

const Contract = require('../models/contract');
const Advertiser = require('../models/advertiser');
const Influencer = require('../models/influencer');
const InfluencerContract = require('../models/influencer_contract');
const influencer_contract = require('../models/influencer_contract');

// 문의 목록 조회하기
// GET /api/auth/ask?sort=latest&asker=all
exports.readAsks = async (req, res) => {
    try {
        const { sort = 'latest', asker = 'all' } = req.query;

        // review_status 필터 설정
        const reviewStatusFilter = [];
        if (asker === 'advertiser') {
            reviewStatusFilter.push('REVIEW_FROM_ADV');
        } else if (asker === 'influencer') {
            reviewStatusFilter.push('REVIEW_FROM_INF');
        } else {
            reviewStatusFilter.push('REVIEW_FROM_ADV', 'REVIEW_FROM_INF');
        }

        // 조건에 맞는 contract 가져오기
        const influencerContracts = await InfluencerContract.find({
            review_status: { $in: reviewStatusFilter }
        });

        // contract_id 목록 추출
        const contractIds = influencerContracts.map(ic => ic.contract_id);

        // contractId에 해당하는 contracts 조회
        const contracts = await Contract.find({ id: { $in: contractIds } });

        // contractId → contract 매핑
        const contractMap = {};
        contracts.forEach(c => {
            contractMap[c.id] = c;
        });

        // 결과 가공
        const result = influencerContracts.map(ic => {
            const contract = contractMap[ic.contract_id];
            if (!contract) return null;

            const baseDate = new Date(contract.upload_end_date);
            baseDate.setDate(baseDate.getDate() + 1); // 다음 날
            baseDate.setHours(23, 59, 0, 0); // 23:59:00

            const dueDateKST = new Date(baseDate.getTime() - (baseDate.getTimezoneOffset() * 60000)); // KST 보정

            return {
                askId: ic.influencerContractId,
                title: contract.title,
                due_date: dueDateKST.toISOString(), // ISO 형식 그대로 반환
                review_status: ic.review_status
            };
        }).filter(Boolean);

        // 정렬 적용
        result.sort((a, b) => {
            const dateA = new Date(a.due_date);
            const dateB = new Date(b.due_date);
            return sort === 'oldest' ? dateA - dateB : dateB - dateA;
        });

        return res.status(200).json({ data: result });
    } catch (error) {
        console.log('readAsks error: ', error);
        return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
};

// 문의 내용 조회하기
// GET /api/auth/ask/:askId
exports.readAsk = async (req, res) => {
    try {
        const { askId } = req.params;

        // 1. InfluencerContract에서 해당 ID로 조회
        const ic = await InfluencerContract.findOne({ influencerContractId: askId });
        if (!ic) {
            return res.status(404).json({ message: '해당 문의를 찾을 수 없습니다.' });
        }

        // 2. 연결된 Contract 조회
        const contract = await Contract.findOne({ id: ic.contract_id });
        if (!contract) {
            return res.status(404).json({ message: '해당 문의의 계약 정보를 찾을 수 없습니다.' });
        }

        // 3. 응답 형식 구성
        const response = {
            url: ic.url,
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
        };

        return res.status(200).json(response);

    } catch (error) {
        console.log('readAsk error: ', error);
        return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
};

// 문의 APPROVE 하기
// POST /api/auth/ask/:askId/approve
exports.approveAsk = async (req, res) => {
    try {
        const { askId } = req.params;

        const ic = await InfluencerContract.findOne({ influencerContractId: askId });
        if (!ic) {
            return res.status(404).json({ message: '해당 문의를 찾을 수 없습니다.' });
        }

        ic.review_status = 'APPROVED';
        await ic.save();

        return res.status(200).json({ message: '문의가 승인되었습니다.' });
    } catch (error) {
        console.log('approveAsk error: ', error);
        return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
};


// 문의 REJECT 하기
// POST /api/auth/ask/:askId/reject
exports.rejectAsk = async (req, res) => {
    try {
        const { askId } = req.params;

        const ic = await InfluencerContract.findOne({ influencerContractId: askId });
        if (!ic) {
            return res.status(404).json({ message: '해당 문의를 찾을 수 없습니다.' });
        }

        ic.review_status = 'REJECTED';
        await ic.save();

        return res.status(200).json({ message: '문의가 반려되었습니다.' });
    } catch (error) {
        console.log('rejectAsk error: ', error);
        return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
};