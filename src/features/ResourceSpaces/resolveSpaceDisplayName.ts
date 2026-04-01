'use client';

import { type TFunction } from 'i18next';

interface ResolvableSpace {
  kind?: 'personal' | 'team' | string | null;
  name?: string | null;
}

interface ResolveSpaceDisplayNameOptions {
  fullName?: string | null;
  username?: string | null;
}

const normalize = (value?: string | null) => value?.trim().toLowerCase();

export const resolveSpaceDisplayName = (
  space: ResolvableSpace | null | undefined,
  t: TFunction,
  options: ResolveSpaceDisplayNameOptions = {},
) => {
  const rawName = space?.name?.trim();

  if (space?.kind !== 'personal') return rawName;

  const normalizedName = normalize(rawName);
  const defaultCandidates = new Set(
    ['my space', 'personal space', options.fullName, options.username]
      .map(normalize)
      .filter(Boolean),
  );

  if (!normalizedName || defaultCandidates.has(normalizedName)) {
    return t('space.personal.title', { ns: 'file' });
  }

  return rawName;
};
