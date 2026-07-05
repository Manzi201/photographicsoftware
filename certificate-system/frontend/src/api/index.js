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

// ══════════════════════════════════════════════════════════════
// SCHOOL MANAGEMENT SYSTEM API
// ══════════════════════════════════════════════════════════════
const SMS_URL = (() => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace('/api','/api/sms');
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost')
    return 'https://photographicsoftware-1.onrender.com/api/sms';
  return '/api/sms';
})();

const sms = axios.create({ baseURL: SMS_URL, timeout: 30000 });
sms.interceptors.request.use(config => {
  const token = localStorage.getItem('cert_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Staff Auth ────────────────────────────────────────────────
export const staffLogin    = (d) => axios.post(`${SMS_URL.replace('/sms','')}/staff-auth/login`, d);
export const staffLogout   = ()  => sms.post('/staff-auth/logout');
export const getStaffMe    = ()  => sms.get('/staff-auth/me');
export const getSmsStudents       = (params) => sms.get('/students', { params });
export const getSmsStudent        = (id)     => sms.get(`/students/${id}`);
export const createSmsStudent     = (data)   => sms.post('/students', data, { headers:{'Content-Type':'multipart/form-data'} });
export const updateSmsStudent     = (id, d)  => sms.put(`/students/${id}`, d);
export const deleteSmsStudent     = (id)     => sms.delete(`/students/${id}`);
export const getSmsStudentStats   = ()       => sms.get('/students/stats');

// ── Academic ──────────────────────────────────────────────────
export const getAcademicYears    = ()    => sms.get('/academic-years');
export const createAcademicYear  = (d)   => sms.post('/academic-years', d);
export const getTerms            = (p)   => sms.get('/terms', { params: p });
export const createTerm          = (d)   => sms.post('/terms', d);
export const getSmsClasses       = (p)   => sms.get('/classes', { params: p });
export const createSmsClass      = (d)   => sms.post('/classes', d);
export const deleteSmsClass      = (id)  => sms.delete(`/classes/${id}`);
export const getSmsSubjects      = (p)   => sms.get('/subjects', { params: p });
export const createSmsSubject    = (d)   => sms.post('/subjects', d);
export const deleteSmsSubject    = (id)  => sms.delete(`/subjects/${id}`);
export const getStaff            = ()    => sms.get('/staff');
export const createStaff         = (d)   => sms.post('/staff', d);
export const updateStaff         = (id,d)=> sms.put(`/staff/${id}`, d);

// ── Marks ─────────────────────────────────────────────────────
export const getMarks         = (p)  => sms.get('/marks', { params: p });
export const upsertMark       = (d)  => sms.post('/marks', d);
export const bulkUpsertMarks  = (d)  => sms.post('/marks/bulk', d);
export const getClassReport   = (p)  => sms.get('/marks/class-report', { params: p });

// ── Bulletins ─────────────────────────────────────────────────
export const getBulletins      = (p)  => sms.get('/bulletins', { params: p });
export const generateBulletin  = (d)  => sms.post('/bulletins/generate', d, { responseType:'blob' });
export const generateClassBulletins = (d) => sms.post('/bulletins/generate-class', d, { responseType:'blob' });

// ── Finance ───────────────────────────────────────────────────
export const getFeeStructure    = (p) => sms.get('/finance/fee-structure', { params: p });
export const createFeeStructure = (d) => sms.post('/finance/fee-structure', d);
export const deleteFeeStructure = (id)=> sms.delete(`/finance/fee-structure/${id}`);
export const getPayments        = (p) => sms.get('/finance/payments', { params: p });
export const recordPayment      = (d) => sms.post('/finance/payments', d);
export const getReceipt         = (id)=> sms.get(`/finance/payments/${id}/receipt`, { responseType:'blob' });
export const getFinanceSummary  = (p) => sms.get('/finance/summary', { params: p });

// ── Notifications ─────────────────────────────────────────────
export const getNotifications   = (p) => sms.get('/notifications', { params: p });
export const sendFeeReminder    = (d) => sms.post('/notifications/fee-reminder', d);
export const notifyBulletinReady= (d) => sms.post('/notifications/bulletin', d);
export const sendCustomNotif    = (d) => sms.post('/notifications/custom', d);

// ── Excel Export ──────────────────────────────────────────────
export const exportStudentsExcel = (p) => sms.get('/excel/students', { params: p, responseType: 'blob' });
export const exportMarksExcel    = (p) => sms.get('/excel/marks',    { params: p, responseType: 'blob' });
export const exportFinanceExcel  = (p) => sms.get('/excel/finance',  { params: p, responseType: 'blob' });
