import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { can } from '../utils/permissions';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user,    setUser]    = useState(null);
  const [token,   setToken]   = useState(null);
  const [loading, setLoading] = useState(true);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const storedToken = localStorage.getItem('erp_token');
      const storedUser  = localStorage.getItem('erp_user');
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch (e) {
      console.error('Error reading auth from localStorage:', e);
      localStorage.removeItem('erp_token');
      localStorage.removeItem('erp_user');
    } finally {
      setLoading(false);
    }
  }, []);


  const login = useCallback((tokenValue, userValue) => {
    localStorage.setItem('erp_token', tokenValue);
    localStorage.setItem('erp_user',  JSON.stringify(userValue));
    setToken(tokenValue);
    setUser(userValue);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('erp_token');
    localStorage.removeItem('erp_user');
    setToken(null);
    setUser(null);
  }, []);

  const isAdmin      = user?.role === 'Admin';
  const isManager    = user?.role === 'Manager' || isAdmin;
  const isEmployee   = user?.role === 'Employee';

  // Convenience: check permission for current user
  const userCan = useCallback((feature, action) => can(user?.role, feature, action), [user]);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, isAdmin, isManager, isEmployee, can: userCan }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
