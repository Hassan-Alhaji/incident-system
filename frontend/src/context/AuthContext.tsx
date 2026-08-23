import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import api from '../utils/api';

interface User {
 id: string;
 name: string;
 email: string;
 role: string;
 marshalId?: string;
 status?: string;
 isMedical?: boolean;
 mobile?: string;
 department?: string;
 repDepartmentId?: string;
 firstName?: string;
 lastName?: string;
 isProfileCompleted?: boolean;
 userGroup?: string;
 // Analytics & permission flags (set by backend, scoped by role)
 canViewAnalytics?: boolean;
 canEscalate?: boolean;
 canManageUsers?: boolean;
 canCloseTickets?: boolean;
 canPerformRCA?: boolean;
 canManageEvents?: boolean;
 canManageServiceProviders?: boolean;
}

interface AuthContextType {
 user: User | null;
 token: string | null;
 login: (token: string, userData: User) => void;
 logout: () => void;
 isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
 const [user, setUser] = useState<User | null>(null);
 const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
 const [isLoading, setIsLoading] = useState(true);

 useEffect(() => {
  if (token) {
    // Decode JWT payload to check expiry without a library dependency.
    // JWT structure: header.payload.signature — all base64-url encoded.
    try {
      const payloadBase64 = token.split('.')[1];
      if (payloadBase64) {
        const decoded = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
        const nowSec = Math.floor(Date.now() / 1000);
        if (decoded.exp && decoded.exp < nowSec) {
          // Token is expired — clear storage and treat as logged-out.
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setToken(null);
          setUser(null);
          setIsLoading(false);
          return;
        }
      }
    } catch {
      // Malformed token — clear it.
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setToken(null);
      setUser(null);
      setIsLoading(false);
      return;
    }

    // Token still valid — restore user from localStorage.
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('user');
      }
    }
  }
  setIsLoading(false);
 }, [token]);

 const login = (newToken: string, userData: User) => {
 localStorage.setItem('token', newToken);
 localStorage.setItem('user', JSON.stringify(userData));
 setToken(newToken);
 setUser(userData);
 };

 const logout = () => {
 localStorage.removeItem('token');
 localStorage.removeItem('user');
 setToken(null);
 setUser(null);
 };

 return (
 <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
 {children}
 </AuthContext.Provider>
 );
};

export const useAuth = () => {
 const context = useContext(AuthContext);
 if (context === undefined) {
 throw new Error('useAuth must be used within an AuthProvider');
 }
 return context;
};
