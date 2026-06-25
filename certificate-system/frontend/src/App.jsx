import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import ClassesManager from './pages/ClassesManager';
import UploadStudents from './pages/UploadStudents';
import SearchStudent from './pages/SearchStudent';
import GenerateCertificate from './pages/GenerateCertificate';
import PrintAll from './pages/PrintAll';
import TemplatePage from './pages/TemplatePage';
import Settings from './pages/Settings';
import Profile from './pages/Profile';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-400 text-sm">Loading your account...</p>
        </div>
      </div>
    );
  }
  return user ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return !user ? children : <Navigate to="/" replace />;
}

function AppRoutes() {
  return (
    <>
      <Toaster position="top-right" toastOptions={{
        duration: 3000,
        style: { borderRadius: '12px', fontSize: '14px' },
      }} />
      <Routes>
        <Route path="/login"    element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index                         element={<Dashboard />} />
          <Route path="classes"                element={<ClassesManager />} />
          <Route path="upload"                 element={<UploadStudents />} />
          <Route path="search"                 element={<SearchStudent />} />
          <Route path="generate"               element={<GenerateCertificate />} />
          <Route path="print-all"              element={<PrintAll />} />
          <Route path="templates/:templateId"  element={<TemplatePage />} />
          <Route path="settings"               element={<Settings />} />
          <Route path="profile"                element={<Profile />} />
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
