import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedTeam = localStorage.getItem('team');
    
    if (token && storedTeam) {
      setUser(JSON.parse(storedTeam));
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    const { token, team } = response.data;
    
    localStorage.setItem('token', token);
    localStorage.setItem('team', JSON.stringify(team));
    setUser(team);
    
    return team;
  };

  const register = async (name, email, password) => {
    const response = await api.post('/auth/register', { name, email, password });
    const { token, team } = response.data;
    
    localStorage.setItem('token', token);
    localStorage.setItem('team', JSON.stringify(team));
    setUser(team);
    
    return team;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('team');
    setUser(null);
  };

  const updateUser = (updates) => {
    const updatedUser = { ...user, ...updates };
    setUser(updatedUser);
    localStorage.setItem('team', JSON.stringify(updatedUser));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
