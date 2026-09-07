import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types';
import { requestOtpApi, verifyOtpApi, redeemSsoCodeApi } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  requestOtp: (email: string) => Promise<any>;
  verifyOtp: (email: string, otp: string) => Promise<any>;
  loginWithSsoCode: (code: string) => Promise<any>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

const TOKEN_KEY = '@hse_auth_token';
const USER_KEY = '@hse_auth_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredSession();
  }, []);

  const loadStoredSession = async () => {
    try {
      const storedToken = await AsyncStorage.getItem(TOKEN_KEY);
      const storedUser = await AsyncStorage.getItem(USER_KEY);
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch (e) {
      console.error('Failed to load auth session:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const requestOtp = async (email: string) => {
    return await requestOtpApi(email);
  };

  const verifyOtp = async (email: string, otp: string) => {
    const data = await verifyOtpApi(email, otp);
    if (data.token && data.user) {
      setToken(data.token);
      setUser(data.user);
    }
    return data;
  };

  const loginWithSsoCode = async (code: string) => {
    const data = await redeemSsoCodeApi(code);
    if (data.token && data.user) {
      setToken(data.token);
      setUser(data.user);
    }
    return data;
  };

  const logout = async () => {
    await AsyncStorage.removeItem(TOKEN_KEY);
    await AsyncStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        requestOtp,
        verifyOtp,
        loginWithSsoCode,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
