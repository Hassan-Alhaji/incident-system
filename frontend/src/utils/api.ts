import axios from 'axios';

const getBaseUrl = () => {
    let url = import.meta.env.VITE_API_URL;

    if (!url) {
        if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            console.error('CRITICAL: VITE_API_URL is missing in production environment variables! Assuming backend is relative to origin.');
            // We shouldn't default to localhost if hosted online. 
            // Better to default to origin or a known placeholder so the error is obvious.
            url = '/api';
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

export default api;
