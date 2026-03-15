import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY_API_URL = 'avato_api_url';

const ENV_API_URL = process.env.EXPO_PUBLIC_API_URL?.trim();
const DEFAULT_API_URL =
  ENV_API_URL && /^https?:\/\//.test(ENV_API_URL) ? ENV_API_URL : 'http://localhost:3010';

export const normalizeApiUrl = (url: string) => {
  const trimmed = url.trim().replace(/\/+$/, '');

  if (!trimmed) return '';

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  return `http://${trimmed}`;
};

export async function getApiUrl(): Promise<string> {
  return (await AsyncStorage.getItem(STORAGE_KEY_API_URL)) || DEFAULT_API_URL;
}

export async function setApiUrl(url: string): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY_API_URL, normalizeApiUrl(url));
}

export async function hasConfiguredUrl(): Promise<boolean> {
  return !!(await AsyncStorage.getItem(STORAGE_KEY_API_URL));
}

export async function clearApiUrl(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY_API_URL);
}

export async function testConnection(baseUrl: string): Promise<boolean> {
  try {
    const normalizedBaseUrl = normalizeApiUrl(baseUrl);
    const response = await fetch(`${normalizedBaseUrl}/trpc/mobile/healthcheck`, {
      headers: { 'Content-Type': 'application/json' },
      method: 'GET',
    });

    return response.ok;
  } catch {
    return false;
  }
}
