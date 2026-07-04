import React from 'react';
import { useAuth } from '../../../context/AuthContext';
import AdminDashboard     from './AdminDashboard';
import SecretaryDashboard from './SecretaryDashboard';
import TeacherDashboard   from './TeacherDashboard';
import FinanceDashboard   from './FinanceDashboard';
import DosDashboard       from './DosDashboard';

/**
 * Smart dashboard router:
 * - School admin (Supabase auth) → AdminDashboard
 * - Staff (session token) → role-specific dashboard
 */
export default function RoleDashboard() {
  const { user } = useAuth(); // Supabase admin

  // Check if logged in as staff (session token)
  const staffData  = localStorage.getItem('staff_data');
  const staffToken = localStorage.getItem('staff_token');

  if (staffToken && staffData) {
    const staff = JSON.parse(staffData);
    switch (staff.role) {
      case 'admin':     return <AdminDashboard />;
      case 'secretary': return <SecretaryDashboard />;
      case 'teacher':   return <TeacherDashboard />;
      case 'finance':   return <FinanceDashboard />;
      case 'dos':       return <DosDashboard />;
      default:          return <SecretaryDashboard />;
    }
  }

  // School admin (Supabase JWT) always gets full admin dashboard
  if (user) return <AdminDashboard />;

  return <AdminDashboard />;
}
