// src/models/admin.js

const mongoose = require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose);

const modelNameSchema = new mongoose.Schema({
    id
    password
});

// Auto-increment 설정
modelNameSchema.plugin(AutoIncrement, { inc_field: 'id' });

module.exports = mongoose.model('ModelName', modelNameSchema);