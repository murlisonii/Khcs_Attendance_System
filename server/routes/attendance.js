const express = require('express');
const router = express.Router();
const Attendance = require('../models/Attendance');

// POST /api/attendance
// Accepts either a single record or an array in `records`.
router.post('/', async (req, res) => {
  try {
    const { deviceId, session, timestamp } = req.body;
    const payloadRecords = req.body.records || req.body.recognized || [];

    // normalize single item
    const items = Array.isArray(payloadRecords) ? payloadRecords : [payloadRecords];

    const saved = [];
    for (const it of items) {
      const name = it.name || it.label || it.labelName;
      if (!name) continue;
      const attendance = new Attendance({
        deviceId,
        session,
        name,
        labelId: it.labelId || undefined,
        confidence: typeof it.confidence === 'number' ? it.confidence : undefined,
        timestamp: it.time || timestamp || new Date(),
        metadata: it.metadata || {}
      });
      const doc = await attendance.save();
      saved.push(doc);
    }

    res.json({ success: true, saved });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/attendance/session
// Save a whole session: present and absent arrays
router.post('/session', async (req, res) => {
  try {
    const { deviceId, session, present = [], absent = [], timestamp } = req.body;
    const time = timestamp ? new Date(timestamp) : new Date();
    const docs = [];

    // helper to escape regex
    const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // insert present records (skip if already recorded for same session & day)
    for (const p of present) {
      const name = p.name || p;
      if (!name) continue;
      const recordTime = p.time ? new Date(p.time) : time;
      const dayStart = new Date(recordTime);
      dayStart.setHours(0,0,0,0);
      const dayEnd = new Date(recordTime);
      dayEnd.setHours(23,59,59,999);
      const existing = await Attendance.findOne({ name: { $regex: '^' + esc(name) + '$', $options: 'i' }, session, timestamp: { $gte: dayStart, $lte: dayEnd } }).exec();
      if (existing) continue; // already recorded for this day/session
      const attendance = new Attendance({ deviceId, session, name, present: true, confidence: p.confidence, timestamp: p.time || time, metadata: p.metadata || {} });
      docs.push(attendance.save());
    }

    // insert absent records (skip if already recorded for same session & day)
    for (const a of absent) {
      const name = a.name || a;
      if (!name) continue;
      const recordTime = a.time ? new Date(a.time) : time;
      const dayStart = new Date(recordTime);
      dayStart.setHours(0,0,0,0);
      const dayEnd = new Date(recordTime);
      dayEnd.setHours(23,59,59,999);
      const existing = await Attendance.findOne({ name: { $regex: '^' + esc(name) + '$', $options: 'i' }, session, timestamp: { $gte: dayStart, $lte: dayEnd } }).exec();
      if (existing) continue;
      const attendance = new Attendance({ deviceId, session, name, present: false, confidence: a.confidence, timestamp: a.time || time, metadata: a.metadata || {} });
      docs.push(attendance.save());
    }

    const saved = await Promise.all(docs);
    res.json({ success: true, saved });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/attendance?date=YYYY-MM-DD&session=...&name=...
router.get('/', async (req, res) => {
  try {
    const { date, session, name } = req.query;
    const q = {};
    if (session) q.session = session;
    if (name) q.name = name;
    if (date) {
      const start = new Date(date + 'T00:00:00Z');
      const end = new Date(date + 'T23:59:59Z');
      q.timestamp = { $gte: start, $lte: end };
    }
    const docs = await Attendance.find(q).sort({ timestamp: 1 }).limit(1000).exec();
    res.json({ success: true, items: docs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
