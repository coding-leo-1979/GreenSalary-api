// src/models/transaction.js

const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    contract_id: { type: String, required: true, ref: 'Contract' },
    advertiser_id: { type: Number, required: true, ref: 'Advertiser' },
    influencer_id: { type: Number, required: true, ref: 'Influencer' },
    amount: { type: String, required: true },
    paid_at: { type: Date, required: true },
    txHash: { type: String, required: true, unique: true }
});

module.exports = mongoose.model('Transaction', transactionSchema);