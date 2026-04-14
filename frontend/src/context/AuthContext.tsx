import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import api from '../services/api';
import { Team } from '../types';

type AuthContextValue = {
  user: Team | null;
  loading: boolean;
  login: (name: string, password: string) => Promise<Team>;
  register: (name: string, password: string) => Promise<Team>;
  logout: () => void;
  updateUser: (updates: Partial<Team>) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [user, setUser] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedTeam = localStorage.getItem('team');

    if (token && storedTeam) {
      setUser(JSON.parse(storedTeam) as Team);
    }
    setLoading(false);
  }, []);

  const login = async (name: string, password: string): Promise<Team> => {
    const response = await api.post('/auth/login', { name, password });
    const { token, team } = response.data as { token: string; team: Team };

    localStorage.setItem('token', token);
    localStorage.setItem('team', JSON.stringify(team));
    setUser(team);

    return team;
  };

  const register = async (name: string, password: string): Promise<Team> => {
    const response = await api.post('/auth/register', { name, password });
    const { token, team } = response.data as { token: string; team: Team };

    localStorage.setItem('token', token);
    localStorage.setItem('team', JSON.stringify(team));
    setUser(team);

    return team;
  };

  const logout = (): void => {
    localStorage.removeItem('token');
    localStorage.removeItem('team');
    setUser(null);
  };

  const updateUser = (updates: Partial<Team>): void => {
    if (!user) {
      return;
    }
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

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
