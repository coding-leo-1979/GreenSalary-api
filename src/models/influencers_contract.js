// src/models/influencer_contract.js

const mongoose = require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose);

const influencerContractSchema = new mongoose.Schema({
  contract_id: { type: String, required: true, ref: 'Contract' },
  advertiser_id: { type: Number, required: true, ref: 'Advertiser' },
  influencer_id: { type: Number, required: true, ref: 'Influencer' },
  joined_at: { type: Date, required: true },
  ad_url: { type: String, default: null },
  review_status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'REVIEW_FROM_ADV', 'REVIEW_FROM_INF'],
    default: 'PENDING',
  },
  reward_paid: { type: Boolean, default: false },
  reward_paid_at: { type: Date, default: null},
});

// Auto-increment 설정
influencerSchema.plugin(AutoIncrement, { inc_field: 'influencerContractId' });

module.exports = mongoose.model('InfluencerContract', influencerContractSchema);