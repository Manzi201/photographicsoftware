import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  GraduationCap, LayoutDashboard, Users, Folder, LogOut, Menu, X,
  BookOpen, FileText, CreditCard, Bell, TrendingUp, Layers, Calendar,
  Settings, UserCircle, Shield, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

/* ── Role metadata ─────────────────────────────────────────── */
const ROLE_META = {
  admin:     { label:'Administrator',       color:'#f43f5e', light:'#fff1f2', dark:'#be123c' },
  secretary: { label:'Secretary',           color:'#10b981', light:'#ecfdf5', dark:'#065f46' },
  teacher:   { label:'Teacher',             color:'#38bdf8', light:'#f0f9ff', dark:'#0369a1' },
  finance:   { label:'Finance / Accountant',color:'#f59e0b', light:'#fffbeb', dark:'#92400e' },
  dos:       { label:'Director of Studies', color:'#a78bfa', light:'#f5f3ff', dark:'#5b21b6' },
};

/* ── Nav per role ──────────────────────────────────────────── */
const NAV_BY_ROLE = {
  admin: [
    { to:'/sms/dashboard', icon:LayoutDashboard, label:'Dashboard'      },
    { divider:true, label:'MANAGEMENT' },
    { to:'/sms/admin',     icon:Shield,          label:'Staff Accounts' },
    { to:'/settings',      icon:Settings,        label:'School Settings'},
    { to:'/profile',       icon:UserCircle,      label:'School Profile' },
  ],
  secretary: [
    { to:'/sms/dashboard', icon:LayoutDashboard, label:'Dashboard'       },
    { divider:true, label:'TASKS' },
    { to:'/sms/students',  icon:Users,           label:'Students'        },
    { to:'/sms/bulletins', icon:FileText,        label:'Print Bulletins' },
    { to:'/sms/documents', icon:Folder,          label:'Documents'       },
  ],
  teacher: [
    { to:'/sms/dashboard', icon:LayoutDashboard, label:'Dashboard'      },
    { divider:true, label:'MY WORK' },
    { to:'/sms/marks',     icon:BookOpen,        label:'Enter Marks'    },
    { to:'/sms/bulletins', icon:FileText,        label:'View Bulletins' },
    { to:'/sms/timetable', icon:Calendar,        label:'My Timetable'   },
  ],
  finance: [
    { to:'/sms/dashboard',     icon:LayoutDashboard, label:'Dashboard'      },
    { divider:true, label:'FINANCE' },
    { to:'/sms/finance',       icon:CreditCard,      label:'Fees & Payments'},
    { to:'/sms/notifications', icon:Bell,            label:'Fee Reminders'  },
  ],
  dos: [
    { to:'/sms/dashboard', icon:LayoutDashboard, label:'Dashboard'       },
    { divider:true, label:'ACADEMICS' },
    { to:'/sms/classes',   icon:Layers,          label:'Classes & Years' },
    { to:'/sms/timetable', icon:Calendar,        label:'Timetable'       },
    { to:'/sms/marks',     icon:BookOpen,        label:'Student Marks'   },
    { to:'/sms/bulletins', icon:FileText,        label:'Bulletins'       },
    { to:'/sms/promotion', icon:TrendingUp,      label:'Promotion'       },
    { divider:true, label:'PEOPLE' },
    { to:'/sms/students',  icon:Users,           label:'Students'        },
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
        isStaff:    true,
        role:       staff.role || 'teacher',
        name:       staff.full_name || 'Staff',
        schoolName: sSchool.school_name || 'School',
        schoolYear: sSchool.active_year || '',
        logoUrl:    sSchool.logo_url    || null,
        initials:   (staff.full_name||'S').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2),
      };
    }
  } catch {}
  return {
    isStaff:    false,
    role:       'admin',
    name:       school?.school_name || 'Admin',
    schoolName: school?.school_name || 'My School',
    schoolYear: school?.active_year || '',
    logoUrl:    school?.logo_url    || null,
    initials:   (school?.school_name||'S').charAt(0).toUpperCase(),
  };
}

export default function Layout() {
  const { school, logout } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();

  const [collapsed,  setCollapsed]  = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile sidebar on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const session = getSessionInfo(school);
  const role    = session.role;
  const meta    = ROLE_META[role] || ROLE_META.admin;
  const NAV     = NAV_BY_ROLE[role] || NAV_BY_ROLE.admin;

  const handleLogout = () => {
    localStorage.removeItem('staff_token');
    localStorage.removeItem('staff_data');
    localStorage.removeItem('staff_school');
    logout();
    toast.success('Signed out');
    navigate('/login');
  };

  const wide = !collapsed;

  /* ── Sidebar inner content ─────────────────────────────── */
  const SidebarContent = () => (
    <div className="flex flex-col h-full">

      {/* ── Brand ──────────────────────────────────────── */}
      <div className={`flex items-center h-16 border-b border-white/[0.07] shrink-0 ${wide ? 'px-5 gap-3' : 'justify-center px-0'}`}>
        {/* Logo icon */}
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-lg"
          style={{ background: `linear-gradient(135deg, ${meta.color}dd, ${meta.dark})` }}>
          <GraduationCap className="w-5 h-5 text-white"/>
        </div>

        {wide && (
          <div className="flex-1 min-w-0">
            <p className="font-black text-white text-[15px] tracking-tight leading-none">SchoolMS</p>
            <p className="text-[11px] text-white/40 truncate mt-0.5">{session.schoolName}</p>
          </div>
        )}

        {/* Collapse toggle — desktop only */}
        <button
          onClick={() => setCollapsed(v => !v)}
          className="hidden lg:flex w-7 h-7 rounded-lg items-center justify-center text-white/30 hover:text-white hover:bg-white/10 transition-all shrink-0">
          {wide ? <ChevronLeft className="w-4 h-4"/> : <ChevronRight className="w-4 h-4"/>}
        </button>

        {/* Mobile close */}
        <button onClick={() => setMobileOpen(false)}
          className="lg:hidden w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all shrink-0">
          <X className="w-4 h-4"/>
        </button>
      </div>

      {/* ── User card ──────────────────────────────────── */}
      <div className={`shrink-0 ${wide ? 'px-4 pt-4' : 'flex justify-center pt-4'}`}>
        {wide ? (
          <div className="rounded-2xl p-3.5" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }}>
            <div className="flex items-center gap-3">
              {session.logoUrl ? (
                <img src={session.logoUrl} alt="logo"
                  className="w-11 h-11 rounded-xl object-contain p-0.5 shrink-0"
                  style={{ background:'rgba(255,255,255,0.1)' }}/>
              ) : (
                <div className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-base text-white shrink-0 shadow-lg select-none"
                  style={{ background:`linear-gradient(135deg, ${meta.color}ee, ${meta.dark})` }}>
                  {session.initials}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-[13.5px] truncate leading-tight">{session.name}</p>
                <p className="text-[11px] font-semibold mt-0.5 truncate" style={{ color: meta.color }}>{meta.label}</p>
              </div>
            </div>
            {session.schoolYear && (
              <div className="mt-3 pt-2.5 border-t border-white/[0.08] flex items-center justify-between">
                <span className="text-[11px] text-white/35 font-medium">Academic Year</span>
                <span className="text-[11px] font-black text-white/70 tracking-wide">{session.schoolYear}</span>
              </div>
            )}
          </div>
        ) : (
          /* Collapsed: just avatar */
          <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm text-white shadow-lg select-none"
            style={{ background:`linear-gradient(135deg, ${meta.color}ee, ${meta.dark})` }}>
            {session.initials}
          </div>
        )}
      </div>

      {/* ── Navigation ─────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5 scrollbar-none">
        {NAV.map((item, i) => {
          if (item.divider) {
            if (!wide) return <div key={i} className="my-2 mx-2 border-t border-white/[0.07]"/>;
            return (
              <div key={i} className="px-3 pt-4 pb-1">
                <p className="text-[10px] font-black tracking-[0.12em] text-white/25">{item.label}</p>
              </div>
            );
          }

          const Icon = item.icon;
          return (
            <NavLink key={item.to} to={item.to} end={item.to === '/sms/dashboard'}>
              {({ isActive }) => (
                <div className={`
                  group relative flex items-center rounded-xl transition-all duration-200 select-none cursor-pointer
                  ${wide ? 'gap-3 px-3 py-2.5' : 'justify-center px-0 py-2.5'}
                  ${isActive ? 'text-white' : 'text-white/45 hover:text-white hover:bg-white/[0.07]'}
                `}
                style={isActive ? {
                  background: `linear-gradient(135deg, ${meta.color}35 0%, ${meta.color}1a 100%)`,
                  boxShadow: `inset 0 0 0 1px ${meta.color}40, 0 2px 8px ${meta.color}18`,
                } : {}}>
                  {/* Active left accent bar */}
                  <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full transition-all duration-300
                    ${isActive ? 'h-6 opacity-100' : 'h-0 opacity-0'}`}
                    style={{ background: meta.color }}/>
                  {/* Icon */}
                  <Icon className={`shrink-0 transition-colors ${wide ? 'w-[17px] h-[17px]' : 'w-5 h-5'}`}
                    style={isActive ? { color: meta.color } : {}}/>
                  {wide && (
                    <span className={`text-[13.5px] truncate leading-none transition-all
                      ${isActive ? 'font-bold' : 'font-medium'}`}>
                      {item.label}
                    </span>
                  )}
                  {/* Collapsed tooltip */}
                  {!wide && (
                    <div className="absolute left-full ml-3 px-3 py-2 bg-gray-900 text-white text-xs font-bold rounded-xl
                      opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-[999] shadow-xl
                      translate-x-1 group-hover:translate-x-0 transition-all duration-150 border border-white/10">
                      {item.label}
                    </div>
                  )}
                </div>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* ── Footer ─────────────────────────────────────── */}
      <div className={`shrink-0 border-t border-white/[0.07] p-2 space-y-0.5`}>
        {!session.isStaff && wide && (
          <NavLink to="/settings"
            className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all
              ${isActive ? 'text-white bg-white/10' : 'text-white/40 hover:text-white/80 hover:bg-white/[0.06]'}`}>
            <Settings className="w-4 h-4 shrink-0"/> Settings
          </NavLink>
        )}
        <button onClick={handleLogout}
          className={`w-full flex items-center rounded-xl transition-all duration-150 text-[13px] font-semibold
            text-red-400/70 hover:text-red-300 hover:bg-red-500/10
            ${wide ? 'gap-3 px-3 py-2.5' : 'justify-center py-2.5'}`}>
          <LogOut className="w-4 h-4 shrink-0"/>
          {wide && 'Sign Out'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setMobileOpen(false)}/>
      )}

      {/* ════════════════════════════════════════════
          SIDEBAR
      ════════════════════════════════════════════ */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-40 shrink-0 flex flex-col
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
          ${wide ? 'w-64' : 'w-[68px]'}
          transition-all duration-300 ease-in-out overflow-hidden
        `}
        style={{ background: 'linear-gradient(175deg, #0d1b3e 0%, #111e42 35%, #0f1c40 65%, #0a1833 100%)' }}>

        {/* Subtle background texture */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Top glow */}
          <div className="absolute -top-24 -left-16 w-64 h-64 rounded-full opacity-20"
            style={{ background: `radial-gradient(circle, ${meta.color} 0%, transparent 70%)` }}/>
          {/* Bottom glow */}
          <div className="absolute -bottom-20 -right-10 w-56 h-56 rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)' }}/>
          {/* Grid dots */}
          <div className="absolute inset-0 opacity-[0.025]"
            style={{ backgroundImage:'radial-gradient(rgba(255,255,255,0.8) 1px, transparent 1px)', backgroundSize:'24px 24px' }}/>
          {/* Right edge shimmer */}
          <div className="absolute top-0 right-0 w-px h-full opacity-20"
            style={{ background: `linear-gradient(to bottom, transparent 0%, ${meta.color}60 30%, rgba(255,255,255,0.15) 50%, ${meta.color}40 70%, transparent 100%)` }}/>
        </div>

        <div className="relative z-10 flex flex-col h-full">
          <SidebarContent/>
        </div>
      </aside>

      {/* ════════════════════════════════════════════
          MAIN CONTENT
      ════════════════════════════════════════════ */}
      <main className="flex-1 overflow-hidden flex flex-col bg-gray-50 min-w-0">

        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm shrink-0">
          <button onClick={() => setMobileOpen(true)} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <Menu className="w-5 h-5 text-gray-700"/>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl flex items-center justify-center shadow-sm"
              style={{ background:`linear-gradient(135deg, ${meta.color}dd, ${meta.dark})` }}>
              <GraduationCap className="w-4 h-4 text-white"/>
            </div>
            <span className="font-black text-sm text-gray-900 tracking-tight">SchoolMS</span>
          </div>
          <button onClick={handleLogout} className="p-2 rounded-xl hover:bg-red-50 text-red-400 transition-colors">
            <LogOut className="w-5 h-5"/>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <Outlet/>
        </div>
      </main>
    </div>
  );
}
