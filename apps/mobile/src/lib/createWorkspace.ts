import type { TranslationKeys } from './i18n';

export type MobileCreateMode = 'artwork' | 'video';

interface CreateScreenCopy {
  subtitle: string;
  title: string;
}

export function getCreateScreenCopy(
  mode: MobileCreateMode,
  t: TranslationKeys,
): CreateScreenCopy {
  if (mode === 'video') {
    return {
      subtitle: t.videoHistoryEmptyDesc,
      title: t.videoTitle,
    };
  }

  return {
    subtitle: t.artworkEmptyDesc,
    title: t.artworkTitle,
  };
}

export function getCreateConfigContextLabel(
  mode: MobileCreateMode,
  t: TranslationKeys,
): string {
  return mode === 'video' ? t.videoTitle : t.artworkTitle;
}

export function summarizeCreateConfig(
  parts: Array<string | null | undefined>,
  fallback?: string,
): string | undefined {
  const summary = parts.filter(Boolean).join(' · ');
  return summary || fallback;
}
