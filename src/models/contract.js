// src/models/contracts.js

const mongoose = require('mongoose');
const { nanoid } = require('nanoid');

const contractSchema = new mongoose.Schema({
  id: { type: String, default: () => nanoid(16), unique: true },
  advertiser_id: { type: String, required: true, ref: 'Advertiser' },
  title: { type: String, required: true },
  reward: { type: Number, required: true },
  recruits: { type: Number, required: true },
  participants: { type: Number, default: 0},
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

module.exports = mongoose.model('Contract', contractSchema);