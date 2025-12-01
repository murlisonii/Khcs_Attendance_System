const mongoose = require('mongoose');

const AttendanceSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: false },
  deviceId: { type: String },
  session: { type: String },
  name: { type: String, required: true },
  present: { type: Boolean, default: true },
  labelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Label' },
  confidence: { type: Number },
  timestamp: { type: Date, default: Date.now, index: true },
  metadata: { type: mongoose.Schema.Types.Mixed }
},{timestamps:true});

module.exports = mongoose.model('Attendance', AttendanceSchema);
