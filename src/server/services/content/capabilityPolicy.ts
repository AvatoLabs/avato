import type { ContentRole, SpaceRole } from '@lobechat/types';

import type { ContentCapability } from './index';

export const RESOURCE_ROLE_CAPABILITIES: Record<ContentRole, ContentCapability[]> = {
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

export const SPACE_ROLE_CAPABILITIES: Record<SpaceRole, ContentCapability[]> = {
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

const hasCapability = (capabilitySet: ContentCapability[], capability: ContentCapability) =>
  capabilitySet.includes(capability);

export const resourceRoleHasCapability = (role: ContentRole, capability: ContentCapability) => {
  const caps = RESOURCE_ROLE_CAPABILITIES[role];
  if (capability === 'preview_content') {
    return hasCapability(caps, 'preview_content') || hasCapability(caps, 'read_content');
  }

  return hasCapability(caps, capability);
};

export const spaceRoleHasCapability = (role: SpaceRole, capability: ContentCapability) => {
  const caps = SPACE_ROLE_CAPABILITIES[role];
  if (capability === 'preview_content') {
    return hasCapability(caps, 'preview_content') || hasCapability(caps, 'read_content');
  }

  return hasCapability(caps, capability);
};

export const shareViewerAllowsCapability = (capability: ContentCapability) => {
  if (capability === 'preview_content') {
    return (
      hasCapability(RESOURCE_ROLE_CAPABILITIES.viewer, 'preview_content') ||
      hasCapability(RESOURCE_ROLE_CAPABILITIES.viewer, 'read_content')
    );
  }

  return hasCapability(RESOURCE_ROLE_CAPABILITIES.viewer, capability);
};

export const contentGrantAllowsDelegatingSharing = (
  role: ContentRole,
  options?: { canReshare?: boolean | null },
) => {
  if (role === 'owner') return true;
  if (role === 'editor') return !!options?.canReshare;
  return false;
};
