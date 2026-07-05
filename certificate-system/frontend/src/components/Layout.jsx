import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Home, Shield, Users, Upload, Search, Award, Printer,
  Settings, GraduationCap, Menu, X, LogOut, ChevronDown,
  BookOpen, UserCircle, School, FileText, CreditCard, Bell,
  TrendingUp, Folder, Layers, ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

// ── Role colours ───────────────────────────────────────────────
const ROLE_META = {
  admin:     { label: 'Administrator',       dot: 'bg-rose-400',   badge: 'bg-rose-500/20 text-rose-300 ring-rose-500/30' },
  secretary: { label: 'Secretary',           dot: 'bg-emerald-400',badge: 'bg-emerald-500/20 text-emerald-300 ring-emerald-500/30' },
  teacher:   { label: 'Teacher',             dot: 'bg-sky-400',    badge: 'bg-sky-500/20 text-sky-300 ring-sky-500/30' },
  finance:   { label: 'Finance',             dot: 'bg-amber-400',  badge: 'bg-amber-500/20 text-amber-300 ring-amber-500/30' },
  dos:       { label: 'Director of Studies', dot: 'bg-violet-400', badge: 'bg-violet-500/20 text-violet-300 ring-violet-500/30' },
};

// ── Nav definitions per role ───────────────────────────────────
const NAV_BY_ROLE = {

  admin: [
    { section: 'Overview' },
    { to: '/sms/dashboard', icon: Home,       label: 'Dashboard' },
    { section: 'Management' },
    { to: '/sms/admin',     icon: Shield,     label: 'Staff Management' },
    { section: 'School' },
    { to: '/settings',      icon: Settings,   label: 'School Settings' },
    { to: '/profile',       icon: UserCircle, label: 'School Profile' },
  ],

  secretary: [
    { section: 'Overview' },
    { to: '/sms/dashboard',       icon: Home,          label: 'Dashboard' },
    { section: 'Students' },
    { to: '/sms/students',        icon: Users,         label: 'Registration' },
    { to: '/upload',              icon: Upload,        label: 'Upload Photos/CSV' },
    { to: '/search',              icon: Search,        label: 'Search Student' },
    { section: 'Certificates' },
    { to: '/generate',            icon: Award,         label: 'Generate Certificate' },
    { to: '/print-all',           icon: Printer,       label: 'Print All' },
    { to: '/templates/Top Class', icon: GraduationCap, label: 'Top Class' },
    { to: '/templates/P6',        icon: GraduationCap, label: 'P6' },
    { to: '/templates/S3',        icon: GraduationCap, label: 'S3' },
    { to: '/templates/S6',        icon: GraduationCap, label: 'S6' },
    { section: 'Report Cards' },
    { to: '/sms/bulletins',       icon: FileText,      label: 'Print Bulletins' },
    { section: 'Documents' },
    { to: '/sms/documents',       icon: Folder,        label: 'School Documents' },
  ],

  teacher: [
    { section: 'Overview' },
    { to: '/sms/dashboard', icon: Home,     label: 'Dashboard' },
    { section: 'Academics' },
    { to: '/sms/marks',     icon: BookOpen, label: 'Enter Marks' },
    { to: '/sms/bulletins', icon: FileText, label: 'View Bulletins' },
  ],

  finance: [
    { section: 'Overview' },
    { to: '/sms/dashboard',     icon: Home,       label: 'Dashboard' },
    { section: 'Finance' },
    { to: '/sms/finance',       icon: CreditCard, label: 'Fees & Payments' },
    { to: '/sms/notifications', icon: Bell,       label: 'Fee Reminders' },
  ],

  dos: [
    { section: 'Overview' },
    { to: '/sms/dashboard', icon: Home,       label: 'Dashboard' },
    { section: 'Academics' },
    { to: '/sms/students',  icon: Users,      label: 'Students' },
    { to: '/sms/marks',     icon: BookOpen,   label: 'Marks & Grades' },
    { to: '/sms/bulletins', icon: FileText,   label: 'Bulletins' },
    { to: '/sms/promotion', icon: TrendingUp, label: 'Promotion' },
    { to: '/sms/classes',   icon: Layers,     label: 'Classes & Years' },
  ],
};

// ── Helper: get school / user info from localStorage ──────────
function getSessionInfo(school) {
  const staffToken = localStorage.getItem('staff_token');
  const staffRaw   = localStorage.getItem('staff_data');
  const schoolRaw  = localStorage.getItem('staff_school');

  if (staffToken && staffRaw) {
    try {
      const staff   = JSON.parse(staffRaw);
      const sSchool = schoolRaw ? JSON.parse(schoolRaw) : {};
      return {
        isStaff:     true,
        role:        staff.role || 'teacher',
        displayName: staff.full_name || 'Staff',
        schoolName:  sSchool.school_name || 'School',
        schoolYear:  sSchool.active_year || '',
        logoUrl:     sSchool.logo_url    || null,
        initial:     (staff.full_name || 'S').charAt(0).toUpperCase(),
      };
    } catch {}
  }
  return {
    isStaff:     false,
    role:        'admin',
    displayName: school?.school_name || 'SchoolMS',
    schoolName:  school?.school_name || 'My School',
    schoolYear:  school?.active_year || '',
    logoUrl:     school?.logo_url    || null,
    initial:     (school?.school_name || 'S').charAt(0).toUpperCase(),
  };
}

export default function Layout() {
  const { school, logout } = useAuth();
  const navigate = useNavigate();

  const [sidebarOpen,  setSidebarOpen]  = useState(typeof window !== 'undefined' ? window.innerWidth >= 1024 : true);
  const [mobileOpen,   setMobileOpen]   = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const session  = getSessionInfo(school);
  const role     = session.role;
  const roleMeta = ROLE_META[role] || ROLE_META.admin;
  const NAV      = NAV_BY_ROLE[role] || NAV_BY_ROLE.admin;
  const expanded = sidebarOpen || mobileOpen;

  const handleLogout = () => {
    localStorage.removeItem('staff_token');
    localStorage.removeItem('staff_data');
    localStorage.removeItem('staff_school');
    logout();
    toast.success('Signed out');
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-[#0f1117] overflow-hidden">

      {/* ── Mobile backdrop ────────────────────────────────────── */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setMobileOpen(false)}/>
      )}

      {/* ══════════════════════════════════════════════════════════
          SIDEBAR
      ══════════════════════════════════════════════════════════ */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-40
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
        ${expanded ? 'w-[260px]' : 'lg:w-[68px] w-[260px]'}
        flex flex-col
        bg-[#13151c] border-r border-white/[0.06]
        transition-all duration-300 ease-in-out shrink-0
      `}>

        {/* ── Top bar: brand + toggle ─────────────────────────── */}
        <div className="flex items-center gap-3 px-4 h-[60px] border-b border-white/[0.06] shrink-0">
          {/* Logo mark */}
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shrink-0">
            <GraduationCap className="w-4 h-4 text-white" />
          </div>
          {expanded && (
            <span className="font-bold text-white text-[15px] tracking-tight flex-1 truncate">SchoolMS</span>
          )}
          {/* Desktop collapse */}
          <button onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden lg:flex items-center justify-center w-7 h-7 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-all shrink-0">
            <ChevronRight className={`w-4 h-4 transition-transform duration-300 ${sidebarOpen ? 'rotate-180' : ''}`}/>
          </button>
          {/* Mobile close */}
          <button onClick={() => setMobileOpen(false)}
            className="lg:hidden flex items-center justify-center w-7 h-7 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-all shrink-0">
            <X className="w-4 h-4"/>
          </button>
        </div>

        {/* ── School card ─────────────────────────────────────── */}
        {expanded && (
          <div className="mx-3 mt-3 rounded-2xl bg-gradient-to-br from-blue-600/20 via-indigo-600/10 to-transparent border border-white/10 p-3 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              {/* School logo or initial */}
              {session.logoUrl
                ? <img src={session.logoUrl} className="w-9 h-9 rounded-xl object-contain bg-white/10 p-0.5 shrink-0" alt="logo"/>
                : <div className="w-9 h-9 rounded-xl bg-blue-600/40 flex items-center justify-center text-sm font-bold text-white shrink-0">
                    {session.schoolName.charAt(0).toUpperCase()}
                  </div>
              }
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-white truncate leading-tight">
                  {session.schoolName}
                </p>
                {session.schoolYear && (
                  <p className="text-[11px] text-blue-300/80 mt-0.5">Year {session.schoolYear}</p>
                )}
              </div>
            </div>
            {/* Role badge */}
            <div className="mt-2.5">
              <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ring-1 ${roleMeta.badge}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${roleMeta.dot}`}/>
                {roleMeta.label}
              </span>
            </div>
          </div>
        )}

        {/* ── Nav items ──────────────────────────────────────── */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5 scrollbar-thin">
          {NAV.map((item, i) => {
            if (item.section) {
              return expanded
                ? <div key={i} className="px-2 pt-5 pb-1.5 first:pt-1">
                    <span className="text-[10px] font-bold text-gray-600 uppercase tracking-[0.12em]">
                      {item.section}
                    </span>
                  </div>
                : <div key={i} className="my-3 mx-1 border-t border-white/[0.06]"/>;
            }

            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to}
                end={item.to === '/sms/dashboard'}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) => `
                  group flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] font-medium
                  transition-all duration-150 relative
                  ${isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                    : 'text-gray-400 hover:text-white hover:bg-white/[0.06]'}
                `}>
                {/* Active indicator bar */}
                <Icon className="w-[17px] h-[17px] shrink-0"/>
                {expanded && <span className="truncate">{item.label}</span>}
                {/* Tooltip when collapsed */}
                {!expanded && (
                  <div className="absolute left-full ml-2 px-2.5 py-1.5 bg-gray-800 text-white text-xs rounded-lg
                    opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-xl
                    translate-x-1 group-hover:translate-x-0 transition-all duration-200">
                    {item.label}
                  </div>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* ── User footer ─────────────────────────────────────── */}
        <div className="border-t border-white/[0.06] p-2 shrink-0">
          {expanded ? (
            <div className="relative">
              <button onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.06] transition-all">
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold text-white shrink-0 uppercase
                  bg-gradient-to-br ${role === 'admin' ? 'from-rose-500 to-pink-600' :
                    role === 'secretary' ? 'from-emerald-500 to-teal-600' :
                    role === 'teacher'   ? 'from-sky-500 to-blue-600' :
                    role === 'finance'   ? 'from-amber-500 to-orange-600' :
                                           'from-violet-500 to-purple-600'}`}>
                  {session.initial}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-[13px] font-semibold text-white truncate leading-tight">
                    {session.displayName}
                  </p>
                  <p className="text-[11px] text-gray-500 truncate mt-0.5">{roleMeta.label}</p>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform shrink-0 ${userMenuOpen ? 'rotate-180' : ''}`}/>
              </button>

              {/* Dropdown */}
              {userMenuOpen && (
                <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#1a1d27] border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-50">
                  {!session.isStaff && (
                    <>
                      <NavLink to="/profile" onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 text-[13px] text-gray-300 hover:bg-white/[0.06] hover:text-white transition-all">
                        <UserCircle className="w-4 h-4 text-gray-500"/> School Profile
                      </NavLink>
                      <NavLink to="/settings" onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 text-[13px] text-gray-300 hover:bg-white/[0.06] hover:text-white transition-all">
                        <Settings className="w-4 h-4 text-gray-500"/> School Settings
                      </NavLink>
                      <div className="mx-3 border-t border-white/[0.06]"/>
                    </>
                  )}
                  <button onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 text-[13px] text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all">
                    <LogOut className="w-4 h-4"/> Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Collapsed: just logout icon */
            <button onClick={handleLogout} title="Sign Out"
              className="w-full flex items-center justify-center py-2.5 rounded-xl text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all">
              <LogOut className="w-[17px] h-[17px]"/>
            </button>
          )}
        </div>
      </aside>

      {/* ══════════════════════════════════════════════════════════
          MAIN CONTENT
      ══════════════════════════════════════════════════════════ */}
      <main className="flex-1 overflow-hidden flex flex-col bg-gray-50">

        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm shrink-0">
          <button onClick={() => setMobileOpen(true)}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <Menu className="w-5 h-5 text-gray-700"/>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-white"/>
            </div>
            <span className="font-bold text-sm text-gray-900">SchoolMS</span>
          </div>
          <button onClick={handleLogout}
            className="p-2 rounded-xl hover:bg-red-50 text-red-400 transition-colors">
            <LogOut className="w-5 h-5"/>
          </button>
        </div>

        {/* Page */}
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
