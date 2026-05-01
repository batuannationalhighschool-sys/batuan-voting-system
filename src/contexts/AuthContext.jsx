import { createContext, useContext, useEffect, useState } from "react";
import api from "@/api/client";

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profile, setProfile] = useState(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  const fetchMe = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        setLoading(false);
        return;
      }
      const data = await api.get('/auth/me');
      setUser(data.user);
      setProfile(data.profile);
      setIsAdmin(data.isAdmin);
      setMustChangePassword(!!data.must_change_password);
      return data;
    } catch (err) {
      // Token invalid or expired
      localStorage.removeItem('auth_token');
      setUser(null);
      setProfile(null);
      setIsAdmin(false);
      setMustChangePassword(false);
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (localStorage.getItem('auth_token')) {
      await fetchMe();
    }
  };

  useEffect(() => {
    fetchMe();
  }, []);

  const signIn = async (lrn, password) => {
    try {
      const data = await api.post('/auth/login', { lrn, password });
      localStorage.setItem('auth_token', data.token);
      setUser(data.user);
      setMustChangePassword(!!data.must_change_password);
      const meData = await fetchMe();
      return { error: null, must_change_password: !!data.must_change_password, isAdmin: !!meData?.isAdmin };
    } catch (err) {
      return { error: { message: err.message } };
    }
  };

  const changePassword = async (newPassword) => {
    try {
      const data = await api.post('/auth/change-password', { new_password: newPassword });
      if (data.token) {
        localStorage.setItem('auth_token', data.token);
      }
      setMustChangePassword(false);
      await fetchMe();
      return { error: null };
    } catch (err) {
      return { error: { message: err.message } };
    }
  };

  const signOut = async () => {
    localStorage.removeItem('auth_token');
    setUser(null);
    setProfile(null);
    setIsAdmin(false);
    setMustChangePassword(false);
  };

  return (
    <AuthContext.Provider value={{ user, session: null, loading, isAdmin, profile, mustChangePassword, signIn, signOut, changePassword, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
