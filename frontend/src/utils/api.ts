import axios from 'axios';

const getBaseUrl = () => {
 let url = import.meta.env.VITE_API_URL;

 if (!url) {
 if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
 // Support testing from mobile phone on the same local wifi network
 if (window.location.hostname.match(/^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/)) {
 url = `${window.location.protocol}//${window.location.hostname}:3000/api`;
 } else {
 url = '/api';
 }
 } else {
 url = 'http://localhost:3000/api';
 }
 }

 if (!url.endsWith('/api')) {
 url += '/api';
 }
 console.log('API Base URL:', url); // Debugging 404
 return url;
};

const api = axios.create({
 baseURL: getBaseUrl(),
});

// Add a request interceptor to add the token
api.interceptors.request.use(
 (config) => {
 const token = localStorage.getItem('token');
 if (token) {
 config.headers.Authorization = `Bearer ${token}`;
 }
 return config;
 },
 (error) => {
 return Promise.reject(error);
 }
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only force logout on genuine 401 authentication failures
    // Skip if: no response (network error/timeout), already on login page, or login request itself
    if (error.response?.status === 401) {
      const isLoginRequest = error.config?.url?.includes('/auth/login');
      const isOnLoginPage = window.location.pathname === '/login';
      
      // Don't auto-logout for login attempts or if already on login page
      if (!isLoginRequest && !isOnLoginPage) {
        // Check if this is a real auth failure vs a transient server error
        const errorMessage = error.response?.data?.message || '';
        const isRealAuthError = errorMessage.toLowerCase().includes('token') 
          || errorMessage.toLowerCase().includes('unauthorized')
          || errorMessage.toLowerCase().includes('expired')
          || errorMessage.toLowerCase().includes('invalid')
          || errorMessage.toLowerCase().includes('jwt');
        
        if (isRealAuthError || error.response?.data?.error === 'Unauthorized') {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);


export default api;
