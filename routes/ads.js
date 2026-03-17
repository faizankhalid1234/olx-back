const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Ad = require('../models/Ad');
const auth = require('../middleware/auth');

const router = express.Router();

const isVercel = process.env.VERCEL === '1';

// Create uploads directory only when not on Vercel (read-only filesystem)
let storage;
if (isVercel) {
  storage = multer.memoryStorage();
} else {
  const uploadsDir = path.join(__dirname, '../uploads');
  try {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
  } catch (err) {
    console.warn('Could not create uploads directory:', err.message);
  }
  storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  });
}

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Get all ads with filters
router.get('/', async (req, res) => {
  try {
    const { category, search, city, minPrice, maxPrice, page = 1, limit = 12 } = req.query;
    const query = { status: 'active' };

    // Category filter - include old category names for backward compatibility
    if (category) {
      const categoryMap = {
        'Cars': ['Cars', 'Vehicles'],
        'Motorcycles': ['Motorcycles', 'Bikes'],
        'Fashion': ['Fashion', 'Clothing'],
      };
      const categoriesToMatch = categoryMap[category] || [category];
      query.category = { $in: categoriesToMatch };
    }
    if (city) query['location.city'] = new RegExp(city, 'i');
    if (minPrice) query.price = { ...query.price, $gte: Number(minPrice) };
    if (maxPrice) query.price = { ...query.price, $lte: Number(maxPrice) };
    if (search) {
      query.$or = [
        { title: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') }
      ];
    }

    const skip = (page - 1) * limit;
    const ads = await Ad.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('seller', 'name phone city');

    const total = await Ad.countDocuments(query);

    res.json({
      ads,
      totalPages: Math.ceil(total / limit),
      currentPage: Number(page),
      total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get user's ads - MUST be before /:id to avoid "user" being matched as id
router.get('/user/my-ads', auth, async (req, res) => {
  try {
    const ads = await Ad.find({ seller: req.user._id }).sort({ createdAt: -1 });
    res.json(ads);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single ad
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid ad ID' });
    }
    const ad = await Ad.findById(id).populate('seller', 'name email phone city');
    
    if (!ad) {
      return res.status(404).json({ message: 'Ad not found' });
    }

    // Increment views
    ad.views += 1;
    await ad.save();

    res.json(ad);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create ad
router.post('/', auth, upload.array('images', 5), async (req, res) => {
  try {
    const { title, description, price, category, condition, city, address, sellerPhone } = req.body;
    
    const images = req.files ? req.files.filter(f => f.filename).map(file => `/uploads/${file.filename}`) : [];

    const ad = new Ad({
      title,
      description,
      price: Number(price),
      category,
      condition,
      images,
      location: {
        city,
        address
      },
      seller: req.user._id,
      sellerName: req.user.name,
      sellerPhone: sellerPhone || req.user.phone
    });

    await ad.save();
    res.status(201).json(ad);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update ad
router.put('/:id', auth, upload.array('images', 5), async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid ad ID' });
    }
    const ad = await Ad.findById(id);
    
    if (!ad) {
      return res.status(404).json({ message: 'Ad not found' });
    }

    if (ad.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const { title, description, price, category, condition, city, address, sellerPhone } = req.body;
    
    if (title) ad.title = title;
    if (description) ad.description = description;
    if (price) ad.price = Number(price);
    if (category) ad.category = category;
    if (condition) ad.condition = condition;
    if (city) ad.location.city = city;
    if (address) ad.location.address = address;
    if (sellerPhone) ad.sellerPhone = sellerPhone;

    // Handle new images
    if (req.files && req.files.length > 0) {
      const newImages = req.files.filter(f => f.filename).map(file => `/uploads/${file.filename}`);
      ad.images = [...ad.images, ...newImages];
    }

    await ad.save();
    res.json(ad);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete ad
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid ad ID' });
    }
    const ad = await Ad.findById(id);
    
    if (!ad) {
      return res.status(404).json({ message: 'Ad not found' });
    }

    if (ad.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    ad.status = 'deleted';
    await ad.save();

    res.json({ message: 'Ad deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
