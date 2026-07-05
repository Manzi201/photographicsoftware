/**
 * AuthHero — Custom left panel for Login / Register / StaffLogin
 * Own unique design — not CAMIS
 */
import React from 'react';
import { GraduationCap, Users, Award, FileText, TrendingUp, CheckCircle } from 'lucide-react';

const FEATURES = [
  { icon: Users,        text: 'Register & manage all students',        color: 'bg-blue-400/20 text-blue-200' },
  { icon: FileText,     text: 'Generate professional report cards',    color: 'bg-emerald-400/20 text-emerald-200' },
  { icon: Award,        text: 'Print student certificates instantly',  color: 'bg-amber-400/20 text-amber-200' },
  { icon: TrendingUp,   text: 'Track marks, grades & promotions',     color: 'bg-purple-400/20 text-purple-200' },
];

export default function AuthHero() {
  return (
    <div className="hidden lg:flex lg:w-[48%] relative overflow-hidden flex-col"
      style={{ background: 'linear-gradient(160deg, #0f1f3d 0%, #162952 40%, #1a3570 100%)' }}>

      {/* Decorative background shapes */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Large circle top-right */}
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)' }}/>
        {/* Medium circle bottom-left */}
        <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)' }}/>
        {/* Grid dots pattern */}
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)', backgroundSize: '32px 32px' }}/>
        {/* Diagonal accent line */}
        <div className="absolute top-0 right-24 w-px h-full opacity-10"
          style={{ background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.5), transparent)' }}/>
        <div className="absolute top-0 right-48 w-px h-full opacity-5"
          style={{ background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.3), transparent)' }}/>
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col h-full p-12">

        {/* Brand */}
        <div className="flex items-center gap-3 mb-auto">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/40">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-lg leading-none">SchoolMS</p>
            <p className="text-blue-300 text-xs">School Management System</p>
          </div>
        </div>

        {/* Main content — center */}
        <div className="flex-1 flex flex-col justify-center py-12">

          {/* Headline */}
          <div className="mb-10">
            <h1 className="text-4xl font-extrabold text-white leading-tight mb-4">
              Your complete<br/>
              <span className="text-transparent bg-clip-text"
                style={{ backgroundImage: 'linear-gradient(135deg, #60a5fa, #a78bfa)' }}>
                school system
              </span>
            </h1>
            <p className="text-blue-200 text-base leading-relaxed max-w-xs">
              Everything your school needs — from student registration to report cards, fees, and certificates.
            </p>
          </div>

          {/* Feature list */}
          <div className="space-y-3">
            {FEATURES.map(({ icon: Icon, text, color }) => (
              <div key={text} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-blue-100 text-sm">{text}</span>
              </div>
            ))}
          </div>

          {/* Stats strip */}
          <div className="mt-10 grid grid-cols-3 gap-4">
            {[['Students','Unlimited'],['Roles','5 staff roles'],['Reports','Auto-generated']].map(([label, val]) => (
              <div key={label} className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                <p className="text-white font-bold text-sm leading-tight">{val}</p>
                <p className="text-blue-300 text-xs mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom trust line */}
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
          <p className="text-blue-300 text-xs">Each school's data is completely private and secure</p>
        </div>
      </div>
    </div>
  );
}
