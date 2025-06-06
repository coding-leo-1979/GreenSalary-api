// src/models/admin.js

const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  pw: { type: String, required: true },
});

module.exports = mongoose.model('Admin', adminSchema);