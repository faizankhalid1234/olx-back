const express = require('express');
const User = require('../models/User');
const Ad = require('../models/Ad');
const auth = require('../middleware/auth');

const router = express.Router();

// Get user profile
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update user profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { name, phone, city } = req.body;
    const user = await User.findById(req.user._id);

    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (city) user.city = city;

    await user.save();
    res.json({ message: 'Profile updated successfully', user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get user's ads
router.get('/:id/ads', async (req, res) => {
  try {
    const ads = await Ad.find({ seller: req.params.id, status: 'active' }).sort({ createdAt: -1 });
    res.json(ads);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
