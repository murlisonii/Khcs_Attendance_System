const express = require('express');
const router = express.Router();
const Label = require('../models/Label');

// list labels
router.get('/', async (req, res) => {
  try {
    const labels = await Label.find({}).limit(1000).exec();
    res.json({ success: true, items: labels });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// create label
router.post('/', async (req, res) => {
  try {
    const { name, avatarUrl, descriptors } = req.body;
    const label = new Label({ name, avatarUrl, descriptors });
    const doc = await label.save();
    res.json({ success: true, item: doc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
