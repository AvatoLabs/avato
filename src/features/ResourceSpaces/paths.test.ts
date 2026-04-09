import { describe, expect, it } from 'vitest';

import {
  buildSourceSetPath,
  isWorkspaceFilesSurfacePath,
  isWorkspaceResourcePath,
} from './paths';

describe('ResourceSpaces paths', () => {
  describe('isWorkspaceFilesSurfacePath', () => {
    it('should match canonical shared, trash and space files paths', () => {
      expect(isWorkspaceFilesSurfacePath('/spaces/shared')).toBe(true);
      expect(isWorkspaceFilesSurfacePath('/spaces/trash/')).toBe(true);
      expect(isWorkspaceFilesSurfacePath('/spaces/spc_team/files')).toBe(true);
      expect(isWorkspaceFilesSurfacePath('/spaces/spc_team/files/item/file_1')).toBe(true);
    });

    it('should reject legacy content routes', () => {
      expect(isWorkspaceFilesSurfacePath('/content/shared')).toBe(false);
      expect(isWorkspaceFilesSurfacePath('/content/trash')).toBe(false);
    });
  });

  describe('isWorkspaceResourcePath', () => {
    it('should match canonical space resource surfaces', () => {
      expect(isWorkspaceResourcePath('/spaces/spc_team/docs')).toBe(true);
      expect(isWorkspaceResourcePath('/spaces/spc_team/docs/page_1')).toBe(true);
      expect(isWorkspaceResourcePath('/spaces/spc_team/settings')).toBe(true);
      expect(isWorkspaceResourcePath('/spaces/spc_team/members')).toBe(true);
      expect(isWorkspaceResourcePath('/spaces/spc_team/memory/audit/mem_1')).toBe(true);
    });

    it('should reject non-resource routes', () => {
      expect(isWorkspaceResourcePath('/community')).toBe(false);
      expect(isWorkspaceResourcePath('/agent/123')).toBe(false);
    });
  });

  describe('buildSourceSetPath', () => {
    it('should build canonical space files scope paths', () => {
      expect(buildSourceSetPath('spc_team', 'ss_1')).toBe('/spaces/spc_team/files?scope=source-set%3Ass_1');
      expect(buildSourceSetPath(null, 'ss_1')).toBe('/spaces?scope=source-set%3Ass_1');
    });
  });
});
