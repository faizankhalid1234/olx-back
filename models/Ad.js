const mongoose = require('mongoose');

const adSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  category: {
    type: String,
    required: true,
    // OLX Pakistan style + backward compatible with old categories
    enum: ['Mobiles', 'Cars', 'Motorcycles', 'Houses', 'TV-Video-Audio', 'Tablets', 'Land-Plots', 'Bikes', 'Furniture', 'Electronics', 'Books', 'Fashion', 'Kids', 'Animals', 'Business', 'Services', 'Jobs', 'Real Estate', 'Sports', 'Other', 'Vehicles', 'Clothing']
  },
  condition: {
    type: String,
    enum: ['New', 'Like New', 'Used', 'For Parts'],
    default: 'Used'
  },
  images: [{
    type: String
  }],
  location: {
    city: {
      type: String,
      required: true
    },
    address: {
      type: String
    }
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sellerName: {
    type: String,
    required: true
  },
  sellerPhone: {
    type: String
  },
  views: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'sold', 'deleted'],
    default: 'active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
adSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Ad', adSchema);
