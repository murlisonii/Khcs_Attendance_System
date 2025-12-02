const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  avatarUrl: { type: String },
  location: { type: String },
  role: { type: String, default: 'admin' },
  createdAt: { type: Date, default: Date.now }
},{timestamps:true});

module.exports = mongoose.model('User', UserSchema);
