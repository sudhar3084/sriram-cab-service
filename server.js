const express = require('express');
const cors = require('cors');
const path = require('path');
const dns = require('dns');
require('dotenv').config();
console.log('DEBUG MONGO_URI:', process.env.MONGO_URI);

// Fix for ISP DNS not resolving MongoDB SRV records
dns.setServers(['8.8.8.8', '8.8.4.4']);

const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const bookingRoutes = require('./routes/bookings');


// Connect to MongoDB
connectDB();


const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '8mb' }));

// Log every request
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`📥 ${req.method} ${req.path} | Auth: ${req.headers.authorization ? 'YES' : 'NO'}`);
  }
  next();
});

// Serve frontend
app.use(express.static(path.join(__dirname, 'public')));
// Also serve from parent directory (for local dev)
app.use(express.static(path.join(__dirname, '..')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/bookings', bookingRoutes);

// Serve index.html for any non-API route
app.get('/{*splat}', (req, res) => {
  const publicIndex = path.join(__dirname, 'public', 'index.html');
  const parentIndex = path.join(__dirname, '..', 'index.html');
  const fs = require('fs');
  if (fs.existsSync(publicIndex)) {
    res.sendFile(publicIndex);
  } else {
    res.sendFile(parentIndex);
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚗 Sriram Cab Service server running on http://localhost:${PORT}`);
});
