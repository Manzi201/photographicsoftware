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

const NAV = [
  { section: 'Overview' },
  { to: '/',              icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/classes',       icon: BookOpen,        label: 'Classes' },
  { section: 'Students' },
  { to: '/upload',        icon: Upload,          label: 'Upload Students' },
  { to: '/search',        icon: Search,          label: 'Search Student' },
  { section: 'Certificates' },
  { to: '/generate',      icon: Award,           label: 'Generate Certificate' },
  { to: '/print-all',     icon: Printer,         label: 'Print All' },
  { section: '🏫 School Mgmt' },
  { to: '/sms/dashboard',     icon: LayoutDashboard, label: 'SMS Dashboard' },
  { to: '/sms/admin',         icon: Shield,          label: 'Staff Management' },
  { to: '/sms/students',      icon: Users,           label: 'Registration' },
  { to: '/sms/marks',         icon: BookOpen,        label: 'Marks & Grades' },
  { to: '/sms/bulletins',     icon: FileText,        label: 'Bulletins' },
  { to: '/sms/promotion',     icon: TrendingUp,      label: 'Promotion' },
  { to: '/sms/finance',       icon: CreditCard,      label: 'Finance' },
  { to: '/sms/notifications', icon: Bell,            label: 'Notifications' },
  { section: 'Templates' },
  { to: '/templates/Top Class', icon: GraduationCap, label: 'Top Class' },
  { to: '/templates/P6',        icon: GraduationCap, label: 'P6' },
  { to: '/templates/S3',        icon: GraduationCap, label: 'S3' },
  { to: '/templates/S6',        icon: GraduationCap, label: 'S6' },
  { section: 'Account' },
  { to: '/profile',       icon: UserCircle,      label: 'My Profile' },
  { to: '/settings',      icon: Settings,        label: 'Settings' },
];

export default function Layout() {
  const { user, school, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);
  const [userMenu, setUserMenu] = useState(false);

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* ── Sidebar ── */}
      <aside className={`${open ? 'w-64' : 'w-16'} bg-gray-950 text-white flex flex-col transition-all duration-300 shrink-0`}>

        {/* Top brand */}
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

        {/* School badge */}
        {open && school && (
          <div className="mx-3 mt-3 bg-blue-950 border border-blue-800 rounded-xl px-3 py-2.5">
            <div className="flex items-center gap-2 min-w-0">
              {school.logo_url
                ? <img src={school.logo_url} alt="logo" className="w-7 h-7 rounded-md object-contain bg-white p-0.5 shrink-0" />
                : <div className="w-7 h-7 rounded-md bg-blue-700 flex items-center justify-center shrink-0">
                    <School className="w-4 h-4 text-white" />
                  </div>}
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate">{school.school_name}</p>
                <p className="text-xs text-blue-400">Year: {school.active_year}</p>
              </div>
            </div>
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
              <NavLink key={item.to} to={item.to} end={item.to === '/'}
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
                  {user?.email?.charAt(0)}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-xs font-semibold text-white truncate">{user?.email}</p>
                  <p className="text-xs text-gray-500 truncate">{school?.school_name}</p>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform shrink-0 ${userMenu ? 'rotate-180' : ''}`} />
              </button>

              {userMenu && (
                <div className="absolute bottom-full left-0 right-0 mb-1 bg-gray-900 border border-gray-700 rounded-xl overflow-hidden shadow-2xl">
                  <NavLink to="/profile" onClick={() => setUserMenu(false)}
                    className="flex items-center gap-2.5 px-4 py-3 text-sm text-gray-300 hover:bg-gray-800 transition-colors">
                    <UserCircle className="w-4 h-4" /> My Profile
                  </NavLink>
                  <NavLink to="/settings" onClick={() => setUserMenu(false)}
                    className="flex items-center gap-2.5 px-4 py-3 text-sm text-gray-300 hover:bg-gray-800 transition-colors">
                    <Settings className="w-4 h-4" /> Settings
                  </NavLink>
                  <div className="border-t border-gray-700" />
                  <button onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-red-400 hover:bg-gray-800 transition-colors">
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button onClick={handleLogout}
              className="w-full flex justify-center p-2.5 rounded-xl hover:bg-gray-800 text-red-400 transition-colors"
              title="Sign Out">
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
