import axios from 'axios';

// ── Backend URL resolution ─────────────────────────────────────
// Priority:
//   1. VITE_API_URL env variable (set in Netlify dashboard)
//   2. Auto-detect: if running on Netlify → use Render backend
//   3. Fallback to local proxy (dev only)
function getBaseURL() {
  // Explicitly set via Netlify environment variable (recommended)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // Running in production (not localhost) → use Render backend
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    return 'https://certificate-backend.onrender.com/api';
  }

  // Local development → Vite proxy handles /api → localhost:5000
  return '/api';
}

const BASE_URL = getBaseURL();

// Log the URL being used (visible in browser console for debugging)
if (typeof window !== 'undefined') {
  console.log('[CertSystem] API Base URL:', BASE_URL);
}

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000, // 30s timeout (Render free tier can be slow on cold start)
});

// ── Interceptor: add auth token to every request ──────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('cert_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Students ──────────────────────────────────────────────────
export const getStudents = (params) => api.get('/students', { params });
export const getStudent = (id) => api.get(`/students/${id}`);
export const createStudent = (formData) => api.post('/students', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});
export const bulkUploadStudents = (students) => api.post('/students/bulk', { students });
export const updateStudentPhoto = (id, formData) => api.patch(`/students/${id}/photo`, formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});
export const deleteStudent = (id) => api.delete(`/students/${id}`);

// ── Certificates ──────────────────────────────────────────────
export const generateCertificate = (studentId, template) =>
  api.get(`/certificates/student/${studentId}`, {
    params: { template },
    responseType: 'blob'
  });
export const generateBatch = (params) =>
  api.get('/certificates/batch', { params, responseType: 'blob' });
export const getCertificates = () => api.get('/certificates');

// ── Templates ─────────────────────────────────────────────────
export const getTemplates = () => api.get('/templates');

// ── Settings ──────────────────────────────────────────────────
export const getSettings  = () => api.get('/settings');
export const updateSettings = (formData) => api.post('/settings', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});

// ── Helpers ───────────────────────────────────────────────────
export const downloadBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
};

export const printBlob = (blob) => {
  const url = window.URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (win) win.addEventListener('load', () => win.print());
};

export default api;
