'use client';

import type { ResourceCapability, SpaceRole } from '@lobechat/types';
import { useMemo } from 'react';
import useSWR from 'swr';

import { lambdaClient } from '@/libs/trpc/client';

/**
 * Client-side mirror of the server's SPACE_ROLE_CAPABILITIES mapping.
 * Determines which operations a user can perform based on their space membership role.
 */
const SPACE_ROLE_CAPABILITIES: Record<SpaceRole, readonly ResourceCapability[]> = {
  admin: [
    'create_child',
    'delete',
    'download_blob',
    'manage_members',
    'move',
    'preview_content',
    'read_content',
    'read_metadata',
    'share_link',
    'share_member',
  ],
  editor: [
    'create_child',
    'delete',
    'download_blob',
    'move',
    'preview_content',
    'read_content',
    'read_metadata',
    'share_link',
    'share_member',
  ],
  owner: [
    'create_child',
    'delete',
    'download_blob',
    'manage_members',
    'move',
    'preview_content',
    'read_content',
    'read_metadata',
    'share_link',
    'share_member',
  ],
  viewer: ['download_blob', 'preview_content', 'read_content', 'read_metadata'],
};

export interface SpaceCapabilities {
  canDelete: boolean;
  canEdit: boolean;
  canManageMembers: boolean;
  canMove: boolean;
  canShareLink: boolean;
  canShareMember: boolean;
  has: (capability: ResourceCapability) => boolean;
  isViewer: boolean;
  role?: SpaceRole;
}

const VIEWER_CAPS: SpaceCapabilities = {
  canDelete: false,
  canEdit: false,
  canManageMembers: false,
  canMove: false,
  canShareLink: false,
  canShareMember: false,
  has: () => false,
  isViewer: true,
  role: undefined,
};

/**
 * Returns the current user's capabilities for a given space.
 * Reads from the cached `listSpaces` SWR data — no extra API calls.
 */
export const useSpaceCapabilities = (spaceId?: string): SpaceCapabilities => {
  const { data: spaces } = useSWR(
    'resource-space-list',
    () => lambdaClient.space.listSpaces.query(),
    { revalidateOnFocus: false },
  );

  return useMemo(() => {
    if (!spaceId || !spaces) return VIEWER_CAPS;

    const space = spaces.find((s) => s.id === spaceId);
    const role = space?.membershipRole;
    if (!role) return VIEWER_CAPS;

    const caps = SPACE_ROLE_CAPABILITIES[role];
    const capSet = new Set(caps);

    return {
      canDelete: capSet.has('delete'),
      canEdit: capSet.has('create_child'),
      canManageMembers: capSet.has('manage_members'),
      canMove: capSet.has('move'),
      canShareLink: capSet.has('share_link'),
      canShareMember: capSet.has('share_member'),
      has: (capability: ResourceCapability) => capSet.has(capability),
      isViewer: role === 'viewer',
      role,
    };
  }, [spaceId, spaces]);
};
