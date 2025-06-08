// src/models/AnalysisJob.js

const mongoose = require('mongoose');

const analysisJobSchema = new mongoose.Schema({
    jobId: {
        type: String,
        required: true,
        unique: true,
        default: () => require('uuid').v4()
    },
    contract_id: {
        type: String,
        required: true
    },
    influencer_id: {
        type: Number,
        required: true
    },
    url: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['processing', 'completed', 'failed'],
        default: 'processing'
    },
    result: {
        keywordTest: { type: Boolean },
        conditionTest: { type: Boolean },
        wordCountTest: { type: Boolean },
        imageCountTest: { type: Boolean },
        pdf_url: { type: String }
    },
    error_message: {
        type: String
    }
}, {
    timestamps: true, // createdAt, updatedAt 자동 생성
    collection: 'analysis_jobs'
});

// 복합 인덱스 생성 (조회 성능 향상)
analysisJobSchema.index({ contract_id: 1, influencer_id: 1 });
analysisJobSchema.index({ jobId: 1 });

module.exports = mongoose.model('AnalysisJob', analysisJobSchema);