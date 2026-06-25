import axios from 'axios';

// ── Backend URL ────────────────────────────────────────────────
const RENDER_URL = 'https://photographicsoftware-1.onrender.com/api';

function getBaseURL() {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') return RENDER_URL;
  return '/api';
}

const api = axios.create({ baseURL: getBaseURL(), timeout: 30000 });

console.log('[CertSystem] API:', api.defaults.baseURL);

// ── Students ──────────────────────────────────────────────────
export const getStudents        = (params)   => api.get('/students', { params });
export const getStudent         = (id)       => api.get(`/students/${id}`);
export const createStudent      = (fd)       => api.post('/students', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
export const bulkUploadStudents = (students) => api.post('/students/bulk', { students });
export const updateStudentPhoto = (id, fd)   => api.patch(`/students/${id}/photo`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
export const deleteStudent      = (id)       => api.delete(`/students/${id}`);

// ── Certificates ──────────────────────────────────────────────
export const generateCertificate = (studentId, template, style = 'clean') =>
  api.get(`/certificates/student/${studentId}`, { params: { template, style }, responseType: 'blob' });
export const generateBatch   = (params) => api.get('/certificates/batch', { params, responseType: 'blob' });
export const getCertificates = ()       => api.get('/certificates');

// ── Templates ─────────────────────────────────────────────────
export const getTemplates = () => api.get('/templates');

// ── Settings ──────────────────────────────────────────────────
export const getSettings    = ()   => api.get('/settings');
export const updateSettings = (fd) => api.post('/settings', fd, { headers: { 'Content-Type': 'multipart/form-data' } });

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
