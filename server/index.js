const express = require('express');
const cors = require('cors');
const { getConfig } = require('./config');

const authRoutes = require('./routes/authRoutes');
const databaseRoutes = require('./routes/databaseRoutes');
const dataRoutes = require('./routes/dataRoutes');

const app = express();
const config = getConfig();
const PORT = config.PORT || 5000;

// Enable CORS for client app
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Parse JSON bodies
app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Invoice ERP Secure API Gateway',
    serverTime: new Date().toISOString(),
    auth: 'JWT Bearer token enabled',
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/database', databaseRoutes);
app.use('/api/data', dataRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[API Server Error]:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`🚀 Secure JWT API Server running on port ${PORT}`);
  console.log(`🔒 All /api/data/* endpoints secured with JWT tokens`);
  console.log(`📊 Google Sheets sync proxy active`);
  console.log(`=======================================================`);
});
