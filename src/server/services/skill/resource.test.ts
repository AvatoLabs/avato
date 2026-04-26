import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SkillResourceService } from './resource';

// Create mock functions that can be inspected
const mockCreateGlobalFile = vi.fn().mockResolvedValue({ sha256: 'mock-file-hash' });
const mockGetFileContentBySha256 = vi.fn().mockResolvedValue('file content');
const mockGetFileByteArrayBySha256 = vi
  .fn()
  .mockResolvedValue(new Uint8Array([0x89, 0x50, 0x4E, 0x47]));
const mockUploadBuffer = vi.fn().mockResolvedValue({ key: 'mock-key' });

// Mock FileService only (no longer need FileModel)
vi.mock('@/server/services/file', () => ({
  FileService: vi.fn().mockImplementation(() => ({
    createGlobalFile: mockCreateGlobalFile,
    getFileByteArrayBySha256: mockGetFileByteArrayBySha256,
    getFileContentBySha256: mockGetFileContentBySha256,
    uploadBuffer: mockUploadBuffer,
  })),
}));

describe('SkillResourceService', () => {
  describe('listResources (buildTree)', () => {
    it('should build flat file list', async () => {
      const service = new SkillResourceService({} as any, 'user-1');
      const resources = {
        'README.md': { sha256: 'hash1', size: 100 },
        'config.json': { sha256: 'hash2', size: 200 },
      };

      const tree = await service.listResources(resources);

      expect(tree).toHaveLength(2);
      expect(tree[0]).toEqual({
        children: undefined,
        name: 'README.md',
        path: 'README.md',
        type: 'file',
      });
      expect(tree[1]).toEqual({
        children: undefined,
        name: 'config.json',
        path: 'config.json',
        type: 'file',
      });
    });

    it('should build nested directory structure', async () => {
      const service = new SkillResourceService({} as any, 'user-1');
      const resources = {
        'lib/utils.ts': { sha256: 'hash1', size: 100 },
        'lib/helpers.ts': { sha256: 'hash2', size: 200 },
        'src/index.ts': { sha256: 'hash3', size: 300 },
      };

      const tree = await service.listResources(resources);

      expect(tree).toHaveLength(2);

      // lib directory
      const libDir = tree.find((n) => n.name === 'lib');
      expect(libDir).toBeDefined();
      expect(libDir?.type).toBe('directory');
      expect(libDir?.children).toHaveLength(2);
      expect(libDir?.children?.map((c) => c.name).sort()).toEqual(['helpers.ts', 'utils.ts']);

      // src directory
      const srcDir = tree.find((n) => n.name === 'src');
      expect(srcDir).toBeDefined();
      expect(srcDir?.type).toBe('directory');
      expect(srcDir?.children).toHaveLength(1);
      expect(srcDir?.children?.[0].name).toBe('index.ts');
    });

    it('should build deeply nested structure', async () => {
      const service = new SkillResourceService({} as any, 'user-1');
      const resources = {
        'a/b/c/d.txt': { sha256: 'hash1', size: 100 },
      };

      const tree = await service.listResources(resources);

      expect(tree).toHaveLength(1);
      expect(tree[0].name).toBe('a');
      expect(tree[0].type).toBe('directory');
      expect(tree[0].children?.[0].name).toBe('b');
      expect(tree[0].children?.[0].children?.[0].name).toBe('c');
      expect(tree[0].children?.[0].children?.[0].children?.[0].name).toBe('d.txt');
      expect(tree[0].children?.[0].children?.[0].children?.[0].type).toBe('file');
    });

    it('should handle mixed files and directories', async () => {
      const service = new SkillResourceService({} as any, 'user-1');
      const resources = {
        'README.md': { sha256: 'hash1', size: 100 },
        'lib/index.ts': { sha256: 'hash2', size: 200 },
        'lib/utils/helper.ts': { sha256: 'hash3', size: 300 },
      };

      const tree = await service.listResources(resources);

      expect(tree).toHaveLength(2);

      // README.md at root
      const readme = tree.find((n) => n.name === 'README.md');
      expect(readme?.type).toBe('file');

      // lib directory with nested utils
      const lib = tree.find((n) => n.name === 'lib');
      expect(lib?.type).toBe('directory');
      expect(lib?.children).toHaveLength(2);

      const utils = lib?.children?.find((n) => n.name === 'utils');
      expect(utils?.type).toBe('directory');
      expect(utils?.children?.[0].name).toBe('helper.ts');
    });

    it('should handle empty resources', async () => {
      const service = new SkillResourceService({} as any, 'user-1');
      const tree = await service.listResources({});

      expect(tree).toEqual([]);
    });

    it('should sort paths alphabetically', async () => {
      const service = new SkillResourceService({} as any, 'user-1');
      const resources = {
        'z.txt': { sha256: 'hash1', size: 100 },
        'a.txt': { sha256: 'hash2', size: 200 },
        'm.txt': { sha256: 'hash3', size: 300 },
      };

      const tree = await service.listResources(resources);

      expect(tree.map((n) => n.name)).toEqual(['a.txt', 'm.txt', 'z.txt']);
    });
  });

  describe('storeResources', () => {
    beforeEach(() => {
      mockCreateGlobalFile.mockClear();
      mockUploadBuffer.mockClear();
    });

    it('should store resources with opaque storage paths and return SkillResourceMeta', async () => {
      const service = new SkillResourceService({} as any, 'user-1');
      const resources = new Map([
        ['README.md', Buffer.from('# README')],
        ['lib/utils.ts', Buffer.from('export const util = 1')],
      ]);

      const result = await service.storeResources('abc123hash', resources);

      expect(Object.keys(result)).toHaveLength(2);
      // Result should be Record<VirtualPath, SkillResourceMeta>
      expect(result['README.md']).toHaveProperty('sha256');
      expect(result['README.md'].sha256).toHaveLength(64);
      expect(result['lib/utils.ts']).toHaveProperty('sha256');
      expect(result['lib/utils.ts'].sha256).toHaveLength(64);
    });

    it('should pass correct metadata to createGlobalFile', async () => {
      const service = new SkillResourceService({} as any, 'user-1');
      const resources = new Map([['docs/guide.md', Buffer.from('# Guide')]]);

      await service.storeResources('zip123', resources);

      expect(mockCreateGlobalFile).toHaveBeenCalledWith(
        expect.objectContaining({
          fileType: 'text/markdown',
          metadata: {
            dirname: expect.stringMatching(/^skills\/source-files\/[a-f0-9]{16}$/),
            filename: expect.stringMatching(/^[a-f0-9]{16}\.md$/),
            originalPath: 'docs/guide.md',
            path: expect.stringMatching(/^skills\/source-files\/[a-f0-9]{16}\/[a-f0-9]{16}\.md$/),
          },
          sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
          storageKey: expect.stringMatching(
            /^skills\/source-files\/[a-f0-9]{16}\/[a-f0-9]{16}\.md$/,
          ),
        }),
      );
    });

    it('should pass correct metadata for root-level files', async () => {
      const service = new SkillResourceService({} as any, 'user-1');
      const resources = new Map([['README.md', Buffer.from('# README')]]);

      await service.storeResources('zip456', resources);

      expect(mockCreateGlobalFile).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: {
            dirname: expect.stringMatching(/^skills\/source-files\/[a-f0-9]{16}$/),
            filename: expect.stringMatching(/^[a-f0-9]{16}\.md$/),
            originalPath: 'README.md',
            path: expect.stringMatching(/^skills\/source-files\/[a-f0-9]{16}\/[a-f0-9]{16}\.md$/),
          },
        }),
      );
    });

    it('should not expose raw zip hash in resource storage paths', async () => {
      const service = new SkillResourceService({} as any, 'user-1');
      const resources = new Map([['README.md', Buffer.from('# README')]]);

      await service.storeResources('raw-zip-hash', resources);

      const call = mockCreateGlobalFile.mock.calls[0]?.[0];
      expect(call?.storageKey).toMatch(/^skills\/source-files\/[a-f0-9]{16}\/[a-f0-9]{16}\.md$/);
      expect(call?.storageKey).not.toContain('raw-zip-hash');
    });

    it('should handle empty resources', async () => {
      const service = new SkillResourceService({} as any, 'user-1');
      const resources = new Map<string, Buffer>();

      const result = await service.storeResources('abc123hash', resources);

      expect(result).toEqual({});
    });
  });

  describe('readResource', () => {
    it('should read text resource content with utf-8 encoding', async () => {
      const service = new SkillResourceService({} as any, 'user-1');
      const resources = { 'test.txt': { sha256: 'abc123fileHash', size: 50 } };

      const result = await service.readResource(resources, 'test.txt');

      expect(result).toEqual({
        content: 'file content',
        encoding: 'utf8',
        fileType: 'text/plain',
        path: 'test.txt',
        sha256: 'abc123fileHash',
        size: Buffer.byteLength('file content', 'utf8'),
      });
      expect(mockGetFileContentBySha256).toHaveBeenCalledWith('abc123fileHash');
    });

    it('should read binary resource content with base64 encoding', async () => {
      const service = new SkillResourceService({} as any, 'user-1');
      const resources = { 'image.png': { sha256: 'binaryFileHash', size: 1024 } };
      const binaryData = new Uint8Array([0x89, 0x50, 0x4E, 0x47]);
      mockGetFileByteArrayBySha256.mockResolvedValue(binaryData);

      const result = await service.readResource(resources, 'image.png');

      expect(result).toEqual({
        content: Buffer.from(binaryData).toString('base64'),
        encoding: 'base64',
        fileType: 'image/png',
        path: 'image.png',
        sha256: 'binaryFileHash',
        size: binaryData.length,
      });
      expect(mockGetFileByteArrayBySha256).toHaveBeenCalledWith('binaryFileHash');
    });

    it('should throw error for non-existent path', async () => {
      const service = new SkillResourceService({} as any, 'user-1');
      const resources = { 'test.txt': { sha256: 'abc123fileHash', size: 50 } };

      await expect(service.readResource(resources, 'non-existent.txt')).rejects.toThrow(
        'Resource not found: non-existent.txt',
      );
    });
  });
});
