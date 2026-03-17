import { semanticColors } from './colors';

export const TAG_COLOR_OPTIONS = [
  '#64748b',
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#84cc16',
  '#22c55e',
  '#14b8a6',
  '#06b6d4',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
] as const;

export const resolveTagColor = (color?: string | null) => color || semanticColors.primary;

export const withAlpha = (color?: string | null, alpha = '1A') => {
  const resolved = resolveTagColor(color);

  if (resolved.startsWith('#') && resolved.length === 7) {
    return `${resolved}${alpha}`;
  }

  return resolved;
};
