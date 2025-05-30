// src/models/influencers.js

const mongoose = require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose);

const influencerSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  wallet_address: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String }
}, { timestamps: true });

// Auto-increment 설정
influencerSchema.plugin(AutoIncrement, { inc_field: 'influencerId' });

// 모델 등록
module.exports = mongoose.model('Influencer', influencerSchema);