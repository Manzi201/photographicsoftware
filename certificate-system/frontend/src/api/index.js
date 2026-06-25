import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

// Students
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

// Certificates
export const generateCertificate = (studentId, template) =>
  api.get(`/certificates/student/${studentId}`, {
    params: { template },
    responseType: 'blob'
  });

export const generateBatch = (params) =>
  api.get('/certificates/batch', { params, responseType: 'blob' });

export const getCertificates = () => api.get('/certificates');

// Templates
export const getTemplates = () => api.get('/templates');

// Settings (now uses schools table)
export const getSettings = () => api.get('/settings');
export const updateSettings = (formData) => api.post('/settings', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});

// Helper: download blob as file
export const downloadBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
};

// Helper: open blob in new tab for printing
export const printBlob = (blob) => {
  const url = window.URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (win) {
    win.addEventListener('load', () => {
      win.print();
    });
  }
};

export default api;
