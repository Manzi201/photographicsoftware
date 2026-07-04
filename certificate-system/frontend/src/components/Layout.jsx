import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Upload, Search, Award,
  Printer, Settings, GraduationCap, Menu, X,
  LogOut, ChevronDown, BookOpen, UserCircle, School,
  FileText, CreditCard, Bell, Shield, TrendingUp
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

// ── Nav items per role ─────────────────────────────────────────
const NAV_BY_ROLE = {

  // ── ADMIN (school owner via Supabase) ──────────────────────
  admin: [
    { section: 'Overview' },
    { to: '/',              icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/classes',       icon: BookOpen,        label: 'Classes' },
    { section: 'Certificates' },
    { to: '/upload',        icon: Upload,          label: 'Upload Students' },
    { to: '/search',        icon: Search,          label: 'Search Student' },
    { to: '/generate',      icon: Award,           label: 'Generate Certificate' },
    { to: '/print-all',     icon: Printer,         label: 'Print All' },
    { to: '/templates/Top Class', icon: GraduationCap, label: 'Top Class' },
    { to: '/templates/P6',        icon: GraduationCap, label: 'P6' },
    { to: '/templates/S3',        icon: GraduationCap, label: 'S3' },
    { to: '/templates/S6',        icon: GraduationCap, label: 'S6' },
    { section: '🏫 School Mgmt' },
    { to: '/sms/dashboard',     icon: LayoutDashboard, label: 'SMS Dashboard' },
    { to: '/sms/admin',         icon: Shield,          label: 'Staff Management' },
    { to: '/sms/students',      icon: Users,           label: 'Registration' },
    { to: '/sms/marks',         icon: BookOpen,        label: 'Marks & Grades' },
    { to: '/sms/bulletins',     icon: FileText,        label: 'Bulletins' },
    { to: '/sms/promotion',     icon: TrendingUp,      label: 'Promotion' },
    { to: '/sms/finance',       icon: CreditCard,      label: 'Finance' },
    { to: '/sms/notifications', icon: Bell,            label: 'Notifications' },
    { section: 'Account' },
    { to: '/profile',           icon: UserCircle,      label: 'My Profile' },
    { to: '/settings',          icon: Settings,        label: 'Settings' },
  ],

  // ── SECRETARY ──────────────────────────────────────────────
  secretary: [
    { section: 'My Dashboard' },
    { to: '/sms/dashboard',       icon: LayoutDashboard, label: 'Dashboard' },
    { section: 'Students' },
    { to: '/sms/students',        icon: Users,           label: 'Registration' },
    { to: '/upload',              icon: Upload,          label: 'Upload Photos/CSV' },
    { to: '/search',              icon: Search,          label: 'Search Student' },
    { section: 'Certificates' },
    { to: '/generate',            icon: Award,           label: 'Generate Certificate' },
    { to: '/print-all',           icon: Printer,         label: 'Print All' },
    { to: '/templates/Top Class', icon: GraduationCap,   label: 'Top Class' },
    { to: '/templates/P6',        icon: GraduationCap,   label: 'P6' },
    { to: '/templates/S3',        icon: GraduationCap,   label: 'S3' },
    { to: '/templates/S6',        icon: GraduationCap,   label: 'S6' },
    { section: 'Report Cards' },
    { to: '/sms/bulletins',       icon: FileText,        label: 'Print Bulletins' },
  ],

  // ── TEACHER ────────────────────────────────────────────────
  teacher: [
    { section: 'My Dashboard' },
    { to: '/sms/dashboard',     icon: LayoutDashboard, label: 'Dashboard' },
    { section: 'Academics' },
    { to: '/sms/marks',         icon: BookOpen,        label: 'Enter Marks' },
    { to: '/sms/bulletins',     icon: FileText,        label: 'View Bulletins' },
  ],

  // ── FINANCE ────────────────────────────────────────────────
  finance: [
    { section: 'My Dashboard' },
    { to: '/sms/dashboard',     icon: LayoutDashboard, label: 'Dashboard' },
    { section: 'Finance' },
    { to: '/sms/finance',       icon: CreditCard,      label: 'Fees & Payments' },
    { to: '/sms/notifications', icon: Bell,            label: 'Fee Reminders' },
  ],

  // ── DIRECTOR OF STUDIES ─────────────────────────────────────
  dos: [
    { section: 'My Dashboard' },
    { to: '/sms/dashboard',     icon: LayoutDashboard, label: 'Dashboard' },
    { section: 'Academics' },
    { to: '/sms/students',      icon: Users,           label: 'Students' },
    { to: '/sms/marks',         icon: BookOpen,        label: 'Marks & Grades' },
    { to: '/sms/bulletins',     icon: FileText,        label: 'Bulletins' },
    { to: '/sms/promotion',     icon: TrendingUp,      label: 'Promotion' },
    { to: '/classes',           icon: BookOpen,        label: 'Classes' },
  ],
};

export default function Layout() {
  const { user, school, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);
  const [userMenu, setUserMenu] = useState(false);

  // Detect current role
  const staffData  = localStorage.getItem('staff_data');
  const staffToken = localStorage.getItem('staff_token');
  let currentRole = 'admin';
  let currentName = school?.school_name || 'SchoolMS';
  let currentSubtitle = school?.active_year || '';
  let isStaffLogin = false;

  if (staffToken && staffData) {
    const staff = JSON.parse(staffData);
    currentRole    = staff.role || 'admin';
    currentName    = staff.full_name || 'Staff';
    const staffSchool = localStorage.getItem('staff_school');
    if (staffSchool) {
      const s = JSON.parse(staffSchool);
      currentSubtitle = `${s.school_name} · ${s.active_year||''}`;
    }
    isStaffLogin = true;
  }

  const NAV = NAV_BY_ROLE[currentRole] || NAV_BY_ROLE.admin;

  const handleLogout = () => {
    if (isStaffLogin) {
      // Logout staff session
      localStorage.removeItem('staff_token');
      localStorage.removeItem('staff_data');
      localStorage.removeItem('staff_school');
      toast.success('Logged out');
      navigate('/staff-login');
    } else {
      logout();
      toast.success('Logged out');
      navigate('/login');
    }
  };

  const ROLE_LABELS = { admin:'Administrator', secretary:'Secretary', teacher:'Teacher', finance:'Finance', dos:'Director of Studies' };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* ── Sidebar ── */}
      <aside className={`${open ? 'w-64' : 'w-16'} bg-gray-950 text-white flex flex-col transition-all duration-300 shrink-0`}>

        {/* Brand */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-800 min-h-[60px]">
          {open && (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="w-7 h-7 bg-yellow-400 rounded-lg flex items-center justify-center shrink-0">
                <Award className="w-4 h-4 text-gray-900" />
              </div>
              <span className="font-bold text-sm truncate">SchoolMS</span>
            </div>
          )}
          <button onClick={() => setOpen(!open)}
            className="p-1.5 rounded-lg hover:bg-gray-800 transition-colors ml-auto shrink-0">
            {open ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>

        {/* Role badge + school info */}
        {open && (
          <div className="mx-3 mt-3 bg-blue-950 border border-blue-800 rounded-xl px-3 py-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-md bg-blue-700 flex items-center justify-center shrink-0">
                <School className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate">{currentName}</p>
                <p className="text-xs text-blue-400 truncate">{currentSubtitle}</p>
              </div>
            </div>
            {isStaffLogin && (
              <div className="mt-1.5">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full
                  ${currentRole==='admin'?'bg-red-900 text-red-300':
                    currentRole==='secretary'?'bg-green-900 text-green-300':
                    currentRole==='teacher'?'bg-blue-900 text-blue-300':
                    currentRole==='finance'?'bg-amber-900 text-amber-300':
                    'bg-purple-900 text-purple-300'}`}>
                  {ROLE_LABELS[currentRole]||currentRole}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-3 space-y-0.5">
          {NAV.map((item, i) => {
            if (item.section) {
              return open
                ? <div key={i} className="px-4 pt-4 pb-1.5">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{item.section}</span>
                  </div>
                : <div key={i} className="mx-3 my-2 border-t border-gray-800" />;
            }
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to}
                end={item.to === '/' || item.to === '/sms/dashboard'}
                className={({ isActive }) =>
                  `flex items-center gap-3 mx-2 px-3 py-2.5 rounded-xl text-sm transition-all
                   ${isActive
                     ? 'bg-blue-600 text-white shadow-sm'
                     : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
                <Icon className="w-4 h-4 shrink-0" />
                {open && <span className="truncate font-medium">{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="border-t border-gray-800 p-2">
          {open ? (
            <div className="relative">
              <button onClick={() => setUserMenu(!userMenu)}
                className="w-full flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-gray-800 transition-colors">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold shrink-0 uppercase">
                  {currentName?.charAt(0)}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-xs font-semibold text-white truncate">{currentName}</p>
                  <p className="text-xs text-gray-500 truncate">{ROLE_LABELS[currentRole]||currentRole}</p>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform shrink-0 ${userMenu?'rotate-180':''}`} />
              </button>

              {userMenu && (
                <div className="absolute bottom-full left-0 right-0 mb-1 bg-gray-900 border border-gray-700 rounded-xl overflow-hidden shadow-2xl">
                  {!isStaffLogin && (
                    <>
                      <NavLink to="/profile" onClick={() => setUserMenu(false)}
                        className="flex items-center gap-2.5 px-4 py-3 text-sm text-gray-300 hover:bg-gray-800">
                        <UserCircle className="w-4 h-4" /> My Profile
                      </NavLink>
                      <NavLink to="/settings" onClick={() => setUserMenu(false)}
                        className="flex items-center gap-2.5 px-4 py-3 text-sm text-gray-300 hover:bg-gray-800">
                        <Settings className="w-4 h-4" /> Settings
                      </NavLink>
                      <div className="border-t border-gray-700" />
                    </>
                  )}
                  <button onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-red-400 hover:bg-gray-800">
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button onClick={handleLogout}
              className="w-full flex justify-center p-2.5 rounded-xl hover:bg-gray-800 text-red-400"
              title="Sign Out">
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
