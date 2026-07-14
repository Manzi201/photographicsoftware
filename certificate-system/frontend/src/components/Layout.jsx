import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Home, Shield, Users, Folder, Menu, X, LogOut,
  BookOpen, UserCircle, Settings, FileText, CreditCard, Bell,
  TrendingUp, Layers, Calendar, GraduationCap, ChevronRight,
  LayoutDashboard
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

// ── Role config ───────────────────────────────────────────────
const ROLE_META = {
  admin:     { label: 'Administrator',       accent: '#f43f5e', gFrom: '#f43f5e', gTo: '#e11d48'  },
  secretary: { label: 'Secretary',           accent: '#10b981', gFrom: '#10b981', gTo: '#059669'  },
  teacher:   { label: 'Teacher',             accent: '#38bdf8', gFrom: '#38bdf8', gTo: '#0284c7'  },
  finance:   { label: 'Finance',             accent: '#f59e0b', gFrom: '#f59e0b', gTo: '#d97706'  },
  dos:       { label: 'Director of Studies', accent: '#a78bfa', gFrom: '#a78bfa', gTo: '#7c3aed'  },
};

// ── Nav per role ──────────────────────────────────────────────
const NAV_BY_ROLE = {
  admin: [
    { to: '/sms/dashboard', icon: LayoutDashboard, label: 'Dashboard'       },
    { divider: true },
    { to: '/sms/admin',     icon: Shield,     label: 'Staff Management' },
    { to: '/settings',      icon: Settings,   label: 'School Settings'  },
    { to: '/profile',       icon: UserCircle, label: 'School Profile'   },
  ],
  secretary: [
    { to: '/sms/dashboard', icon: LayoutDashboard, label: 'Dashboard'      },
    { divider: true },
    { to: '/sms/students',  icon: Users,    label: 'Students'         },
    { to: '/sms/bulletins', icon: FileText, label: 'Print Bulletins'  },
    { to: '/sms/documents', icon: Folder,   label: 'School Documents' },
  ],
  teacher: [
    { to: '/sms/dashboard', icon: LayoutDashboard, label: 'Dashboard'   },
    { divider: true },
    { to: '/sms/marks',     icon: BookOpen, label: 'Enter Marks'   },
    { to: '/sms/bulletins', icon: FileText, label: 'View Bulletins' },
    { to: '/sms/timetable', icon: Calendar, label: 'My Timetable'  },
  ],
  finance: [
    { to: '/sms/dashboard',     icon: LayoutDashboard, label: 'Dashboard'      },
    { divider: true },
    { to: '/sms/finance',       icon: CreditCard, label: 'Fees & Payments' },
    { to: '/sms/notifications', icon: Bell,       label: 'Fee Reminders'   },
  ],
  dos: [
    { to: '/sms/dashboard', icon: LayoutDashboard, label: 'Dashboard'         },
    { divider: true },
    { to: '/sms/classes',   icon: Layers,     label: 'Classes & Years'  },
    { to: '/sms/timetable', icon: Calendar,   label: 'Timetable'        },
    { to: '/sms/marks',     icon: BookOpen,   label: 'Student Marks'    },
    { to: '/sms/bulletins', icon: FileText,   label: 'Bulletins'        },
    { to: '/sms/promotion', icon: TrendingUp, label: 'Promotion'        },
    { to: '/sms/students',  icon: Users,      label: 'Students'         },
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

  const [collapsed,  setCollapsed]  = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const session = getSessionInfo(school);
  const role    = session.role;
  const meta    = ROLE_META[role] || ROLE_META.admin;
  const NAV     = NAV_BY_ROLE[role] || NAV_BY_ROLE.admin;
  const wide    = !collapsed || mobileOpen;

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
          SIDEBAR  — navy + decorative bg matching login
      ════════════════════════════════════════════════════ */}
      <aside
        style={{ background: 'linear-gradient(160deg, #0f1f3d 0%, #162952 40%, #1a3570 100%)' }}
        className={`
          fixed lg:static inset-y-0 left-0 z-40 flex flex-col
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
          ${wide ? 'w-64' : 'w-[72px]'}
          transition-all duration-300 ease-in-out shrink-0
          overflow-hidden relative
        `}>

        {/* ── Decorative background (matches Login AuthHero) ── */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Large glow top-right */}
          <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full"
            style={{ background: `radial-gradient(circle, ${meta.accent}22 0%, transparent 70%)` }}/>
          {/* Medium glow bottom-left */}
          <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)' }}/>
          {/* Subtle glow mid matching role color */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full"
            style={{ background: `radial-gradient(circle, ${meta.accent}0d 0%, transparent 70%)` }}/>
          {/* Dot grid */}
          <div className="absolute inset-0 opacity-[0.04]"
            style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)', backgroundSize: '28px 28px' }}/>
          {/* Vertical accent lines */}
          <div className="absolute top-0 right-16 w-px h-full opacity-[0.07]"
            style={{ background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.5), transparent)' }}/>
          <div className="absolute top-0 right-32 w-px h-full opacity-[0.04]"
            style={{ background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.3), transparent)' }}/>
        </div>

        {/* ── Brand header ──────────────────────────────── */}
        <div className="relative z-10 flex items-center gap-3 px-4 h-16 border-b border-white/[0.08] shrink-0">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg shrink-0"
            style={{ background: `linear-gradient(135deg, ${meta.gFrom}, ${meta.gTo})` }}>
            <GraduationCap className="w-5 h-5 text-white"/>
          </div>
          {wide && (
            <>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-[15px] leading-tight tracking-tight">SchoolMS</p>
                <p className="text-[11px] text-blue-300/70 truncate">{session.schoolName}</p>
              </div>
              <button onClick={() => setCollapsed(true)}
                className="hidden lg:flex w-7 h-7 rounded-lg text-white/40 hover:text-white hover:bg-white/10 items-center justify-center transition-all shrink-0">
                <ChevronRight className="w-4 h-4 rotate-180"/>
              </button>
            </>
          )}
          {!wide && (
            <button onClick={() => setCollapsed(false)}
              className="hidden lg:flex w-7 h-7 rounded-lg text-white/40 hover:text-white hover:bg-white/10 items-center justify-center transition-all">
              <ChevronRight className="w-4 h-4"/>
            </button>
          )}
          <button onClick={() => setMobileOpen(false)}
            className="lg:hidden w-7 h-7 rounded-lg text-white/40 hover:text-white hover:bg-white/10 flex items-center justify-center">
            <X className="w-4 h-4"/>
          </button>
        </div>

        {/* ── User / School card ────────────────────────── */}
        <div className={`relative z-10 shrink-0 ${wide ? 'mx-3 mt-3' : 'flex justify-center mt-4'}`}>
          {wide ? (
            <div className="rounded-2xl border border-white/10 p-3"
              style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-2.5">
                {session.logoUrl
                  ? <img src={session.logoUrl} className="w-10 h-10 rounded-xl object-contain bg-white/10 p-0.5 shrink-0" alt="logo"/>
                  : <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0 shadow-lg"
                      style={{ background: `linear-gradient(135deg, ${meta.gFrom}, ${meta.gTo})` }}>
                      {session.initials}
                    </div>}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-white truncate leading-tight">{session.displayName}</p>
                  <p className="text-[11px] font-semibold mt-0.5" style={{ color: meta.accent }}>{meta.label}</p>
                </div>
              </div>
              {session.schoolYear && (
                <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between">
                  <span className="text-[11px] text-blue-300/60">Academic Year</span>
                  <span className="text-[11px] font-bold text-white/80">{session.schoolYear}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white shadow-lg"
              style={{ background: `linear-gradient(135deg, ${meta.gFrom}, ${meta.gTo})` }}>
              {session.initials}
            </div>
          )}
        </div>

        {/* ── Navigation ────────────────────────────────── */}
        <nav className="relative z-10 flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {NAV.map((item, i) => {
            if (item.divider) return (
              <div key={i} className={`${wide ? 'mx-2' : 'mx-1'} my-2 border-t border-white/[0.08]`}/>
            );

            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to}
                end={item.to === '/sms/dashboard'}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) => `
                  group relative flex items-center
                  ${wide ? 'gap-3 px-3 py-2.5' : 'justify-center px-0 py-2.5'}
                  rounded-xl text-[13.5px] font-medium
                  transition-all duration-200
                  ${isActive
                    ? 'text-white shadow-lg'
                    : 'text-blue-200/70 hover:text-white hover:bg-white/[0.07]'}
                `}
                style={({ isActive }) => isActive ? {
                  background: `linear-gradient(135deg, ${meta.gFrom}cc, ${meta.gTo}cc)`,
                  boxShadow: `0 4px 15px ${meta.accent}33`,
                } : {}}>
                <Icon className={`shrink-0 ${wide ? 'w-[17px] h-[17px]' : 'w-5 h-5'}`}/>
                {wide && <span className="truncate">{item.label}</span>}
                {/* Collapsed tooltip */}
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

        {/* ── Footer ────────────────────────────────────── */}
        <div className="relative z-10 border-t border-white/[0.08] p-2 shrink-0 space-y-0.5">
          {!session.isStaff && wide && (
            <NavLink to="/settings" onClick={() => setMobileOpen(false)}
              className={({isActive}) => `flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150
                ${isActive ? 'text-white' : 'text-blue-200/60 hover:text-white hover:bg-white/[0.07]'}`}>
              <Settings className="w-4 h-4 shrink-0"/> Settings
            </NavLink>
          )}
          <button onClick={handleLogout}
            className={`w-full flex items-center ${wide ? 'gap-3 px-3 py-2.5' : 'justify-center py-2.5'}
              rounded-xl text-[13px] font-medium text-red-400/80 hover:text-red-300 hover:bg-red-500/10 transition-all duration-150`}
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
            <div className="w-7 h-7 rounded-xl flex items-center justify-center shadow-sm"
              style={{ background: `linear-gradient(135deg, ${meta?.gFrom || '#0a2156'}, ${meta?.gTo || '#1e3a8a'})` }}>
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
