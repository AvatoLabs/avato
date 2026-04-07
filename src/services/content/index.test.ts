import { beforeEach, describe, expect, it, vi } from 'vitest';

import { contentService } from './index';

const {
  mockGetKnowledgeItems,
  mockRestoreDocument,
  mockRestoreDocuments,
  mockRestoreFile,
  mockRestoreFiles,
} = vi.hoisted(() => ({
  mockGetKnowledgeItems: vi.fn(),
  mockRestoreDocument: vi.fn(),
  mockRestoreDocuments: vi.fn(),
  mockRestoreFile: vi.fn(),
  mockRestoreFiles: vi.fn(),
}));

vi.mock('../document', () => ({
  documentService: {
    restoreDocument: mockRestoreDocument,
    restoreDocuments: mockRestoreDocuments,
  },
}));

vi.mock('../file', () => ({
  fileService: {
    getKnowledgeItems: mockGetKnowledgeItems,
    restoreFile: mockRestoreFile,
    restoreFiles: mockRestoreFiles,
  },
}));

describe('ContentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('preserves file governance summary fields when mapping knowledge items', async () => {
    mockGetKnowledgeItems.mockResolvedValue({
      governanceCapabilities: {
        canApprove: false,
        canArchive: false,
        canEditGovernance: true,
      },
      hasMore: false,
      items: [
        {
          assetClassification: 'brand',
          assetLatestGovernanceAuditAction: 'file_asset_approved',
          assetLatestGovernanceAuditActorDisplayName: 'Ops Team',
          assetLatestGovernanceAuditAt: new Date('2026-04-05T10:00:00.000Z'),
          assetPrimaryRenditionKind: 'preview',
          assetPrimaryRenditionLabel: 'Homepage',
          assetReviewStatus: 'approved',
          assetRenditionCount: 2,
          assetUsagePolicy: 'restricted',
          assetVersionLabel: '2026-Q2',
          chunkCount: 3,
          chunkingError: null,
          chunkingStatus: null,
          createdAt: new Date('2026-04-05T00:00:00.000Z'),
          embeddingError: null,
          embeddingStatus: null,
          fileId: 'file-1',
          fileType: 'application/pdf',
          finishEmbedding: false,
          id: 'file-1',
          name: 'Brand Guide.pdf',
          size: 1024,
          sourceType: 'file',
          updatedAt: new Date('2026-04-05T00:00:00.000Z'),
          url: '/f/file-1',
        },
      ],
    });

    const result = await contentService.queryContentItems({});

    expect(result.items[0]).toMatchObject({
      assetClassification: 'brand',
      assetLatestGovernanceAuditAction: 'file_asset_approved',
      assetLatestGovernanceAuditActorDisplayName: 'Ops Team',
      assetLatestGovernanceAuditAt: new Date('2026-04-05T10:00:00.000Z'),
      assetPrimaryRenditionKind: 'preview',
      assetPrimaryRenditionLabel: 'Homepage',
      assetReviewStatus: 'approved',
      assetRenditionCount: 2,
      assetUsagePolicy: 'restricted',
      assetVersionLabel: '2026-Q2',
    });
  });

  it('canonicalizes docs_* file-backed items to document sourceType', async () => {
    mockGetKnowledgeItems.mockResolvedValue({
      hasMore: false,
      items: [
        {
          chunkCount: null,
          chunkingError: null,
          chunkingStatus: null,
          createdAt: new Date('2026-04-05T00:00:00.000Z'),
          embeddingError: null,
          embeddingStatus: null,
          fileId: 'file-1',
          fileType: 'application/pdf',
          finishEmbedding: false,
          id: 'docs_derived_1',
          name: 'Spec.pdf',
          size: 1024,
          sourceType: 'file',
          updatedAt: new Date('2026-04-05T00:00:00.000Z'),
          url: '/f/file-1',
        },
      ],
    });

    const result = await contentService.queryContentItems({});

    expect(result.items[0]?.sourceType).toBe('document');
  });

  it('restores docs_* items through document restore even when sourceType is file', async () => {
    await contentService.restoreContentItem({ id: 'docs_derived_1', sourceType: 'file' });
    await contentService.restoreContentItems([
      { id: 'docs_derived_1', sourceType: 'file' },
      { id: 'file_1', sourceType: 'file' },
    ]);

    expect(mockRestoreDocument).toHaveBeenCalledWith('docs_derived_1');
    expect(mockRestoreDocuments).toHaveBeenCalledWith(['docs_derived_1']);
    expect(mockRestoreFile).not.toHaveBeenCalledWith('docs_derived_1');
    expect(mockRestoreFiles).toHaveBeenCalledWith(['file_1']);
  });
});
