/**
 * @vitest-environment happy-dom
 */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  FileAssetClassification,
  FileAssetReviewStatus,
  FileAssetUsagePolicy,
} from '@/types/files';

import FileListItem from './index';

vi.mock('dayjs', () => {
  const dayjs = () => ({
    diff: () => 0,
    format: () => '2026-04-05',
    fromNow: () => 'just now',
  });

  return {
    default: dayjs,
  };
});

vi.mock('@/utils/format', () => ({
  formatDate: () => '2026-04-05',
  formatDateTime: () => '2026-04-05 18:00',
  formatSize: () => '1 KB',
}));

vi.mock('antd', () => ({
  App: {
    useApp: () => ({
      message: {
        error: vi.fn(),
        success: vi.fn(),
      },
    }),
  },
  Input: (props: any) => <input {...props} />,
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
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  Center: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Checkbox: ({ checked, ...props }: any) => <input readOnly checked={checked} type="checkbox" {...props} />,
  ContextMenuTrigger: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Flexbox: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Icon: ({ icon }: any) => <span>{String(icon)}</span>,
  stopPropagation: vi.fn(),
  Tag: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: any) =>
      ({
        'detail.asset.audit.file_asset_governance_updated': 'Governance updated',
        'detail.asset.classification.brand': 'Brand',
        'detail.asset.none': 'None',
        'detail.asset.rightsOwner.label': 'Rights owner',
        'detail.asset.reviewStatus.archived': 'Archived',
        'detail.asset.usagePolicy.restricted': 'Restricted',
        'FileManager.actions.chunking': 'Chunking',
        'file:pageList.untitled': 'Untitled',
      })[key] || options?.defaultValue || key,
  }),
}));

vi.mock('@/components/FileIcon', () => ({
  default: () => <div>file-icon</div>,
}));

vi.mock('@/config/contentIcons', () => ({
  RESOURCE_ENTRY_ICONS: {
    chunk: 'chunk',
  },
}));

vi.mock('@/features/ContentManager/components/SourceSetTree/treeState', () => ({
  clearTreeFolderCache: vi.fn(),
}));

vi.mock('@/features/ContentManager/utils/resolveResourceKind', () => ({
  resolveResourceKind: ({ fileType, name }: any) => ({
    baseName: name.replace(/\.[^.]+$/, ''),
    emoji: undefined,
    extension: name.includes('.') ? name.slice(name.lastIndexOf('.')) : '',
    isFolder: fileType === 'custom/folder',
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

vi.mock('@/routes/(main)/content/features/store', () => ({
  useContentManagerStore: vi.fn((selector: any) =>
    selector({
      setPendingRenameItemId: vi.fn(),
      sourceSetId: undefined,
    }),
  ),
}));

vi.mock('@/store/file', () => ({
  fileManagerSelectors: {
    isCreatingFileParseTask: () => () => false,
  },
  useFileStore: vi.fn((selector: any) =>
    selector({
      parseFilesToChunks: vi.fn(),
      refreshFileList: vi.fn(),
      updateContentItem: vi.fn(),
    }),
  ),
}));

vi.mock('@/utils/isChunkingUnsupported', () => ({
  isChunkingUnsupported: () => false,
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

vi.mock('./ChunkTag', () => ({
  default: () => <div>chunk-tag</div>,
}));

vi.mock('./TruncatedFileName', () => ({
  default: ({ name }: any) => <span title={name}>{name}</span>,
}));

describe('FileListItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders governance activity as secondary row metadata in list view', () => {
    render(
      <FileListItem
        assetClassification={FileAssetClassification.Brand}
        assetLatestGovernanceAuditAction="file_asset_governance_updated"
        assetLatestGovernanceAuditActorDisplayName="Legal Team"
        assetLatestGovernanceAuditAfter={{ rightsOwner: 'Legal Team' }}
        assetLatestGovernanceAuditAt={new Date('2026-04-05T10:00:00.000Z')}
        assetLatestGovernanceAuditBefore={{ rightsOwner: null }}
        assetLatestGovernanceAuditChangedFields={['rightsOwner']}
        assetReviewStatus={FileAssetReviewStatus.Archived}
        assetUsagePolicy={FileAssetUsagePolicy.Restricted}
        chunkCount={null}
        chunkingError={null}
        columnWidths={{ date: 160, name: 400, size: 140 }}
        createdAt={new Date('2026-04-05T00:00:00.000Z')}
        embeddingError={null}
        embeddingStatus={null}
        fileId="file-1"
        fileType="application/pdf"
        finishEmbedding={false}
        id="file-1"
        index={0}
        isAnyRowHovered={false}
        metadata={null}
        name="Brand Guide.pdf"
        onHoverChange={vi.fn()}
        onSelectedChange={vi.fn()}
        pendingRenameItemId={null}
        selected={false}
        size={1024}
        sourceType="file"
        updatedAt={new Date('2026-04-05T00:00:00.000Z')}
        uploadStatus={undefined}
        url="/f/file-1"
      />,
    );

    expect(screen.getByText('Brand Guide.pdf')).toBeInTheDocument();
    expect(screen.getByText('Archived')).toBeInTheDocument();
    expect(screen.getByText('Restricted')).toBeInTheDocument();
    expect(screen.getByText('Brand')).toBeInTheDocument();
    expect(screen.getByText('Governance updated · Rights owner: Legal Team')).toHaveAttribute(
      'title',
      'Governance updated · Legal Team · 2026-04-05 18:00 · Rights owner: None -> Legal Team',
    );
  });
});
