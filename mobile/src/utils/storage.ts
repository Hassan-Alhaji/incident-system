import AsyncStorage from '@react-native-async-storage/async-storage';

const memoryCache: Record<string, string> = {};

export const SafeStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      const val = await AsyncStorage.getItem(key);
      if (val !== null) return val;
      return memoryCache[key] || null;
    } catch (e) {
      return memoryCache[key] || null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    memoryCache[key] = value;
    try {
      await AsyncStorage.setItem(key, value);
    } catch (e) {
      // Ignored: cached in memory
    }
  },

  async removeItem(key: string): Promise<void> {
    delete memoryCache[key];
    try {
      await AsyncStorage.removeItem(key);
    } catch (e) {
      // Ignored: removed from memory
    }
  },
};

export default SafeStorage;
