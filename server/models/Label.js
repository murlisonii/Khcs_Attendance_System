const mongoose = require('mongoose');

const LabelSchema = new mongoose.Schema({
  name: { type: String, required: true },
  avatarUrl: { type: String },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  ownerLocation: { type: String },
  descriptors: { type: Array, default: [] },
  createdAt: { type: Date, default: Date.now }
},{timestamps:true});

module.exports = mongoose.model('Label', LabelSchema);
