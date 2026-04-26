/**
 * @vitest-environment happy-dom
 */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  FileAssetClassification,
  FileAssetRenditionKind,
  FileAssetReviewStatus,
  FileAssetUsagePolicy,
} from '@/types/files';

import MasonryFileItem from './index';

vi.mock('antd', () => ({
  App: {
    useApp: () => ({
      message: {
        error: vi.fn(),
        success: vi.fn(),
      },
    }),
  },
}));

vi.mock('antd-style', () => ({
  createStaticStyles: vi.fn((factory: any) =>
    factory({
      css: () => 'mock-class',
    }),
  ),
  cssVar: new Proxy(
    {},
    {
      get: (_, prop) => String(prop),
    },
  ),
  cx: (...classNames: Array<string | false | null | undefined>) =>
    classNames.filter(Boolean).join(' '),
}));

vi.mock('@lobehub/ui', () => ({
  Checkbox: ({ checked }: any) => <input readOnly checked={checked} type="checkbox" />,
  Tag: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  showContextMenu: vi.fn(),
  stopPropagation: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'detail.asset.reviewStatus.archived': 'Archived',
        'detail.asset.usagePolicy.internal': 'Internal',
        'detail.asset.usagePolicy.label': 'Usage policy',
        'detail.asset.usagePolicy.restricted': 'Restricted',
        'detail.asset.rendition.preview': 'Preview',
        'detail.asset.classification.brand': 'Brand',
        'detail.asset.audit.file_asset_governance_updated': 'Governance updated',
      })[key] || key,
  }),
}));

vi.mock('@/components/InlineRename', () => ({
  default: () => null,
}));

vi.mock('@/features/ContentManager/components/SourceSetTree/treeState', () => ({
  clearTreeFolderCache: vi.fn(),
}));

vi.mock('@/features/ContentManager/utils/resolveResourceKind', () => ({
  resolveResourceKind: ({ fileType, name }: any) => ({
    baseName: name.replace(/\.[^.]+$/, ''),
    extension: name.includes('.') ? name.slice(name.lastIndexOf('.')) : '',
    isFolder: fileType === 'custom/folder',
    isMarkdown: false,
    isPage: false,
  }),
}));

vi.mock('@/routes/(main)/content/features/DndContextWrapper', () => ({
  getTransparentDragImage: vi.fn(),
  useDragActive: () => false,
  useDragState: () => ({
    setCurrentDrag: vi.fn(),
  }),
}));

vi.mock('@/services/document', () => ({
  documentService: {
    getDocumentById: vi.fn(),
  },
}));

vi.mock('@/store/file', () => ({
  useFileStore: vi.fn((selector: any) =>
    selector({
      parseFilesToChunks: vi.fn(),
      refreshFileList: vi.fn(),
      updateContentItem: vi.fn(),
    }),
  ),
}));

vi.mock('../../hooks/useFileItemClick', () => ({
  useFileItemClick: () => vi.fn(),
}));

vi.mock('../../ItemDropdown/DropdownMenu', () => ({
  default: () => <div>dropdown</div>,
}));

vi.mock('../../ItemDropdown/useFileItemDropdown', () => ({
  useFileItemDropdown: () => ({
    menuItems: [],
  }),
}));

vi.mock('../../items', () => ({
  getInlineUploadStatusKey: () => null,
}));

vi.mock('./DefaultFileItem', () => ({
  default: ({ name }: any) => <div>{name}</div>,
}));

vi.mock('./ImageFileItem', () => ({
  default: () => <div>image-file</div>,
}));

vi.mock('./MarkdownFileItem', () => ({
  default: () => <div>markdown-file</div>,
}));

vi.mock('./NoteFileItem', () => ({
  default: () => <div>note-file</div>,
}));

describe('MasonryFileItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        disconnect() {}
        observe() {}
        unobserve() {}
      },
    );
  });

  it('renders compact governance badges for masonry cards', () => {
    render(
      <MasonryFileItem
        assetClassification={FileAssetClassification.Brand}
        assetLatestGovernanceAuditAction="file_asset_governance_updated"
        assetLatestGovernanceAuditActorDisplayName="Legal Team"
        assetLatestGovernanceAuditAfter={{ usagePolicy: FileAssetUsagePolicy.Restricted }}
        assetLatestGovernanceAuditAt={new Date('2026-04-05T10:00:00.000Z')}
        assetLatestGovernanceAuditBefore={{ usagePolicy: FileAssetUsagePolicy.Internal }}
        assetLatestGovernanceAuditChangedFields={['usagePolicy']}
        assetReviewStatus={FileAssetReviewStatus.Archived}
        assetUsagePolicy={FileAssetUsagePolicy.Restricted}
        assetVersionLabel="v2"
        chunkCount={3}
        chunkingError={null}
        chunkingStatus={null}
        createdAt={new Date('2026-04-05T00:00:00.000Z')}
        embeddingError={null}
        embeddingStatus={null}
        fileType="application/pdf"
        finishEmbedding={false}
        id="file-1"
        metadata={null}
        name="Brand Guide.pdf"
        selected={false}
        size={1024}
        sourceType="file"
        updatedAt={new Date('2026-04-05T00:00:00.000Z')}
        url="/f/file-1"
        onSelectedChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Brand Guide.pdf')).toBeInTheDocument();
    expect(screen.getByText('Archived')).toBeInTheDocument();
    expect(screen.getByText('Restricted')).toBeInTheDocument();
    expect(screen.getByText('+2')).toHaveAttribute('title', 'v2 · Brand');
    expect(screen.getByText('Governance updated · Usage policy: Restricted')).toHaveAttribute(
      'title',
      'Governance updated · Legal Team · 2026-04-05 18:00 · Usage policy: Internal -> Restricted',
    );
  });

  it('renders rendition summaries when governance badges do not crowd the card', () => {
    render(
      <MasonryFileItem
        assetClassification={FileAssetClassification.General}
        assetPrimaryRenditionKind={FileAssetRenditionKind.Preview}
        assetPrimaryRenditionLabel="Homepage"
        assetRenditionCount={2}
        assetReviewStatus={FileAssetReviewStatus.Approved}
        assetUsagePolicy={FileAssetUsagePolicy.Internal}
        chunkCount={3}
        chunkingError={null}
        chunkingStatus={null}
        createdAt={new Date('2026-04-05T00:00:00.000Z')}
        embeddingError={null}
        embeddingStatus={null}
        fileType="application/pdf"
        finishEmbedding={false}
        id="file-2"
        metadata={null}
        name="Landing Preview.pdf"
        selected={false}
        size={1024}
        sourceType="file"
        updatedAt={new Date('2026-04-05T00:00:00.000Z')}
        url="/f/file-2"
        onSelectedChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Preview · +1')).toHaveAttribute('title', 'Preview · Homepage · +1');
  });
});
