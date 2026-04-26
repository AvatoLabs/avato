import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockFindAccessibleSpaceById,
  mockGetOrCreatePersonalSpace,
  mockNanoid,
  mockResolveSpaceIdForSandboxExport,
} = vi.hoisted(() => ({
  mockFindAccessibleSpaceById: vi.fn(),
  mockGetOrCreatePersonalSpace: vi.fn(),
  mockNanoid: vi.fn(),
  mockResolveSpaceIdForSandboxExport: vi.fn(),
}));

vi.mock('@lobechat/utils', async () => ({
  nanoid: mockNanoid,
}));

vi.mock('@/database/models/space', () => ({
  SpaceModel: vi.fn(() => ({
    findAccessibleSpaceById: mockFindAccessibleSpaceById,
    getOrCreatePersonalSpace: mockGetOrCreatePersonalSpace,
  })),
}));

vi.mock('./resolveSpaceIdForSandboxExport', () => ({
  resolveSpaceIdForSandboxExport: mockResolveSpaceIdForSandboxExport,
}));

const {
  generateSandboxExportStorageKey,
  resolveTargetSpaceIdForSandboxExport,
} = await import('./sandboxExport');

describe('sandboxExport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNanoid.mockReturnValue('opq_export_123');
    mockResolveSpaceIdForSandboxExport.mockResolvedValue(undefined);
    mockFindAccessibleSpaceById.mockResolvedValue(undefined);
    mockGetOrCreatePersonalSpace.mockResolvedValue({ id: 'spc_personal' });
  });

  it('generates a space-scoped sandbox export key without embedding filename', () => {
    const key = generateSandboxExportStorageKey('spc_target');

    expect(key).toBe('v2/spaces/spc_target/blobs/sandbox-exports/opq_export_123');
    expect(key).not.toContain('report.csv');
  });

  it('prefers an explicit accessible space before derived or personal fallback', async () => {
    mockFindAccessibleSpaceById.mockResolvedValue({ id: 'spc_explicit' });

    const result = await resolveTargetSpaceIdForSandboxExport({
      db: {} as any,
      spaceId: 'spc_explicit',
      topicId: 'topic-1',
      userId: 'user-1',
    });

    expect(result).toBe('spc_explicit');
    expect(mockResolveSpaceIdForSandboxExport).not.toHaveBeenCalled();
    expect(mockGetOrCreatePersonalSpace).not.toHaveBeenCalled();
  });

  it('falls back to the derived topic space when explicit space is unavailable', async () => {
    mockResolveSpaceIdForSandboxExport.mockResolvedValue('spc_topic');

    const result = await resolveTargetSpaceIdForSandboxExport({
      db: {} as any,
      spaceId: 'spc_missing',
      topicId: 'topic-1',
      userId: 'user-1',
    });

    expect(result).toBe('spc_topic');
    expect(mockGetOrCreatePersonalSpace).not.toHaveBeenCalled();
  });

  it('falls back to personal space when no explicit or derived space is available', async () => {
    const result = await resolveTargetSpaceIdForSandboxExport({
      db: {} as any,
      topicId: 'topic-1',
      userId: 'user-1',
    });

    expect(result).toBe('spc_personal');
    expect(mockGetOrCreatePersonalSpace).toHaveBeenCalledTimes(1);
  });
});
