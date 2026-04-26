import { type SpaceRole } from '@lobechat/types';

const FILE_ASSET_GOVERNANCE_EDIT_ROLES = new Set<SpaceRole>(['owner', 'admin', 'editor']);
const FILE_ASSET_APPROVE_ROLES = new Set<SpaceRole>(['owner', 'admin']);
const FILE_ASSET_ARCHIVE_ROLES = new Set<SpaceRole>(['owner', 'admin']);

export const resolveFileAssetCapabilities = (membershipRole?: string | null) => {
  const role = membershipRole as SpaceRole | undefined;

  return {
    canApprove: role ? FILE_ASSET_APPROVE_ROLES.has(role) : false,
    canArchive: role ? FILE_ASSET_ARCHIVE_ROLES.has(role) : false,
    canEditGovernance: role ? FILE_ASSET_GOVERNANCE_EDIT_ROLES.has(role) : false,
  };
};
