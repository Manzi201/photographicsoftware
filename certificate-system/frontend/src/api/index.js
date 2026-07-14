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

const sms = axios.create({ baseURL: SMS_URL, timeout: 60000 }); // 60s for Render cold start
sms.interceptors.request.use(config => {
  const staffToken = localStorage.getItem('staff_token');
  const certToken  = localStorage.getItem('cert_token');
  const token = staffToken || certToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
// Auto-logout on 401, retry once on timeout/503
sms.interceptors.response.use(
  r => r,
  async err => {
    // Expired/invalid token → clear session and redirect to login
    if (err.response?.status === 401) {
      localStorage.removeItem('staff_token');
      localStorage.removeItem('staff_data');
      localStorage.removeItem('staff_school');
      // Only redirect if we're not already on login
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
      return Promise.reject(err);
    }
    // Retry once on timeout or 503 (Render cold start)
    if ((err.code === 'ECONNABORTED' || err.response?.status === 503) && !err.config._retry) {
      err.config._retry = true;
      err.config.timeout = 60000;
      await new Promise(r => setTimeout(r, 3000)); // wait 3s before retry
      return sms(err.config);
    }
    return Promise.reject(err);
  }
);

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

// ── Academic Years ────────────────────────────────────────────
export const getAcademicYears    = ()       => sms.get('/academic-years');
export const createAcademicYear  = (d)      => sms.post('/academic-years', d);
export const updateAcademicYear  = (id, d)  => sms.put(`/academic-years/${id}`, d);
export const deleteAcademicYear  = (id)     => sms.delete(`/academic-years/${id}`);

// ── Terms ─────────────────────────────────────────────────────
export const getTerms    = (p)      => sms.get('/terms', { params: p });
export const createTerm  = (d)      => sms.post('/terms', d);
export const updateTerm  = (id, d)  => sms.put(`/terms/${id}`, d);
export const deleteTerm  = (id)     => sms.delete(`/terms/${id}`);

// ── Classes ───────────────────────────────────────────────────
export const getSmsClasses   = (p)      => sms.get('/classes', { params: p });
export const createSmsClass  = (d)      => sms.post('/classes', d);
export const updateSmsClass  = (id, d)  => sms.put(`/classes/${id}`, d);
export const deleteSmsClass  = (id)     => sms.delete(`/classes/${id}`);

// ── Subjects ──────────────────────────────────────────────────
export const getSmsSubjects  = (p)      => sms.get('/subjects', { params: p });
export const createSmsSubject= (d)      => sms.post('/subjects', d);
export const updateSmsSubject= (id, d)  => sms.put(`/subjects/${id}`, d);
export const deleteSmsSubject= (id)     => sms.delete(`/subjects/${id}`);
export const assignSubjectToAllClasses = (subject_id) => sms.post('/class-subjects/assign-all', { subject_id });
export const setTeacherForSubject = (d) => sms.put('/class-subjects/set-teacher', d);

// ── Staff list ────────────────────────────────────────────────
export const getStaff   = ()       => sms.get('/staff');
export const createStaff= (d)      => sms.post('/staff', d);
export const updateStaff= (id, d)  => sms.put(`/staff/${id}`, d);

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

// ── Student bulk import ───────────────────────────────────────
export const importStudentsExcel = (file) => {
  const fd = new FormData();
  fd.append('file', file);
  return sms.post('/students/import', fd, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 });
};

// ── Timetable ─────────────────────────────────────────────────
export const getTtRooms           = ()      => sms.get('/timetable/rooms');
export const createTtRoom         = (d)     => sms.post('/timetable/rooms', d);
export const updateTtRoom         = (id, d) => sms.put(`/timetable/rooms/${id}`, d);
export const deleteTtRoom         = (id)    => sms.delete(`/timetable/rooms/${id}`);
export const getTtPeriods         = (p)     => sms.get('/timetable/periods', { params: p });
export const createTtPeriod       = (d)     => sms.post('/timetable/periods', d);
export const updateTtPeriod       = (id, d) => sms.put(`/timetable/periods/${id}`, d);
export const deleteTtPeriod       = (id)    => sms.delete(`/timetable/periods/${id}`);
export const getTtSlots           = (p)     => sms.get('/timetable/slots', { params: p });
export const upsertTtSlot         = (d)     => sms.post('/timetable/slots', d);
export const deleteTtSlot         = (id)    => sms.delete(`/timetable/slots/${id}`);
export const clearClassTimetable  = (d)     => sms.post('/timetable/clear', d);
export const autoGenerateTimetable = (d)    => sms.post('/timetable/auto-generate', d);
export const getTtWorkload        = (p)     => sms.get('/timetable/reports/workload',  { params: p });
export const getTtConflicts       = (p)     => sms.get('/timetable/reports/conflicts', { params: p });
export const exportClassTimetable   = (p)   => sms.get('/timetable/export/class',   { params: p, responseType: 'blob' });
export const exportTeacherTimetable = (p)   => sms.get('/timetable/export/teacher', { params: p, responseType: 'blob' });
export const exportSchoolTimetable  = (p)   => sms.get('/timetable/export/school',  { params: p, responseType: 'blob' });
