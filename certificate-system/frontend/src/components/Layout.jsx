import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Home, Shield, Users, Folder, Menu, X, LogOut,
  BookOpen, UserCircle, Settings, FileText, CreditCard, Bell,
  TrendingUp, Layers, Calendar, GraduationCap, ChevronRight,
  ChevronDown, LayoutDashboard
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

// ── Role config ───────────────────────────────────────────────
const ROLE_META = {
  admin:     { label: 'Administrator',       color: 'from-rose-500 to-rose-600',    bg: 'bg-rose-500/15',    text: 'text-rose-300'   },
  secretary: { label: 'Secretary',           color: 'from-emerald-500 to-teal-600', bg: 'bg-emerald-500/15', text: 'text-emerald-300'},
  teacher:   { label: 'Teacher',             color: 'from-sky-500 to-blue-600',     bg: 'bg-sky-500/15',     text: 'text-sky-300'    },
  finance:   { label: 'Finance',             color: 'from-amber-500 to-orange-500', bg: 'bg-amber-500/15',   text: 'text-amber-300'  },
  dos:       { label: 'Director of Studies', color: 'from-violet-500 to-purple-600',bg: 'bg-violet-500/15',  text: 'text-violet-300' },
};

// ── Nav per role ──────────────────────────────────────────────
const NAV_BY_ROLE = {
  admin: [
    { to: '/sms/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { divider: true },
    { to: '/sms/admin',     icon: Shield,     label: 'Staff Management' },
    { to: '/settings',      icon: Settings,   label: 'School Settings'  },
    { to: '/profile',       icon: UserCircle, label: 'School Profile'   },
  ],
  secretary: [
    { to: '/sms/dashboard', icon: LayoutDashboard, label: 'Dashboard'        },
    { divider: true },
    { to: '/sms/students',  icon: Users,    label: 'Students'          },
    { to: '/sms/bulletins', icon: FileText, label: 'Print Bulletins'   },
    { to: '/sms/documents', icon: Folder,   label: 'School Documents'  },
  ],
  teacher: [
    { to: '/sms/dashboard', icon: LayoutDashboard, label: 'Dashboard'    },
    { divider: true },
    { to: '/sms/marks',     icon: BookOpen, label: 'Enter Marks'    },
    { to: '/sms/bulletins', icon: FileText, label: 'View Bulletins' },
    { to: '/sms/timetable', icon: Calendar, label: 'My Timetable'   },
  ],
  finance: [
    { to: '/sms/dashboard',     icon: LayoutDashboard, label: 'Dashboard'       },
    { divider: true },
    { to: '/sms/finance',       icon: CreditCard, label: 'Fees & Payments' },
    { to: '/sms/notifications', icon: Bell,       label: 'Fee Reminders'   },
  ],
  dos: [
    { to: '/sms/dashboard', icon: LayoutDashboard, label: 'Dashboard'           },
    { divider: true },
    { to: '/sms/classes',   icon: Layers,     label: 'Classes & Years'    },
    { to: '/sms/timetable', icon: Calendar,   label: 'Timetable'          },
    { to: '/sms/marks',     icon: BookOpen,   label: 'Student Marks'      },
    { to: '/sms/bulletins', icon: FileText,   label: 'Bulletins'          },
    { to: '/sms/promotion', icon: TrendingUp, label: 'Promotion'          },
    { to: '/sms/students',  icon: Users,      label: 'Students'           },
  ],
};

function getSessionInfo(school) {
  try {
    const staffRaw  = localStorage.getItem('staff_data');
    const schoolRaw = localStorage.getItem('staff_school');
    const token     = localStorage.getItem('staff_token');
    if (token && staffRaw) {
      const staff   = JSON.parse(staffRaw);
      const sSchool = schoolRaw ? JSON.parse(schoolRaw) : {};
      return {
        isStaff:     true,
        role:        staff.role || 'teacher',
        displayName: staff.full_name || 'Staff',
        schoolName:  sSchool.school_name || 'School',
        schoolYear:  sSchool.active_year || '',
        logoUrl:     sSchool.logo_url    || null,
        initials:    (staff.full_name || 'S').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2),
      };
    }
  } catch {}
  return {
    isStaff:     false,
    role:        'admin',
    displayName: school?.school_name || 'Admin',
    schoolName:  school?.school_name || 'My School',
    schoolYear:  school?.active_year || '',
    logoUrl:     school?.logo_url    || null,
    initials:    (school?.school_name || 'S').charAt(0).toUpperCase(),
  };
}

export default function Layout() {
  const { school, logout } = useAuth();
  const navigate = useNavigate();

  const [collapsed,   setCollapsed]   = useState(false);
  const [mobileOpen,  setMobileOpen]  = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const session  = getSessionInfo(school);
  const role     = session.role;
  const meta     = ROLE_META[role] || ROLE_META.admin;
  const NAV      = NAV_BY_ROLE[role] || NAV_BY_ROLE.admin;
  const wide     = !collapsed || mobileOpen;

  const handleLogout = () => {
    localStorage.removeItem('staff_token');
    localStorage.removeItem('staff_data');
    localStorage.removeItem('staff_school');
    logout();
    toast.success('Signed out');
    navigate('/login');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setMobileOpen(false)}/>
      )}

      {/* ════════════════════════════════════════════════════
          SIDEBAR
      ════════════════════════════════════════════════════ */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-40 flex flex-col
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
        ${wide ? 'w-64' : 'w-[70px]'}
        bg-white border-r border-gray-200
        transition-all duration-300 ease-in-out shrink-0 shadow-sm
      `}>

        {/* ── Brand header ────────────────────────────── */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-gray-100 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-[#0a2156] flex items-center justify-center shadow-sm shrink-0">
            <GraduationCap className="w-5 h-5 text-white"/>
          </div>
          {wide && (
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 text-[15px] leading-tight truncate">SchoolMS</p>
              <p className="text-[11px] text-gray-400 truncate">{session.schoolName}</p>
            </div>
          )}
          <button onClick={() => { setCollapsed(!collapsed); setMobileOpen(false); }}
            className="hidden lg:flex w-7 h-7 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 items-center justify-center transition-all shrink-0">
            <ChevronRight className={`w-4 h-4 transition-transform duration-300 ${wide ? 'rotate-180' : ''}`}/>
          </button>
          <button onClick={() => setMobileOpen(false)}
            className="lg:hidden w-7 h-7 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 flex items-center justify-center">
            <X className="w-4 h-4"/>
          </button>
        </div>

        {/* ── User card ───────────────────────────────── */}
        {wide && (
          <div className="mx-3 mt-3 shrink-0">
            <div className={`rounded-2xl ${meta.bg} border border-white/50 p-3`}>
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${meta.color} flex items-center justify-center text-sm font-bold text-white shrink-0 shadow-sm`}>
                  {session.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-gray-900 truncate leading-tight">{session.displayName}</p>
                  <p className={`text-[11px] font-semibold ${meta.text} mt-0.5`}>{meta.label}</p>
                </div>
              </div>
              {session.schoolYear && (
                <div className="mt-2 pt-2 border-t border-white/30">
                  <p className="text-[11px] text-gray-500">
                    Academic Year: <span className="font-semibold text-gray-700">{session.schoolYear}</span>
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Collapsed: avatar only */}
        {!wide && (
          <div className="flex justify-center mt-4 shrink-0">
            <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${meta.color} flex items-center justify-center text-sm font-bold text-white shadow-sm`}>
              {session.initials}
            </div>
          </div>
        )}

        {/* ── Navigation ──────────────────────────────── */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {NAV.map((item, i) => {
            if (item.divider) {
              return wide
                ? <div key={i} className="mx-2 my-2 border-t border-gray-100"/>
                : <div key={i} className="my-2 border-t border-gray-100 mx-1"/>;
            }

            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to}
                end={item.to === '/sms/dashboard'}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) => `
                  group relative flex items-center gap-3
                  ${wide ? 'px-3 py-2.5' : 'px-0 py-2.5 justify-center'}
                  rounded-xl text-[13.5px] font-medium transition-all duration-150
                  ${isActive
                    ? 'bg-[#0a2156] text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}
                `}>
                <Icon className={`shrink-0 ${wide ? 'w-[18px] h-[18px]' : 'w-5 h-5'}`}/>
                {wide && <span className="truncate">{item.label}</span>}
                {/* Tooltip for collapsed */}
                {!wide && (
                  <div className="absolute left-full ml-3 px-3 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-xl
                    opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-xl
                    translate-x-1 group-hover:translate-x-0 transition-all duration-150">
                    {item.label}
                  </div>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* ── Footer: settings + logout ───────────────── */}
        <div className="border-t border-gray-100 p-2 shrink-0 space-y-0.5">
          {!session.isStaff && wide && (
            <>
              <NavLink to="/settings" onClick={() => setMobileOpen(false)}
                className={({isActive}) => `flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all
                  ${isActive ? 'bg-[#0a2156] text-white' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}>
                <Settings className="w-4 h-4 shrink-0"/> Settings
              </NavLink>
            </>
          )}
          <button onClick={handleLogout}
            className={`w-full flex items-center ${wide ? 'gap-3 px-3 py-2.5' : 'justify-center py-2.5'} rounded-xl text-[13px] font-medium text-red-500 hover:bg-red-50 transition-all`}
            title="Sign Out">
            <LogOut className="w-4 h-4 shrink-0"/>
            {wide && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* ════════════════════════════════════════════════════
          MAIN CONTENT
      ════════════════════════════════════════════════════ */}
      <main className="flex-1 overflow-hidden flex flex-col bg-gray-50 min-w-0">

        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm shrink-0">
          <button onClick={() => setMobileOpen(true)} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <Menu className="w-5 h-5 text-gray-700"/>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-[#0a2156] flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-white"/>
            </div>
            <span className="font-bold text-sm text-gray-900">SchoolMS</span>
          </div>
          <button onClick={handleLogout} className="p-2 rounded-xl hover:bg-red-50 text-red-400 transition-colors">
            <LogOut className="w-5 h-5"/>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
