const SOLID_TEXT_DARK = '#141414';
const SOLID_TEXT_LIGHT = '#ffffff';

const parseHexColor = (input: string) => {
  const normalized = input.replace('#', '').trim();
  if (![3, 4, 6, 8].includes(normalized.length)) return;

  const hex =
    normalized.length <= 4
      ? normalized
          .slice(0, normalized.length === 4 ? 3 : normalized.length)
          .split('')
          .map((segment) => `${segment}${segment}`)
          .join('')
      : normalized.slice(0, 6);

  const parsed = Number.parseInt(hex, 16);
  if (Number.isNaN(parsed)) return;

  return {
    b: parsed & 0xff,
    g: (parsed >> 8) & 0xff,
    r: (parsed >> 16) & 0xff,
  };
};

const parseRgbColor = (input: string) => {
  const match = input.match(/rgba?\(([^)]+)\)/i);
  if (!match) return;

  const segments = match[1]
    .split(',')
    .slice(0, 3)
    .map((segment) => Number.parseFloat(segment.trim()));

  if (segments.length !== 3 || segments.some((segment) => Number.isNaN(segment))) return;

  return {
    b: segments[2],
    g: segments[1],
    r: segments[0],
  };
};

const parseColor = (input: string) => {
  if (input.startsWith('#')) return parseHexColor(input);
  if (input.startsWith('rgb')) return parseRgbColor(input);
  return;
};

const toLuminanceChannel = (channel: number) => {
  const normalized = channel / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
};

const getRelativeLuminance = (input: string) => {
  const parsed = parseColor(input);
  if (!parsed) return 0;

  const r = toLuminanceChannel(parsed.r);
  const g = toLuminanceChannel(parsed.g);
  const b = toLuminanceChannel(parsed.b);

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const getContrastRatio = (foreground: string, background: string) => {
  const foregroundLuminance = getRelativeLuminance(foreground);
  const backgroundLuminance = getRelativeLuminance(background);
  const [lighter, darker] =
    foregroundLuminance > backgroundLuminance
      ? [foregroundLuminance, backgroundLuminance]
      : [backgroundLuminance, foregroundLuminance];

  return (lighter + 0.05) / (darker + 0.05);
};

export const getContrastingTextColor = (
  background: string,
  lightTextColor = SOLID_TEXT_LIGHT,
  darkTextColor = SOLID_TEXT_DARK,
) =>
  getContrastRatio(lightTextColor, background) >= getContrastRatio(darkTextColor, background)
    ? lightTextColor
    : darkTextColor;
