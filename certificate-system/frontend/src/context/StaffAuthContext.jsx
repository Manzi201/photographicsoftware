import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const StaffAuthContext = createContext(null);

export function StaffAuthProvider({ children }) {
  const [staff,   setStaff]   = useState(null);
  const [school,  setSchool]  = useState(null);
  const [role,    setRole]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token   = localStorage.getItem('staff_token');
    const sData   = localStorage.getItem('staff_data');
    const sSchool = localStorage.getItem('staff_school');
    if (token && sData) {
      const s = JSON.parse(sData);
      setStaff(s); setRole(s.role);
      if (sSchool) setSchool(JSON.parse(sSchool));
    }
    setLoading(false);
  }, []);

  const setStaffSession = useCallback((token, staffData, schoolData) => {
    localStorage.setItem('staff_token',  token);
    localStorage.setItem('staff_data',   JSON.stringify(staffData));
    localStorage.setItem('staff_school', JSON.stringify(schoolData));
    setStaff(staffData); setSchool(schoolData); setRole(staffData.role);
  }, []);

  const logoutStaff = useCallback(() => {
    ['staff_token','staff_data','staff_school'].forEach(k => localStorage.removeItem(k));
    setStaff(null); setSchool(null); setRole(null);
  }, []);

  return (
    <StaffAuthContext.Provider value={{ staff, school, role, loading, setStaffSession, logoutStaff }}>
      {children}
    </StaffAuthContext.Provider>
  );
}

export function useStaffAuth() { return useContext(StaffAuthContext); }
