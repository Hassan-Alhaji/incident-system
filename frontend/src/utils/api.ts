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
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
