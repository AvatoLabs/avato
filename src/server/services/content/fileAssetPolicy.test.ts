import { describe, expect, it } from 'vitest';

import { resolveFileAssetCapabilities } from './fileAssetPolicy';

describe('resolveFileAssetCapabilities', () => {
  it('should allow owner and admin to fully govern assets', () => {
    expect(resolveFileAssetCapabilities('owner')).toEqual({
      canApprove: true,
      canArchive: true,
      canEditGovernance: true,
    });
    expect(resolveFileAssetCapabilities('admin')).toEqual({
      canApprove: true,
      canArchive: true,
      canEditGovernance: true,
    });
  });

  it('should allow editors to edit governance metadata but not approve or archive', () => {
    expect(resolveFileAssetCapabilities('editor')).toEqual({
      canApprove: false,
      canArchive: false,
      canEditGovernance: true,
    });
  });

  it('should deny viewers and unknown roles from governing assets', () => {
    expect(resolveFileAssetCapabilities('viewer')).toEqual({
      canApprove: false,
      canArchive: false,
      canEditGovernance: false,
    });
    expect(resolveFileAssetCapabilities(undefined)).toEqual({
      canApprove: false,
      canArchive: false,
      canEditGovernance: false,
    });
    expect(resolveFileAssetCapabilities('something-else')).toEqual({
      canApprove: false,
      canArchive: false,
      canEditGovernance: false,
    });
  });
});
