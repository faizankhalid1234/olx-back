const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load .env from backend folder
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Only serve uploads locally - Vercel has read-only filesystem
if (process.env.VERCEL !== '1') {
  const uploadsPath = path.join(__dirname, 'uploads');
  const fs = require('fs');
  if (fs.existsSync(uploadsPath)) {
    app.use('/uploads', express.static(uploadsPath));
  }
}

// MongoDB Connection
const mongoUri = process.env.MONGODB_URI;
if (!mongoUri && process.env.VERCEL !== '1') {
  console.error('Error: MONGODB_URI not found in .env file');
  process.exit(1);
}
if (mongoUri) {
  mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('MongoDB Connected Successfully'))
  .catch(err => console.error('MongoDB Connection Error:', err));
}

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/ads', require('./routes/ads'));
app.use('/api/users', require('./routes/users'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Root fallback (for Cloud Run/Firebase)
app.get('/', (req, res) => {
  res.json({ message: 'OLX API', docs: '/api/health', version: '1.0' });
});

// 404 handler - must be last; returns consistent JSON for unmatched API routes
app.use((req, res) => {
  if (req.originalUrl.startsWith('/api')) {
    return res.status(404).json({ message: 'API endpoint not found', code: 'NOT_FOUND' });
  }
  res.status(404).json({ message: 'Not found' });
});

// Global error handler - prevents serverless function crash
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: err.message || 'Internal server error' });
});

// Export for Vercel serverless; listen for local development
module.exports = app;

if (process.env.VERCEL !== '1') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}
