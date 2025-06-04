// src/models/influencer_contract.js

const mongoose = require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose);

const influencerContractSchema = new mongoose.Schema({
  contract_id: { type: String, required: true, ref: 'Contract' },
  advertiser_id: { type: Number, required: true, ref: 'Advertiser' },
  influencer_id: { type: Number, required: true, ref: 'Influencer' },
  joined_at: { type: Date, required: true },

  url: { type: String, default: null },
  keywordTest: { type: Boolean, default: false },
  conditiondTest: { type: Boolean, default: false },
  
  review_status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'REVIEW_FROM_ADV', 'REVIEW_FROM_INF'],
    default: 'PENDING',
  },
  reward_paid: { type: Boolean, default: false },
  reward_paid_at: { type: Date, default: null},
});

// Auto-increment 설정
influencerContractSchema.plugin(AutoIncrement, { inc_field: 'influencerContractId' });

module.exports = mongoose.model('InfluencerContract', influencerContractSchema);