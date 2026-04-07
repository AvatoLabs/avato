// @vitest-environment node
import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { documentRouter } from '@/server/routers/lambda/document';

const mockDocumentModelFindBySlug = vi.fn();
const mockDocumentModelFindBySlugInSpace = vi.fn();
const mockDocumentModelFindByIdAny = vi.fn();
const mockDocumentServiceCreateDocument = vi.fn();
const mockDocumentServiceCreateDocuments = vi.fn();
const mockDocumentServiceEnsureFileDocument = vi.fn();
const mockDocumentServicePreviewFileContent = vi.fn();
const mockDocumentServiceQueryDocuments = vi.fn();
const mockResourceAuthorizerGetAccessMatch = vi.fn();
const mockResolverRequireKnowledgeBase = vi.fn();
const mockSpaceModelFindAccessibleSpaceById = vi.fn();

vi.mock('@/database/models/chunk', () => ({
  ChunkModel: vi.fn(() => ({})),
}));

vi.mock('@/database/models/document', () => ({
  DocumentModel: vi.fn(() => ({
    findByIdAny: mockDocumentModelFindByIdAny,
    findBySlug: mockDocumentModelFindBySlug,
    findBySlugInSpace: mockDocumentModelFindBySlugInSpace,
    findManyBySlug: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock('@/database/models/file', () => ({
  FileModel: vi.fn(() => ({})),
}));

vi.mock('@/database/models/message', () => ({
  MessageModel: vi.fn(() => ({})),
}));

vi.mock('@/database/models/space', () => ({
  SpaceModel: vi.fn(() => ({
    findAccessibleSpaceById: mockSpaceModelFindAccessibleSpaceById,
  })),
}));

vi.mock('@/server/services/document', () => ({
  DocumentService: vi.fn(() => ({
    createDocument: mockDocumentServiceCreateDocument,
    createDocuments: mockDocumentServiceCreateDocuments,
    ensureFileDocument: mockDocumentServiceEnsureFileDocument,
    previewFileContent: mockDocumentServicePreviewFileContent,
    queryDocuments: mockDocumentServiceQueryDocuments,
  })),
}));

vi.mock('@/server/services/content', () => ({
  AuthorizedResourceResolver: vi.fn(() => ({
    requireSourceSet: mockResolverRequireKnowledgeBase,
  })),
  ContentAuthorizer: vi.fn(() => ({
    getAccessMatch: mockResourceAuthorizerGetAccessMatch,
    assertCapability: vi.fn().mockResolvedValue(undefined),
    filterVisibleDocumentIdsForList: vi.fn().mockResolvedValue([]),
  })),
}));

describe('documentRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDocumentModelFindByIdAny.mockResolvedValue(undefined);
    mockDocumentModelFindBySlug.mockResolvedValue(undefined);
    mockDocumentModelFindBySlugInSpace.mockResolvedValue(undefined);
    mockResourceAuthorizerGetAccessMatch.mockResolvedValue({
      canAccess: true,
    });
    mockResolverRequireKnowledgeBase.mockResolvedValue(undefined);
  });

  it('should reject inaccessible space queries', async () => {
    mockSpaceModelFindAccessibleSpaceById.mockResolvedValue(undefined);

    const caller = documentRouter.createCaller({
      serverDB: {} as any,
      userId: 'test-user',
    } as any);

    await expect(
      caller.queryDocuments({
        pageSize: 20,
        spaceId: 'spc_shared',
      }),
    ).rejects.toThrow(new TRPCError({ code: 'FORBIDDEN', message: 'SPACE_ACCESS_DENIED' }));

    expect(mockDocumentServiceQueryDocuments).not.toHaveBeenCalled();
  });

  it('should query documents when the target space is accessible', async () => {
    mockSpaceModelFindAccessibleSpaceById.mockResolvedValue({
      id: 'spc_shared',
      membershipRole: 'viewer',
    });
    mockDocumentServiceQueryDocuments.mockResolvedValue({
      items: [{ id: 'docs_1', spaceId: 'spc_shared' }],
      total: 1,
    });

    const caller = documentRouter.createCaller({
      serverDB: {} as any,
      userId: 'test-user',
    } as any);

    const result = await caller.queryDocuments({
      pageSize: 20,
      spaceId: 'spc_shared',
    });

    expect(result).toEqual({
      items: [{ id: 'docs_1', spaceId: 'spc_shared' }],
      total: 1,
    });
    expect(mockDocumentServiceQueryDocuments).toHaveBeenCalledWith({
      pageSize: 20,
      spaceId: 'spc_shared',
    });
  });

  it('should resolve parent slugs within the provided space when creating a document', async () => {
    mockDocumentModelFindBySlugInSpace.mockResolvedValue({ id: 'folder-in-space' });
    mockDocumentServiceCreateDocument.mockResolvedValue({ id: 'docs_1' });

    const caller = documentRouter.createCaller({
      serverDB: {} as any,
      userId: 'test-user',
    } as any);

    await caller.createDocument({
      editorData: '{}',
      parentId: 'shared-folder',
      spaceId: 'spc_shared',
      title: 'Doc in Shared Space',
    });

    expect(mockDocumentModelFindBySlugInSpace).toHaveBeenCalledWith('shared-folder', 'spc_shared');
    expect(mockDocumentServiceCreateDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        parentId: 'folder-in-space',
        spaceId: 'spc_shared',
      }),
    );
  });

  it('should resolve folder breadcrumbs within the provided space', async () => {
    mockDocumentModelFindBySlugInSpace.mockResolvedValue({
      id: 'folder-in-space',
      parentId: null,
      slug: 'shared-folder',
      title: 'Shared Folder',
    });

    const caller = documentRouter.createCaller({
      serverDB: {} as any,
      userId: 'test-user',
    } as any);

    const result = await caller.getFolderBreadcrumb({
      slug: 'shared-folder',
      spaceId: 'spc_shared',
    });

    expect(mockDocumentModelFindBySlugInSpace).toHaveBeenCalledWith('shared-folder', 'spc_shared');
    expect(result).toEqual([
      {
        id: 'folder-in-space',
        name: 'Shared Folder',
        slug: 'shared-folder',
      },
    ]);
  });

  it('should allow canonical document ids through ensureFileDocument', async () => {
    mockDocumentServiceEnsureFileDocument.mockResolvedValue({ id: 'docs_1' });

    const caller = documentRouter.createCaller({
      serverDB: {} as any,
      userId: 'test-user',
    } as any);

    const result = await caller.ensureFileDocument({ id: 'docs_1' });

    expect(mockDocumentServiceEnsureFileDocument).toHaveBeenCalledWith('docs_1');
    expect(result).toEqual({ id: 'docs_1' });
  });

  it('should allow canonical document ids through previewFileContent', async () => {
    mockDocumentServicePreviewFileContent.mockResolvedValue({ id: 'docs_1', content: '# Hello' });

    const caller = documentRouter.createCaller({
      serverDB: {} as any,
      userId: 'test-user',
    } as any);

    const result = await caller.previewFileContent({ id: 'docs_1' });

    expect(mockDocumentServicePreviewFileContent).toHaveBeenCalledWith('docs_1');
    expect(result).toEqual({ content: '# Hello', id: 'docs_1' });
  });
});
