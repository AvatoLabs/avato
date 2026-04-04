'use client';

import type { SpaceRole } from '@lobechat/types';

const SPACE_MEMORY_CREATE_ROLES = new Set<SpaceRole>(['admin', 'editor', 'owner']);

export const canCreateSpaceMemory = (space?: {
  kind?: string | null;
  membershipRole?: string | null;
}) => {
  if (!space || space.kind !== 'team') return false;

  return SPACE_MEMORY_CREATE_ROLES.has(space.membershipRole as SpaceRole);
};
