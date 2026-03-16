import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY_API_URL = 'avato_api_url';

const ENV_API_URL = process.env.EXPO_PUBLIC_API_URL?.trim();
const DEFAULT_API_URL =
  ENV_API_URL && /^https?:\/\//.test(ENV_API_URL) ? ENV_API_URL : 'http://localhost:3010';

const isPrivateOrLocalHost = (host: string) => {
  const normalizedHost = host.trim().toLowerCase();

  if (
    normalizedHost === 'localhost' ||
    normalizedHost === '127.0.0.1' ||
    normalizedHost === '0.0.0.0' ||
    normalizedHost.endsWith('.local')
  ) {
    return true;
  }

  const ipv4Match = normalizedHost.match(/^(\d{1,3})(?:\.(\d{1,3})){3}$/);

  if (!ipv4Match) return false;

  const octets = normalizedHost.split('.').map(Number);

  if (octets.some((value) => Number.isNaN(value) || value < 0 || value > 255)) return false;

  const [first, second] = octets;

  return (
    first === 10 ||
    first === 127 ||
    (first === 192 && second === 168) ||
    (first === 172 && second >= 16 && second <= 31)
  );
};

export const normalizeApiUrl = (url: string) => {
  const trimmed = url.trim().replace(/\/+$/, '');

  if (!trimmed) return '';

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const parsed = new URL(trimmed);

      if (parsed.protocol === 'http:' && !isPrivateOrLocalHost(parsed.hostname)) {
        parsed.protocol = 'https:';
      }

      return parsed.toString().replace(/\/+$/, '');
    } catch {
      return trimmed;
    }
  }

  const host = trimmed.split('/')[0].split(':')[0];
  const protocol = isPrivateOrLocalHost(host) ? 'http' : 'https';

  return `${protocol}://${trimmed}`;
};

export const formatApiUrlForInput = (url: string) =>
  normalizeApiUrl(url).replace(/^https?:\/\//, '');

export async function getApiUrl(): Promise<string> {
  return normalizeApiUrl((await AsyncStorage.getItem(STORAGE_KEY_API_URL)) || DEFAULT_API_URL);
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
