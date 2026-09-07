// HSE Incident System - Mobile App Configuration
import AsyncStorage from '@react-native-async-storage/async-storage';

// Default Server URL:
// 1. Cloud UAT: https://hsedev.saudimotorsport.com
// 2. Local LAN (when phone and PC are on same WiFi): http://192.168.1.60:3000
export const DEFAULT_API_BASE = 'https://hsedev.saudimotorsport.com/api';
export const LOCAL_DEV_API_BASE = 'http://192.168.1.60:3000/api';

const API_SERVER_KEY = '@hse_api_server_url';

export const getApiBaseUrl = async (): Promise<string> => {
  try {
    const saved = await AsyncStorage.getItem(API_SERVER_KEY);
    return saved || DEFAULT_API_BASE;
  } catch {
    return DEFAULT_API_BASE;
  }
};

export const setApiBaseUrl = async (url: string): Promise<void> => {
  await AsyncStorage.setItem(API_SERVER_KEY, url);
};
