const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, location, avatarUrl } = req.body;
    if (!name || !email || !password) return res.status(400).json({ success: false, error: 'name,email,password required' });
    const existing = await User.findOne({ email }).exec();
    if (existing) return res.status(400).json({ success: false, error: 'email already exists' });
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    const user = new User({ name, email, passwordHash: hash, location, avatarUrl });
    await user.save();
    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '12h' });
    res.json({ success: true, token, user: { id: user._id, name: user.name, email: user.email, location: user.location, avatarUrl: user.avatarUrl } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, error: 'email,password required' });
    const user = await User.findOne({ email }).exec();
    if (!user) return res.status(400).json({ success: false, error: 'invalid credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(400).json({ success: false, error: 'invalid credentials' });
    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '12h' });
    res.json({ success: true, token, user: { id: user._id, name: user.name, email: user.email, location: user.location, avatarUrl: user.avatarUrl } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/auth/me - return user info for a valid token
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).exec();
    if (!user) return res.status(401).json({ success: false, error: 'invalid user' });
    res.json({ success: true, user: { id: user._id, name: user.name, email: user.email, location: user.location, avatarUrl: user.avatarUrl } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

