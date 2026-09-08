// HSE Incident System - Mobile App Configuration
import SafeStorage from './utils/storage';

// Default Server URL:
// 1. Local LAN: http://10.15.101.245:3000/api
// 2. Cloud UAT: https://hsedev.saudimotorsport.com/api
export const DEFAULT_API_BASE = 'http://10.15.101.245:3000/api';
export const LOCAL_DEV_API_BASE = 'http://10.15.101.245:3000/api';
export const CLOUD_UAT_API_BASE = 'https://hsedev.saudimotorsport.com/api';

const API_SERVER_KEY = '@hse_api_server_url';

export const getApiBaseUrl = async (): Promise<string> => {
  try {
    const saved = await SafeStorage.getItem(API_SERVER_KEY);
    return saved || DEFAULT_API_BASE;
  } catch {
    return DEFAULT_API_BASE;
  }
};

export const setApiBaseUrl = async (url: string): Promise<void> => {
  await SafeStorage.setItem(API_SERVER_KEY, url);
};
