// src/routes/auth.route.js

const express = require('express');
const router = express.Router();
const { signup, signin, adminSignin } = require('../controllers/auth.controller');

router.post('/signup', signup);
router.post('/signin', signin);
router.post('/admin', adminSignin);

module.exports = router;