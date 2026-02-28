import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Normalize CLIENT_URL by removing trailing slash
const normalizeUrl = (url) => {
  if (!url) return '';
  return url.endsWith('/') ? url.slice(0, -1) : url;
};

// CORS configuration
const clientUrl = normalizeUrl(process.env.CLIENT_URL) || 'https://portfolio-tushar-kaklotar.vercel.app';

const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:5000',
      clientUrl
    ];

    // In development, allow any origin
    if (NODE_ENV === 'development') {
      return callback(null, true);
    }

    // In production, check origin
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log(`[CORS] Rejected origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  exposedHeaders: ['Content-Type', 'X-Custom-Header'],
  maxAge: 3600,
  optionsSuccessStatus: 200
};

// Enable CORS with proper configuration
app.use(cors(corsOptions));

// Handle OPTIONS requests explicitly
app.options('*', cors(corsOptions));

// Limit request body size to prevent abuse
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Request validation middleware
app.use((req, res, next) => {
  // Validate content-type for POST/PUT requests
  if (['POST', 'PUT'].includes(req.method)) {
    const contentType = req.get('content-type');
    if (contentType && !contentType.includes('application/json') && !contentType.includes('application/x-www-form-urlencoded')) {
      return res.status(415).json({
        success: false,
        message: 'Content-Type must be application/json'
      });
    }
  }
  
  // Log request in development
  if (NODE_ENV === 'development') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - Origin: ${req.get('origin')}`);
  }
  
  next();
});

// Routes
import emailRoutes from './routes/email.js';
app.use('/api', emailRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Backend server is running',
    environment: NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Portfolio Backend API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      sendEmail: 'POST /api/send-email'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.path}`
  });
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('[Error Handler]', err.message);
  console.error('[Stack]', err.stack);

  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';

  res.status(status).json({
    success: false,
    message: NODE_ENV === 'development' ? message : 'Something went wrong. Please try again later.',
    ...(NODE_ENV === 'development' && { error: { message, stack: err.stack } })
  });
});

// Start server with better error handling
const server = app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║  Portfolio Backend Server Started      ║
╠════════════════════════════════════════╣
║  Environment: ${NODE_ENV.padEnd(28)}║
║  Port: ${String(PORT).padEnd(34)}║
║  URL: http://localhost:${String(PORT).padEnd(23)}║
║  Allowed Origin: ${clientUrl.padEnd(22)}║
╚════════════════════════════════════════╝
  `);
});

// Handle server errors
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Please use a different port.`);
  } else {
    console.error('Server error:', error.message);
  }
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error.message);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

