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

export const normalizeRemoteServerUrl = (url: string) => {
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

export const formatRemoteServerUrlForInput = (url: string) =>
  normalizeRemoteServerUrl(url).replace(/^https?:\/\//, '');

export const validateRemoteServerUrl = (
  url: string,
  options: { invalidMessage: string; required?: boolean; requiredMessage?: string },
) => {
  const value = url.trim();
  if (!value)
    return options.required ? options.requiredMessage || options.invalidMessage : undefined;

  try {
    const parsedUrl = new URL(normalizeRemoteServerUrl(value));
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:'
      ? undefined
      : options.invalidMessage;
  } catch {
    return options.invalidMessage;
  }
};
