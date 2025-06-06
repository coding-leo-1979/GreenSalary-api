// src/controllers/auth.controller.js

const Admin = require('../models/admin');
const Advertiser = require('../models/advertiser');
const Influencer = require('../models/influencer');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

exports.signup = async (req, res) => {
    try {
        const { role, email, password, passwordConfirm, walletAddress, name, description} = req.body;

        // 필수 항목 체크
        if ( !role || !email || !password || !passwordConfirm || !walletAddress || !name ) {
            return res.status(400).json({ "message": "필수 입력 항목이 누락되었습니다." })
        }

        if (password !== passwordConfirm) {
            return res.status(400).json({ message: '비밀번호와 비밀번호 확인이 일치하지 않습니다.' });
        }

        // role이 advertiser 또는 influencer인지 체크
        if (!['advertiser', 'influencer'].includes(role)) {
            return res.status(400).json({ message: '유효하지 않은 역할입니다.' });
        }

        // 이메일 중복 확인
        const Model = role === 'advertiser' ? Advertiser : Influencer;
        const existingUser = await Model.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ message: '이미 등록된 이메일입니다.' });
        }

        // 비밀번호 해시화
        const hashedPassword = await bcrypt.hash(password, 10);

        // 새 사용자 생성
        const newUser = new Model({
            email,
            password: hashedPassword,
            wallet_address: walletAddress,
            name,
            description
        });

        await newUser.save();

        return res.status(201).json({ message: "회원가입이 완료되었습니다." });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "서버 오류가 발생했습니다." });
    }
};

exports.signin = async (req, res) => {
    try {
        const { role, email, password } = req.body;

        // 필수 입력값 체크
        if (!email || !password) {
            return res.status(400).json({ message: '잘못된 요청입니다.' });
        }

        let user;
        let user_id;

        // advertiser 테이블에서 사용자 찾기
        if (role === 'advertiser') {
            user = await Advertiser.findOne({ email });
            if (user) {
                user_id = user.advertiserId;
            }
        }

        // influencer 테이블에서 사용자 찾기
        if (role === 'influencer') {
            user = await Influencer.findOne({ email });
            if (user) {
                user_id = user.influencerId;
            }
        }

        // 사용자를 찾을 수 없는 경우
        if (!user) {
            return res.status(401).json({ message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
        }
        
        // 비밀번호 검증
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
        }

        let user_name = user.name;

        // JWT 토큰 생성
        const payload = {
            userId: user_id,
            userName: user_name,
            role
        }
        const accessToken = jwt.sign(
            payload,
            process.env.JWT_SECRET_KEY,
            { expiresIn: '2h' }
        )

        return res.status(200).json({ accessToken, user_name, role, message: "로그인되었습니다." });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
}

// 관리자 로그인
// POST /api/auth/admin
exports.adminSignin = async (req, res) => {
    try {
        const { role, id, pw } = req.body;

        if (role !== 'admin' || !id || !pw) {
            return res.status(400).json({ message: '잘못된 요청입니다.' });
        }

        const admin = await Admin.findOne({ id });
        if (!admin) {
            return res.status(401).json({ message: '아이디가 올바르지 않습니다.' });
        }

        if (pw !== admin.pw) {
            return res.status(401).json({ message: '비밀번호가 올바르지 않습니다.' });
        }

        const payload = {
            userId: id
        }

    } catch (error) {
        console.log('example error: ', error);
        return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
};