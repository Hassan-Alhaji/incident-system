import axios from 'axios';

const getBaseUrl = () => {
    let url = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
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
