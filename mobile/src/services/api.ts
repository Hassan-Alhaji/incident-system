import axios, { AxiosInstance } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiBaseUrl } from '../config';

const TOKEN_KEY = '@hse_auth_token';
const USER_KEY = '@hse_auth_user';

let apiInstance: AxiosInstance | null = null;

export const getApiClient = async (): Promise<AxiosInstance> => {
  const baseURL = await getApiBaseUrl();
  if (!apiInstance || apiInstance.defaults.baseURL !== baseURL) {
    apiInstance = axios.create({
      baseURL,
      timeout: 25000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    apiInstance.interceptors.request.use(async (config) => {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    apiInstance.interceptors.response.use(
      (res) => res,
      async (err) => {
        if (err.response?.status === 401) {
          // Token expired, clear storage
          await AsyncStorage.removeItem(TOKEN_KEY);
          await AsyncStorage.removeItem(USER_KEY);
        }
        return Promise.reject(err);
      }
    );
  }
  return apiInstance;
};

// Authentication APIs
export const requestOtpApi = async (email: string) => {
  const client = await getApiClient();
  return client.post('/auth/otp/request', { email });
};

export const verifyOtpApi = async (email: string, otp: string) => {
  const client = await getApiClient();
  const res = await client.post('/auth/otp/verify', { email, otp });
  if (res.data.token) {
    await AsyncStorage.setItem(TOKEN_KEY, res.data.token);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(res.data.user));
  }
  return res.data;
};

export const redeemSsoCodeApi = async (code: string) => {
  const client = await getApiClient();
  const res = await client.get(`/auth/sso-exchange?code=${encodeURIComponent(code)}`);
  if (res.data.token) {
    await AsyncStorage.setItem(TOKEN_KEY, res.data.token);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(res.data.user));
  }
  return res.data;
};

// Ticket APIs for Reporter
export const fetchReporterTicketsApi = async (page = 1, limit = 50) => {
  const client = await getApiClient();
  const res = await client.get('/tickets', { params: { page, limit } });
  return res.data;
};

export const fetchTicketDetailApi = async (id: string) => {
  const client = await getApiClient();
  const res = await client.get(`/tickets/${id}`);
  return res.data;
};

export const createTicketApi = async (ticketData: any) => {
  const client = await getApiClient();
  const res = await client.post('/tickets', ticketData);
  return res.data;
};

export const uploadTicketAttachmentApi = async (ticketId: string, imageUri: string, filename: string) => {
  const client = await getApiClient();
  const formData = new FormData();
  
  // React Native FormData format for file upload
  const fileToUpload: any = {
    uri: imageUri,
    type: 'image/jpeg',
    name: filename || `incident_${Date.now()}.jpg`,
  };
  
  formData.append('files', fileToUpload);

  const res = await client.post(`/tickets/${ticketId}/attachments`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return res.data;
};

export const replyToTicketApi = async (ticketId: string, replyText: string) => {
  const client = await getApiClient();
  const res = await client.put(`/tickets/${ticketId}/reporter-reply`, {
    reply: replyText,
  });
  return res.data;
};

export const fetchZonesApi = async () => {
  const client = await getApiClient();
  const res = await client.get('/zones');
  return res.data;
};

export const fetchEventsApi = async () => {
  const client = await getApiClient();
  const res = await client.get('/events');
  return res.data;
};
