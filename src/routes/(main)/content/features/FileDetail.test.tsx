/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import FileDetail from './FileDetail';

const mockMessageSuccess = vi.hoisted(() => vi.fn());
const mockMessageError = vi.hoisted(() => vi.fn());
const mockApproveFileAsset = vi.hoisted(() => vi.fn());
const mockArchiveFileAsset = vi.hoisted(() => vi.fn());
const mockUpdateFileAssetGovernance = vi.hoisted(() => vi.fn());

let mockFileAssetState: { data?: any; isLoading?: boolean } = {};

vi.mock('@lobehub/ui', () => ({
  ActionIcon: vi.fn(({ onClick, title }) => (
    <button aria-label={title} type="button" onClick={onClick} />
  )),
  Button: vi.fn(({ children, disabled, loading, onClick }) => (
    <button disabled={disabled || loading} type="button" onClick={onClick}>
      {children}
    </button>
  )),
  Flexbox: vi.fn(({ children }) => <div>{children}</div>),
  Icon: vi.fn(() => <span data-testid="icon" />),
  Tag: vi.fn(({ children }) => <span>{children}</span>),
}));

vi.mock('antd', () => ({
  Descriptions: vi.fn(({ extra, items, title }) => (
    <section>
      {title ? <h3>{title}</h3> : null}
      {extra}
      {items?.map((item: any) => (
        <div key={item.key}>
          <span>{item.label}</span>
          <div>{item.children}</div>
        </div>
      ))}
    </section>
  )),
  Divider: vi.fn(() => <hr />),
  Input: vi.fn(({ allowClear: _allowClear, onChange, placeholder, value, ...rest }) => (
    <input {...rest} placeholder={placeholder} value={value ?? ''} onChange={onChange} />
  )),
  Select: vi.fn(({ mode, onChange, options, value, ...rest }) => (
    <select
      {...rest}
      multiple={mode === 'multiple'}
      value={value}
      onChange={(event) => {
        if (mode === 'multiple') {
          const rawValue = (event.target as HTMLSelectElement & { value: string | string[] }).value;
          if (Array.isArray(rawValue)) {
            onChange?.(rawValue);
            return;
          }

          onChange?.(Array.from(event.currentTarget.selectedOptions).map((option) => option.value));
          return;
        }

        onChange?.(event.target.value);
      }}
    >
      {options?.map((option: any) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/components/AntdStaticMethods', () => ({
  message: {
    error: mockMessageError,
    success: mockMessageSuccess,
  },
}));

vi.mock('@/config/contentIcons', () => ({
  RESOURCE_ENTRY_ICONS: {
    chunk: 'chunk',
    download: 'download',
  },
}));

vi.mock('@/store/file', () => ({
  useFileStore: vi.fn((selector: any) =>
    selector({
      approveFileAsset: mockApproveFileAsset,
      archiveFileAsset: mockArchiveFileAsset,
      updateFileAssetGovernance: mockUpdateFileAssetGovernance,
      useFetchFileAsset: () => mockFileAssetState,
    }),
  ),
}));

vi.mock('@/utils/client/downloadFile', () => ({
  downloadFile: vi.fn(),
}));

const baseProps = {
  chunkCount: 3,
  chunkingError: null,
  chunkingStatus: null,
  createdAt: new Date('2026-04-04T10:00:00.000Z'),
  embeddingError: null,
  embeddingStatus: null,
  fileType: 'text/markdown',
  finishEmbedding: false,
  id: 'file-1',
  name: 'Brand Spec.md',
  size: 1024,
  sourceType: 'file',
  spaceId: 'spc_team',
  updatedAt: new Date('2026-04-04T12:00:00.000Z'),
  url: '/f/file-1',
};

describe('FileDetail', () => {
  beforeEach(() => {
    mockFileAssetState = {
      data: {
        capabilities: { canApprove: true, canArchive: true, canEditGovernance: true },
        item: {
          classification: 'general',
          fileId: 'file-1',
          metadata: {
            legacyAuditTrail: { importedBy: 'legacy-script' },
            renditions: [{ kind: 'preview' }],
            version: { label: 'v1' },
          },
          reviewStatus: 'draft',
          rightsOwner: null,
          spaceId: 'spc_team',
          usagePolicy: 'internal',
        },
      },
      isLoading: false,
    };
    mockMessageError.mockReset();
    mockMessageSuccess.mockReset();
    mockApproveFileAsset.mockReset();
    mockArchiveFileAsset.mockReset();
    mockUpdateFileAssetGovernance.mockReset();
  });

  it('renders asset governance as read-only for viewers', () => {
    mockFileAssetState = {
      data: {
        capabilities: { canApprove: false, canArchive: false, canEditGovernance: false },
        item: {
          classification: 'legal',
          fileId: 'file-1',
          metadata: {
            renditions: [{ kind: 'preview', label: 'Homepage' }, { kind: 'web' }],
            version: { label: 'v2', variantOf: 'Brand System 2026' },
          },
          reviewStatus: 'approved',
          rightsOwner: 'Legal Team',
          spaceId: 'spc_team',
          usagePolicy: 'restricted',
        },
      },
      isLoading: false,
    };

    render(<FileDetail {...baseProps} />);

    expect(screen.queryByRole('button', { name: 'detail.asset.save' })).not.toBeInTheDocument();
    expect(screen.getByText('detail.asset.classification.legal')).toBeInTheDocument();
    expect(screen.getByText('detail.asset.reviewStatus.approved')).toBeInTheDocument();
    expect(screen.getByText('detail.asset.usagePolicy.restricted')).toBeInTheDocument();
    expect(screen.getByText('Legal Team')).toBeInTheDocument();
    expect(screen.getByText('v2')).toBeInTheDocument();
    expect(screen.getByText('Brand System 2026')).toBeInTheDocument();
    expect(screen.getByText('detail.asset.rendition.preview · Homepage')).toBeInTheDocument();
    expect(screen.getByText('detail.asset.rendition.web')).toBeInTheDocument();
  });

  it('allows editors to update asset governance fields', async () => {
    mockFileAssetState = {
      data: {
        capabilities: { canApprove: false, canArchive: false, canEditGovernance: true },
        item: {
          classification: 'general',
          fileId: 'file-1',
          metadata: {
            legacyAuditTrail: { importedBy: 'legacy-script' },
            renditions: [{ kind: 'preview' }],
            version: { label: 'v1' },
          },
          reviewStatus: 'draft',
          rightsOwner: null,
          spaceId: 'spc_team',
          usagePolicy: 'internal',
        },
      },
      isLoading: false,
    };

    mockUpdateFileAssetGovernance.mockResolvedValue({
      capabilities: { canApprove: false, canArchive: false, canEditGovernance: true },
      item: {
        classification: 'brand',
        fileId: 'file-1',
        metadata: {
          legacyAuditTrail: { importedBy: 'legacy-script' },
          version: { label: 'v2', variantOf: 'Brand System 2026' },
        },
        reviewStatus: 'draft',
        rightsOwner: 'Brand Team',
        spaceId: 'spc_team',
        usagePolicy: 'restricted',
      },
    });

    render(<FileDetail {...baseProps} />);

    fireEvent.change(screen.getByLabelText('detail.asset.classification.label'), {
      target: { value: 'brand' },
    });
    fireEvent.change(screen.getByLabelText('detail.asset.usagePolicy.label'), {
      target: { value: 'restricted' },
    });
    fireEvent.change(screen.getByLabelText('detail.asset.rightsOwner.label'), {
      target: { value: 'Brand Team' },
    });
    fireEvent.change(screen.getByLabelText('detail.asset.version.label'), {
      target: { value: 'v2' },
    });
    fireEvent.change(screen.getByLabelText('detail.asset.version.variantOfLabel'), {
      target: { value: 'Brand System 2026' },
    });
    fireEvent.change(screen.getByPlaceholderText('detail.asset.rendition.labelPlaceholder'), {
      target: { value: 'Homepage' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'detail.asset.save' }));

    await waitFor(() => {
      expect(mockUpdateFileAssetGovernance).toHaveBeenCalledWith('file-1', {
        classification: 'brand',
        metadata: {
          legacyAuditTrail: { importedBy: 'legacy-script' },
          renditions: [{ kind: 'preview', label: 'Homepage' }],
          version: { label: 'v2', variantOf: 'Brand System 2026' },
        },
        rightsOwner: 'Brand Team',
        usagePolicy: 'restricted',
      });
    });

    expect(mockMessageSuccess).toHaveBeenCalledWith('detail.asset.saveSuccess');
  });

  it('allows admins to approve asset governance', async () => {
    mockFileAssetState = {
      data: {
        capabilities: { canApprove: true, canArchive: true, canEditGovernance: true },
        item: {
          classification: 'general',
          fileId: 'file-1',
          reviewStatus: 'draft',
          rightsOwner: null,
          spaceId: 'spc_team',
          usagePolicy: 'internal',
        },
      },
      isLoading: false,
    };

    mockApproveFileAsset.mockResolvedValue({
      capabilities: { canApprove: true, canArchive: true, canEditGovernance: true },
      item: {
        classification: 'general',
        fileId: 'file-1',
        reviewStatus: 'approved',
        rightsOwner: null,
        spaceId: 'spc_team',
        usagePolicy: 'internal',
      },
    });

    render(<FileDetail {...baseProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'detail.asset.approve' }));

    await waitFor(() => {
      expect(mockApproveFileAsset).toHaveBeenCalledWith('file-1');
    });
  });
});
