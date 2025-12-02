const express = require('express');
const router = express.Router();
const Label = require('../models/Label');
const User = require('../models/User');
const auth = require('../middleware/auth');

// list labels - require auth and return only labels owned by the admin
router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).exec();
    if (!user) return res.status(401).json({ success: false, error: 'invalid user' });
    const labels = await Label.find({ owner: user._id }).limit(1000).exec();
    res.json({ success: true, items: labels });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// create label (protected) - admin only
router.post('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).exec();
    if (!user) return res.status(401).json({ success:false, error:'invalid user' });
    const { name, avatarUrl, descriptors } = req.body;
    const label = new Label({ name, avatarUrl, descriptors, owner: user._id, ownerLocation: user.location });
    const doc = await label.save();
    res.json({ success: true, item: doc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// delete label (protected) - admin only
router.delete('/:id', auth, async (req, res) => {
  try {
    const id = req.params.id;
    const user = await User.findById(req.user.id).exec();
    if (!user) return res.status(401).json({ success:false, error:'invalid user' });
    const doc = await Label.findById(id).exec();
    if (!doc) return res.status(404).json({ success:false, error:'not found' });
    // allow delete only if owner matches. If owner is not set but ownerLocation matches,
    // allow the acting admin to claim ownership and then delete (legacy support).
    if (doc.owner) {
      if (String(doc.owner) !== String(user._id)) return res.status(403).json({ success:false, error:'forbidden' });
    } else {
      // owner not set: only allow if ownerLocation matches user's location, then claim ownership
      if (doc.ownerLocation && doc.ownerLocation === user.location) {
        doc.owner = user._id;
        await doc.save();
      } else {
        return res.status(403).json({ success:false, error:'forbidden' });
      }
    }
    // `doc.remove()` may not be available depending on Mongoose version/config;
    // use `deleteOne()` on the document which is supported and deletes the record.
    await doc.deleteOne();
    res.json({ success: true, item: doc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// update label (protected)
router.put('/:id', auth, async (req, res) => {
  try {
    const id = req.params.id;
    const { name, avatarUrl } = req.body;
    const user = await User.findById(req.user.id).exec();
    if (!user) return res.status(401).json({ success:false, error:'invalid user' });
    const doc = await Label.findById(id).exec();
    if (!doc) return res.status(404).json({ success: false, error: 'not found' });
    // allow update only if owner matches. If owner is not set but ownerLocation matches,
    // allow the acting admin to claim ownership and then update (legacy support).
    if (doc.owner) {
      if (String(doc.owner) !== String(user._id)) return res.status(403).json({ success:false, error:'forbidden' });
    } else {
      if (doc.ownerLocation && doc.ownerLocation === user.location) {
        doc.owner = user._id;
      } else {
        return res.status(403).json({ success:false, error:'forbidden' });
      }
    }
    if (name !== undefined) doc.name = name;
    if (avatarUrl !== undefined) doc.avatarUrl = avatarUrl;
    await doc.save();
    res.json({ success: true, item: doc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// claim an unowned label (only when owner undefined and ownerLocation matches user's location)
router.post('/:id/claim', auth, async (req, res) => {
  try {
    const id = req.params.id;
    const user = await User.findById(req.user.id).exec();
    if (!user) return res.status(401).json({ success:false, error:'invalid user' });
    const doc = await Label.findById(id).exec();
    if (!doc) return res.status(404).json({ success:false, error:'not found' });
    if (doc.owner) return res.status(400).json({ success:false, error:'already owned' });
    if (doc.ownerLocation && doc.ownerLocation === user.location) {
      doc.owner = user._id;
      await doc.save();
      return res.json({ success:true, item: doc });
    }
    return res.status(403).json({ success:false, error:'forbidden' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success:false, error: err.message });
  }
});

module.exports = router;
