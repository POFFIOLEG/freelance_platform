import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { authApi } from "../api/client";

const AuthContext = createContext({
  user: null,
  token: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  logout: () => {},
  updateProfile: async () => {},
  refreshProfile: async () => {},
  switchRole: async () => {},
});

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem("auth_token"));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(token));

  useEffect(() => {
    const bootstrap = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const data = await authApi.me(token);
        setUser(data);
      } catch (error) {
        console.error(error);
        localStorage.removeItem("auth_token");
        setToken(null);
      } finally {
        setLoading(false);
      }
    };
    bootstrap();
  }, [token]);

  const persistToken = (value) => {
    if (value) {
      localStorage.setItem("auth_token", value);
    } else {
      localStorage.removeItem("auth_token");
    }
  };

  const login = async (credentials) => {
    const data = await authApi.login(credentials);
    setToken(data.token);
    persistToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const register = async (payload) => {
    const data = await authApi.register(payload);
    setToken(data.token);
    persistToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    setToken(null);
    persistToken(null);
    setUser(null);
  };

  const updateProfile = async (payload) => {
    if (!token) {
      throw new Error("Требуется авторизация");
    }
    const profile = await authApi.profile.update(payload, token);
    setUser((prev) =>
      prev
        ? {
            ...prev,
            first_name: profile.first_name ?? prev.first_name,
            last_name: profile.last_name ?? prev.last_name,
            profile: { ...prev.profile, ...profile },
          }
        : prev,
    );
    return profile;
  };

  const refreshProfile = async () => {
    if (!token) return null;
    const profile = await authApi.profile.get(token);
    setUser((prev) =>
      prev
        ? {
            ...prev,
            first_name: profile.first_name ?? prev.first_name,
            last_name: profile.last_name ?? prev.last_name,
            profile: { ...prev.profile, ...profile },
          }
        : prev,
    );
    return profile;
  };

  const switchRole = async (role) => {
    if (!token) {
      throw new Error("Требуется авторизация");
    }
    const response = await authApi.switchRole(role, token);
    setUser(response.user);
    return response.user;
  };

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      login,
      register,
      logout,
      updateProfile,
      refreshProfile,
      switchRole,
    }),
    [user, token, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);

