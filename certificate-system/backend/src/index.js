require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fileUpload = require('express-fileupload');

const authRoutes        = require('./routes/auth');
const studentRoutes     = require('./routes/students');
const certificateRoutes = require('./routes/certificates');
const templateRoutes    = require('./routes/templates');
const settingsRoutes    = require('./routes/settings');
const requireAuth       = require('./middleware/auth');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── CORS — allow Netlify + localhost ──────────────────────────
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://certficatesystem.netlify.app',  // your Netlify domain
  'https://certificate-system.netlify.app',
  /\.netlify\.app$/,   // any Netlify preview deploy
  /\.onrender\.com$/,  // Render itself
];

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile app, curl, Postman)
    if (!origin) return cb(null, true);
    const allowed = ALLOWED_ORIGINS.some((o) =>
      typeof o === 'string' ? o === origin : o.test(origin)
    );
    cb(allowed ? null : new Error(`CORS blocked: ${origin}`), allowed);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(fileUpload({
  limits:       { fileSize: 10 * 1024 * 1024 },
  useTempFiles: false,
}));

// ── PUBLIC ROUTES ─────────────────────────────────────────────
app.use('/api/auth', authRoutes);

// Root — show API info instead of 404
app.get('/', (req, res) => {
  res.json({
    name: 'Certificate System API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health:    'GET /api/health',
      auth:      'POST /api/auth/register | /api/auth/login | /api/auth/me',
      students:  'GET|POST /api/students',
      certs:     'GET /api/certificates/batch | /api/certificates/student/:id',
      templates: 'GET /api/templates',
      settings:  'GET|POST /api/settings',
    }
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/templates', (req, res) => {
  res.json({ success: true, data: [
    { id: 'Top Class',  name: 'Top Class',        color: '#B8860B' },
    { id: 'P6',         name: 'Primary 6 (P6)',   color: '#0B5DAB' },
    { id: 'S3',         name: 'Senior 3 (S3)',     color: '#0B8A2A' },
    { id: 'S6',         name: 'Senior 6 (S6)',     color: '#8A0B0B' },
    { id: 'Nursery',    name: 'Nursery',           color: '#6B0B8A' },
    { id: 'Graduation', name: 'Graduation',        color: '#7A5C00' },
  ]});
});

// ── PROTECTED ROUTES ──────────────────────────────────────────
app.use('/api/students',     requireAuth, studentRoutes);
app.use('/api/certificates', requireAuth, certificateRoutes);
app.use('/api/settings',     requireAuth, settingsRoutes);

// ── 404 handler ───────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route not found: ${req.method} ${req.path}` });
});

// ── Error handler ─────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ success: false, error: err.message });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);
});
