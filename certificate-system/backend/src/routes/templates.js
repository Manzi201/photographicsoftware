const express = require('express');
const router = express.Router();

const TEMPLATES = [
  { id: 'Top Class', name: 'Top Class', color: '#B8860B' },
  { id: 'P6', name: 'Primary 6 (P6)', color: '#0B5DAB' },
  { id: 'S3', name: 'Senior 3 (S3)', color: '#0B8A2A' },
  { id: 'S6', name: 'Senior 6 (S6)', color: '#8A0B0B' },
  { id: 'Nursery', name: 'Nursery', color: '#6B0B8A' },
  { id: 'Graduation', name: 'Graduation', color: '#7A5C00' },
];

router.get('/', (req, res) => {
  res.json({ success: true, data: TEMPLATES });
});

module.exports = router;
