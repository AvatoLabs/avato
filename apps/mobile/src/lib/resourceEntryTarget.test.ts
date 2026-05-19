import { describe, expect, it } from 'vitest';

import { fileListItemFromNavigationTarget, fileListItemFromShared } from './resourceEntryTarget';

describe('resourceEntryTarget', () => {
  describe('fileListItemFromShared', () => {
    it('should normalize document-like shared ids into document items', () => {
      const item = fileListItemFromShared({
        kind: 'file',
        localId: 'docs_123',
        name: 'Spec',
      });

      expect(item.sourceType).toBe('document');
      expect(item.fileType).toBe('text/plain');
    });

    it('should keep raw file ids as file items', () => {
      const item = fileListItemFromShared({
        kind: 'file',
        localId: 'file_123',
        name: 'asset.png',
      });

      expect(item.sourceType).toBe('file');
      expect(item.fileType).toBe('application/octet-stream');
    });
  });

  describe('fileListItemFromNavigationTarget', () => {
    it('should fall back to document defaults when sourceType is document', () => {
      const item = fileListItemFromNavigationTarget({
        id: 'docs_456',
        name: 'Doc',
        sourceType: 'document',
      });

      expect(item.sourceType).toBe('document');
      expect(item.fileType).toBe('text/plain');
      expect(item.content).toBeNull();
    });
  });
});
