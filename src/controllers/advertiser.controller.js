// src/controllers/advertiser.controller.js

const Contract = require('../models/contract');
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