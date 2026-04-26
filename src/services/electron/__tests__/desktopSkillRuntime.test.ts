import { beforeEach, describe, expect, it, vi } from 'vitest';

import { desktopSkillRuntimeService } from '@/services/electron/desktopSkillRuntime';

const {
  createFileMock,
  getByIdMock,
  getByNameMock,
  getZipUrlMock,
  prepareSkillDirectoryMock,
  readFileAsBase64Mock,
  resolveSkillResourcePathMock,
  uploadFileToS3Mock,
} = vi.hoisted(() => ({
  createFileMock: vi.fn(),
  getByIdMock: vi.fn(),
  getByNameMock: vi.fn(),
  getZipUrlMock: vi.fn(),
  prepareSkillDirectoryMock: vi.fn(),
  readFileAsBase64Mock: vi.fn(),
  resolveSkillResourcePathMock: vi.fn(),
  uploadFileToS3Mock: vi.fn(),
}));

vi.mock('@/services/skill', () => ({
  agentSkillService: {
    getById: getByIdMock,
    getByName: getByNameMock,
    getZipUrl: getZipUrlMock,
  },
}));

vi.mock('@/services/electron/localFileService', () => ({
  localFileService: {
    prepareSkillDirectory: prepareSkillDirectoryMock,
    readFileAsBase64: readFileAsBase64Mock,
    resolveSkillResourcePath: resolveSkillResourcePathMock,
  },
}));

vi.mock('@/services/file', () => ({
  fileService: {
    createFile: createFileMock,
  },
}));

vi.mock('@/services/upload', () => ({
  uploadService: {
    uploadFileToS3: uploadFileToS3Mock,
  },
}));

describe('desktopSkillRuntimeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (desktopSkillRuntimeService as any).executionDirectoriesByContext.clear();
    (desktopSkillRuntimeService as any).lastExecutionDirectory = undefined;
    (desktopSkillRuntimeService as any).registeredCleanupKeys.clear();
  });

  it('should resolve an extracted directory from a skill name', async () => {
    getByNameMock.mockResolvedValue({
      id: 'skill-1',
      name: 'demo-skill',
      zipSha256: 'zip-hash-1',
    });
    getZipUrlMock.mockResolvedValue({
      name: 'demo-skill',
      url: 'https://example.com/demo-skill.zip',
    });
    prepareSkillDirectoryMock.mockResolvedValue({
      extractedDir: '/tmp/demo-skill',
      success: true,
      zipPath: '/tmp/demo-skill.zip',
    });

    const result = await desktopSkillRuntimeService.resolveExecutionDirectory({
      name: 'demo-skill',
    });

    expect(getByNameMock).toHaveBeenCalledWith('demo-skill');
    expect(getZipUrlMock).toHaveBeenCalledWith('skill-1');
    expect(prepareSkillDirectoryMock).toHaveBeenCalledWith({
      url: 'https://example.com/demo-skill.zip',
      zipSha256: 'zip-hash-1',
    });
    expect(result).toBe('/tmp/demo-skill');
  });

  it('should fall back to skill name when config id is not a persisted skill id', async () => {
    getByIdMock.mockResolvedValue(undefined);
    getByNameMock.mockResolvedValue({
      id: 'skill-1',
      name: 'demo-skill',
      zipSha256: 'zip-hash-1',
    });
    getZipUrlMock.mockResolvedValue({
      name: 'demo-skill',
      url: 'https://example.com/demo-skill.zip',
    });
    prepareSkillDirectoryMock.mockResolvedValue({
      extractedDir: '/tmp/demo-skill',
      success: true,
      zipPath: '/tmp/demo-skill.zip',
    });

    const result = await desktopSkillRuntimeService.resolveExecutionDirectory({
      id: 'lobe-skills-run-0',
      name: 'demo-skill',
    });

    expect(getByIdMock).toHaveBeenCalledWith('lobe-skills-run-0');
    expect(getByNameMock).toHaveBeenCalledWith('demo-skill');
    expect(getZipUrlMock).toHaveBeenCalledWith('skill-1');
    expect(result).toBe('/tmp/demo-skill');
  });

  it('should return undefined when the skill has no packaged zip', async () => {
    getByNameMock.mockResolvedValue({
      id: 'skill-1',
      name: 'demo-skill',
      zipSha256: null,
    });

    const result = await desktopSkillRuntimeService.resolveExecutionDirectory({
      name: 'demo-skill',
    });

    expect(getZipUrlMock).not.toHaveBeenCalled();
    expect(prepareSkillDirectoryMock).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it('should resolve the full local path for a referenced skill resource', async () => {
    getByNameMock.mockResolvedValue({
      id: 'skill-1',
      name: 'demo-skill',
      zipSha256: 'zip-hash-1',
    });
    getZipUrlMock.mockResolvedValue({
      name: 'demo-skill',
      url: 'https://example.com/demo-skill.zip',
    });
    resolveSkillResourcePathMock.mockResolvedValue({
      fullPath: '/tmp/demo-skill/docs/bazi.py',
      success: true,
      zipPath: '/tmp/demo-skill.zip',
    });

    const result = await desktopSkillRuntimeService.resolveReferenceFullPath({
      path: 'docs/bazi.py',
      skillName: 'demo-skill',
    });

    expect(resolveSkillResourcePathMock).toHaveBeenCalledWith({
      path: 'docs/bazi.py',
      url: 'https://example.com/demo-skill.zip',
      zipSha256: 'zip-hash-1',
    });
    expect(result).toBe('/tmp/demo-skill/docs/bazi.py');
  });

  it('should export a generated file from the current skill execution directory', async () => {
    getByNameMock.mockResolvedValue({
      id: 'skill-1',
      name: 'demo-skill',
      zipSha256: 'zip-hash-1',
    });
    getZipUrlMock.mockResolvedValue({
      name: 'demo-skill',
      url: 'https://example.com/demo-skill.zip',
    });
    prepareSkillDirectoryMock.mockResolvedValue({
      extractedDir: '/tmp/demo-skill',
      success: true,
      zipPath: '/tmp/demo-skill.zip',
    });
    readFileAsBase64Mock.mockResolvedValue({
      base64: 'aGVsbG8=',
      filename: 'output.txt',
      mimeType: 'text/plain',
      path: '/tmp/demo-skill/output.txt',
      sha256: 'sha-1',
      size: 5,
      success: true,
    });
    uploadFileToS3Mock.mockResolvedValue({
      data: {
        date: '2026-04-23',
        dirname: 'files',
        filename: 'result.txt',
        path: 'files/result.txt',
      },
      success: true,
    });
    createFileMock.mockResolvedValue({
      id: 'file-1',
      url: '/files/file-1',
    });

    await desktopSkillRuntimeService.resolveExecutionDirectory(
      {
        name: 'demo-skill',
      },
      { operationId: 'operation-1' },
    );
    const result = await desktopSkillRuntimeService.exportFile('output.txt', 'result.txt', {
      operationId: 'operation-1',
    });

    expect(readFileAsBase64Mock).toHaveBeenCalledWith({
      baseDir: '/tmp/demo-skill',
      path: 'output.txt',
    });
    expect(uploadFileToS3Mock).toHaveBeenCalledWith(expect.any(File), {
      filename: 'result.txt',
      sha256: 'sha-1',
    });
    const uploadedFile = uploadFileToS3Mock.mock.calls[0][0] as File;
    expect(uploadedFile.name).toBe('result.txt');
    expect(uploadedFile.type).toBe('text/plain');
    expect(createFileMock).toHaveBeenCalledWith({
      fileType: 'text/plain',
      metadata: {
        date: '2026-04-23',
        dirname: 'files',
        filename: 'result.txt',
        path: 'files/result.txt',
      },
      name: 'result.txt',
      sha256: 'sha-1',
      size: 5,
      source: 'skill-export',
      storageKey: 'files/result.txt',
    });
    expect(result).toEqual({
      fileId: 'file-1',
      filename: 'result.txt',
      mimeType: 'text/plain',
      size: 5,
      success: true,
      url: '/files/file-1',
    });
  });

  it('should keep export directories scoped by operation context', async () => {
    getByNameMock.mockResolvedValue({
      id: 'skill-1',
      name: 'demo-skill',
      zipSha256: 'zip-hash-1',
    });
    getZipUrlMock.mockResolvedValue({
      name: 'demo-skill',
      url: 'https://example.com/demo-skill.zip',
    });
    prepareSkillDirectoryMock
      .mockResolvedValueOnce({
        extractedDir: '/tmp/demo-skill-a',
        success: true,
        zipPath: '/tmp/demo-skill-a.zip',
      })
      .mockResolvedValueOnce({
        extractedDir: '/tmp/demo-skill-b',
        success: true,
        zipPath: '/tmp/demo-skill-b.zip',
      });
    readFileAsBase64Mock.mockResolvedValue({
      base64: 'aA==',
      filename: 'output.txt',
      mimeType: 'text/plain',
      path: '/tmp/demo-skill-a/output.txt',
      sha256: 'sha-2',
      size: 1,
      success: true,
    });
    uploadFileToS3Mock.mockResolvedValue({
      data: {
        filename: 'result.txt',
        path: 'files/result.txt',
      },
      success: true,
    });
    createFileMock.mockResolvedValue({
      id: 'file-2',
      url: '/files/file-2',
    });

    await desktopSkillRuntimeService.resolveExecutionDirectory(
      {
        name: 'demo-skill',
      },
      { operationId: 'operation-a' },
    );
    await desktopSkillRuntimeService.resolveExecutionDirectory(
      {
        name: 'demo-skill',
      },
      { operationId: 'operation-b' },
    );

    const result = await desktopSkillRuntimeService.exportFile('output.txt', 'result.txt', {
      operationId: 'operation-a',
    });

    expect(readFileAsBase64Mock).toHaveBeenCalledWith({
      baseDir: '/tmp/demo-skill-a',
      path: 'output.txt',
    });
    expect(result).toMatchObject({
      fileId: 'file-2',
      filename: 'result.txt',
      success: true,
    });
  });

  it('should not export when no skill execution directory is active', async () => {
    const result = await desktopSkillRuntimeService.exportFile('output.txt', 'result.txt');

    expect(result).toEqual({
      filename: 'result.txt',
      success: false,
    });
    expect(readFileAsBase64Mock).not.toHaveBeenCalled();
    expect(uploadFileToS3Mock).not.toHaveBeenCalled();
    expect(createFileMock).not.toHaveBeenCalled();
  });
});
