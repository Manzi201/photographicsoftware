require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fileUpload = require('express-fileupload');

const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/students');
const certificateRoutes = require('./routes/certificates');
const templateRoutes = require('./routes/templates');
const settingsRoutes = require('./routes/settings');
const requireAuth = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload({
  limits: { fileSize: 10 * 1024 * 1024 },
  useTempFiles: false,
}));

// ── PUBLIC ROUTES (no auth needed) ───────────────────────────
app.use('/api/auth', authRoutes);
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.get('/api/templates', (req, res) => {
  const TEMPLATES = [
    { id: 'Top Class', name: 'Top Class', color: '#B8860B' },
    { id: 'P6', name: 'Primary 6 (P6)', color: '#0B5DAB' },
    { id: 'S3', name: 'Senior 3 (S3)', color: '#0B8A2A' },
    { id: 'S6', name: 'Senior 6 (S6)', color: '#8A0B0B' },
    { id: 'Nursery', name: 'Nursery', color: '#6B0B8A' },
    { id: 'Graduation', name: 'Graduation', color: '#7A5C00' },
  ];
  res.json({ success: true, data: TEMPLATES });
});

// ── PROTECTED ROUTES (requireAuth on all) ────────────────────
app.use('/api/students', requireAuth, studentRoutes);
app.use('/api/certificates', requireAuth, certificateRoutes);
app.use('/api/settings', requireAuth, settingsRoutes);

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
