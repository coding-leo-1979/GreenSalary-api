// src/models/contract.js

const mongoose = require('mongoose');
const { nanoid, customAlphabet } = require('nanoid');

const generateId = () => nanoid(16);
const generateAccessCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 10);

const contractSchema = new mongoose.Schema({
  id: { type: String, unique: true },
  access_code: { type: String, unique: true },
  advertiser_id: { type: String, required: true, ref: 'Advertiser' },
  title: { type: String, required: true },
  reward: { type: String, required: true },
  recruits: { type: Number, required: true },
  participants: { type: Number, default: 0 },
  upload_start_date: { type: Date, required: true },
  upload_end_date: { type: Date, required: true },
  maintain_start_date: { type: Date },
  maintain_end_date: { type: Date },
  keywords: [{ type: String }],
  conditions: [{ type: String }],
  site: {
    type: String,
    enum: ['YouTube', 'Instagram', 'Naver Blog', 'etc'],
    required: true
  },
  media: {
    type: [
        {
            media_text: { type: Number, required: false },
            media_image: { type: Number, required: false },
        },
    ],
    default: []
  },
  description: { type: String },
  photo_url: { type: String },
  created_at: { type: Date, default: Date.now }
});

// 충돌 방지
contractSchema.pre('validate', async function (next) {
  const Contract = mongoose.model('Contract');

  if (!this.id) {
    let unique = false;
    while (!unique) {
      const tempId = generateId();
      const existing = await Contract.findOne({ id: tempId });
      if (!existing) {
        this.id = tempId;
        unique = true;
      }
    }
  }

  if (!this.access_code) {
    let unique = false;
    while (!unique) {
      const tempCode = generateAccessCode();
      const existing = await Contract.findOne({ access_code: tempCode });
      if (!existing) {
        this.access_code = tempCode;
        unique = true;
      }
    }
  }

  next();
});

module.exports = mongoose.model('Contract', contractSchema);