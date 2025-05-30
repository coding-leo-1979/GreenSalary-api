// src/middlewares/auth.middleware.js

const jwt = require('jsonwebtoken');

// 토큰 인증
exports.verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];

    if ( !authHeader || !authHeader.startsWith('Bearer ')){
        return res.status(401).json({ message: "인증이 필요합니다." });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
        req.user = decoded;
        next();
    } catch (error){
        console.error(error);
        return res.status(401).json({ message: "유효하지 않은 토큰입니다." });
    }
}

// 역할 인증
exports.verifyRole = (requiredRole) => {
    return (req, res, next) => {
        if (req.user.role !== requiredRole) {
            return res.status(403).json({ message: `${requiredRole} 권한이 필요합니다.` });
        }
        next();
    }
}