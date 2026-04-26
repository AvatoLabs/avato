import { describe, expect, it } from 'vitest';

import {
  contentGrantAllowsDelegatingSharing,
  resourceRoleHasCapability,
  shareViewerAllowsCapability,
  spaceRoleHasCapability,
} from './capabilityPolicy';

describe('capabilityPolicy', () => {
  it('should allow preview capability wherever read_content already exists', () => {
    expect(resourceRoleHasCapability('viewer', 'preview_content')).toBe(true);
    expect(spaceRoleHasCapability('viewer', 'preview_content')).toBe(true);
  });

  it('should keep non-preview capabilities explicit', () => {
    expect(resourceRoleHasCapability('viewer', 'share_member')).toBe(false);
    expect(spaceRoleHasCapability('editor', 'share_member')).toBe(true);
  });

  it('should keep share-link viewers limited to viewer-safe capabilities', () => {
    expect(shareViewerAllowsCapability('read_content')).toBe(true);
    expect(shareViewerAllowsCapability('preview_content')).toBe(true);
    expect(shareViewerAllowsCapability('share_member')).toBe(false);
  });

  it('should gate delegating sharing on owner or editor+canReshare', () => {
    expect(contentGrantAllowsDelegatingSharing('owner')).toBe(true);
    expect(contentGrantAllowsDelegatingSharing('editor', { canReshare: true })).toBe(true);
    expect(contentGrantAllowsDelegatingSharing('editor', { canReshare: false })).toBe(false);
    expect(contentGrantAllowsDelegatingSharing('viewer')).toBe(false);
  });
});
