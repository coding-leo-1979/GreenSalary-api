// src/server.js

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;

const connectDB = require('./config/db');
const blockchainService = require('./services/blockchainService');
const paymentScheduler = require('./services/paymentScheduler');

// 라우트
const authRoutes = require('./routes/auth.route');
const adminRoutes = require('./routes/admin.route');
const advertiserRoutes = require('./routes/advertiser.route');
const influencerRoutes = require('./routes/influencer.route');
const paymentRoutes = require('./routes/payment');

// Cloudinary 설정
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer-Cloudinary 스토리지 설정
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'uploads',
    format: async () => 'png',
    public_id: (req, file) => file.originalname,
  },
});
const upload = multer({ storage });

const app = express();

// 데이터베이스 연결
connectDB();

// 공통 미들웨어
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API 라우트
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/advertiser', advertiserRoutes);
app.use('/api/influencer', influencerRoutes);
app.use('/api/payment', paymentRoutes);

// 이미지 업로드 라우트
app.post('/api/image', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: '이미지 업로드 실패' });
  }
  res.status(200).json({ imageUrl: req.file.path });
});

// 정적 파일 서빙 (프론트엔드 배포 대응)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('public'));
}

// 기본 루트
app.get('/', (req, res) => {
  res.send('Server is up and running!');
});

// 서버 시작 함수
async function startServer() {
  try {
    const status = await blockchainService.getStatus();
    if (status.connected) {
      console.log('✅ Blockchain connection successful');
      console.log(`📍 Contract Address: ${status.contractAddress}`);
    } else {
      console.log('❌ Blockchain connection failed:', status.error);
    }

    if (process.env.NODE_ENV === 'production') {
      paymentScheduler.startDailySchedule(); // 운영 환경: 매일 오전 9시
    } else {
      console.log('🧪 Development mode: Using test schedule');
      paymentScheduler.startDailySchedule();
      // paymentScheduler.startQuickTest();
    }

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📚 Payment API available at http://localhost:${PORT}/api/payment`);
    });
  } catch (error) {
    console.error('❌ Server startup failed:', error);
  }
}

// 서버 시작
startServer();

// 종료 시 처리
const shutdown = () => {
  console.log('\n🛑 Shutting down server...');
  paymentScheduler.stopAll();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

module.exports = app;