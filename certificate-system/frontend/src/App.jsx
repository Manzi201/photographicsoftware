import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import ClassesManager from './pages/ClassesManager';
import UploadStudents from './pages/UploadStudents';
import SearchStudent from './pages/SearchStudent';
import GenerateCertificate from './pages/GenerateCertificate';
import PrintAll from './pages/PrintAll';
import TemplatePage from './pages/TemplatePage';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import SmsStudents      from './pages/sms/Students';
import SmsMarks         from './pages/sms/Marks';
import SmsBulletins     from './pages/sms/Bulletins';
import SmsFinance       from './pages/sms/Finance';
import SmsNotifications from './pages/sms/Notifications';
import AdminStaff       from './pages/sms/AdminStaff';
import Promotion        from './pages/sms/Promotion';
import Documents        from './pages/sms/Documents';
import SmsClasses       from './pages/sms/SmsClasses';
import Timetable        from './pages/sms/Timetable';
import RoleDashboard    from './pages/sms/dashboards/RoleDashboard';

// ── Check if any valid session exists (Supabase admin OR staff token) ──
function hasSession(user) {
  if (user) return true;
  const token = localStorage.getItem('staff_token');
  const data  = localStorage.getItem('staff_data');
  return !!(token && data);
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  const staffToken = localStorage.getItem('staff_token');
  const staffData  = localStorage.getItem('staff_data');
  const hasStaff   = !!(staffToken && staffData);

  // Staff session: bypass Supabase loading entirely
  if (hasStaff) return children;

  // Supabase admin: wait for auth to resolve
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"/>
          <p className="text-gray-400 text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  if (user) return children;
  return <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  const staffToken = localStorage.getItem('staff_token');
  const staffData  = localStorage.getItem('staff_data');
  const hasStaff   = !!(staffToken && staffData);

  // Staff already logged in → redirect immediately, no flash
  if (hasStaff) return <Navigate to="/sms/dashboard" replace />;

  // Supabase admin loading
  if (loading) return children;

  if (user) return <Navigate to="/sms/dashboard" replace />;
  return children;
}

function AppRoutes() {
  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{ duration: 3000, style: { borderRadius: '12px', fontSize: '14px' } }}
      />
      <Routes>
        {/* Public */}
        <Route path="/login"           element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register"        element={<PublicRoute><Register /></PublicRoute>} />
        <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
        <Route path="/staff-login"     element={<Navigate to="/login" replace />} />

        {/* Protected — all inside Layout */}
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index                        element={<Dashboard />} />
          <Route path="classes"               element={<ClassesManager />} />
          <Route path="upload"                element={<UploadStudents />} />
          <Route path="search"                element={<SearchStudent />} />
          <Route path="generate"              element={<GenerateCertificate />} />
          <Route path="print-all"             element={<PrintAll />} />
          <Route path="templates/:templateId" element={<TemplatePage />} />
          <Route path="settings"              element={<Settings />} />
          <Route path="profile"               element={<Profile />} />
          {/* SMS */}
          <Route path="sms/dashboard"     element={<RoleDashboard />} />
          <Route path="sms/admin"         element={<AdminStaff />} />
          <Route path="sms/students"      element={<SmsStudents />} />
          <Route path="sms/classes"       element={<SmsClasses />} />
          <Route path="sms/marks"         element={<SmsMarks />} />
          <Route path="sms/bulletins"     element={<SmsBulletins />} />
          <Route path="sms/finance"       element={<SmsFinance />} />
          <Route path="sms/notifications" element={<SmsNotifications />} />
          <Route path="sms/promotion"     element={<Promotion />} />
          <Route path="sms/documents"     element={<Documents />} />
          <Route path="sms/timetable"     element={<Timetable />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
