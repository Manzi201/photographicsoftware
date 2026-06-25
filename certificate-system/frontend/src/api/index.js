import axios from 'axios';

// ── Backend URL ────────────────────────────────────────────────
// Set VITE_API_URL in Netlify environment variables to override.
// Format: https://YOUR-SERVICE-NAME.onrender.com/api
const BASE_URL = import.meta.env.VITE_API_URL
  || (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
      ? import.meta.env.VITE_API_URL || '/api'   // fallback handled below
      : '/api');

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
});

// Log in console so you can see what URL is being used
if (typeof window !== 'undefined') {
  console.log('[CertSystem] API URL:', api.defaults.baseURL);
  console.log('[CertSystem] To fix 404: set VITE_API_URL in Netlify → Site config → Env variables');
  console.log('[CertSystem] Value: https://YOUR-RENDER-SERVICE.onrender.com/api');
}

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
  api.get(`/certificates/student/${studentId}`, { params: { template }, responseType: 'blob' });
export const generateBatch = (params) =>
  api.get('/certificates/batch', { params, responseType: 'blob' });
export const getCertificates = () => api.get('/certificates');

// ── Templates ─────────────────────────────────────────────────
export const getTemplates = () => api.get('/templates');

// ── Settings ──────────────────────────────────────────────────
export const getSettings = () => api.get('/settings');
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
