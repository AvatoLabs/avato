/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { formatDateTime } from '@/utils/format';

import FileDetail from './FileDetail';

const mockMessageSuccess = vi.hoisted(() => vi.fn());
const mockMessageError = vi.hoisted(() => vi.fn());
const mockApproveFileAsset = vi.hoisted(() => vi.fn());
const mockArchiveFileAsset = vi.hoisted(() => vi.fn());
const mockUpdateFileAssetGovernance = vi.hoisted(() => vi.fn());
const mockUnsavedChangesGuard = vi.hoisted(() => vi.fn());
const mockUseClientDataSWR = vi.hoisted(() => vi.fn());
const mockSWRMutate = vi.hoisted(() => vi.fn());

let mockFileAssetState: { data?: any; isLoading?: boolean } = {};

vi.mock('@lobehub/ui', () => ({
  ActionIcon: vi.fn(({ onClick, title }) => (
    <button aria-label={title} type="button" onClick={onClick} />
  )),
  Block: vi.fn(({ children }: any) => <section>{children}</section>),
  Button: vi.fn(({ children, disabled, loading, onClick }) => (
    <button disabled={disabled || loading} type="button" onClick={onClick}>
      {children}
    </button>
  )),
  Flexbox: vi.fn(({ children }) => <div>{children}</div>),
  Icon: vi.fn(() => <span data-testid="icon" />),
  Tag: vi.fn(({ children }) => <span>{children}</span>),
  Text: vi.fn(({ children }) => <span>{children}</span>),
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
        <option disabled={option.disabled} key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )),
}));

vi.mock('antd-style', () => ({
  createStyles: () => () => ({
    styles: new Proxy(
      {},
      {
        get: (_, key) => String(key),
      },
    ),
  }),
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

vi.mock('@/features/EditorCanvas/UnsavedChangesGuard', () => ({
  default: (props: any) => {
    mockUnsavedChangesGuard(props);
    return <div data-testid="unsaved-guard" />;
  },
}));

vi.mock('@/libs/swr', () => ({
  mutate: mockSWRMutate,
  useClientDataSWR: mockUseClientDataSWR,
}));

vi.mock('@/services/file', () => ({
  fileService: {
    getFileAssetAuditTrail: vi.fn(),
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
  sourceSetIds: [],
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
        governanceAuditTrail: [],
        governanceAuditTrailHasMore: false,
        latestGovernanceAudit: null,
      },
      isLoading: false,
    };
    mockMessageError.mockReset();
    mockMessageSuccess.mockReset();
    mockApproveFileAsset.mockReset();
    mockArchiveFileAsset.mockReset();
    mockUpdateFileAssetGovernance.mockReset();
    mockSWRMutate.mockReset();
    mockUnsavedChangesGuard.mockReset();
    mockUseClientDataSWR.mockImplementation(() => ({
      data: undefined,
      isLoading: false,
      isValidating: false,
    }));
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
        governanceAuditTrail: [
          {
            action: 'file_asset_governance_updated',
            after: {
              classification: 'legal',
              rightsOwner: 'Legal Team',
            },
            actorDisplayName: 'Ops Team',
            actorId: 'user_ops',
            before: {
              classification: 'general',
              rightsOwner: null,
            },
            changedFields: ['classification', 'rightsOwner'],
            createdAt: new Date('2026-04-05T10:30:00.000Z'),
          },
          {
            action: 'file_asset_approved',
            actorDisplayName: 'Arthur',
            actorId: 'user_admin',
            changedFields: ['reviewStatus'],
            createdAt: new Date('2026-04-04T08:00:00.000Z'),
          },
        ],
        governanceAuditTrailHasMore: false,
        latestGovernanceAudit: {
          action: 'file_asset_governance_updated',
          after: {
            classification: 'legal',
            rightsOwner: 'Legal Team',
          },
          actorDisplayName: 'Ops Team',
          actorId: 'user_ops',
          before: {
            classification: 'general',
            rightsOwner: null,
          },
          changedFields: ['classification', 'rightsOwner'],
          createdAt: new Date('2026-04-05T10:30:00.000Z'),
        },
      },
      isLoading: false,
    };

    render(<FileDetail {...baseProps} />);

    expect(screen.queryByRole('button', { name: 'detail.asset.save' })).not.toBeInTheDocument();
    expect(screen.getAllByText('detail.asset.classification.legal').length).toBeGreaterThan(0);
    expect(screen.getAllByText('detail.asset.reviewStatus.approved').length).toBeGreaterThan(0);
    expect(screen.getAllByText('detail.asset.usagePolicy.restricted').length).toBeGreaterThan(0);
    expect(screen.getByText(formatDateTime(baseProps.createdAt))).toBeInTheDocument();
    expect(screen.getAllByText(formatDateTime(baseProps.updatedAt))).toHaveLength(1);
    expect(screen.getAllByText('Legal Team').length).toBeGreaterThan(0);
    expect(screen.getByText('v2')).toBeInTheDocument();
    expect(screen.getByText('Brand System 2026')).toBeInTheDocument();
    expect(screen.getByText('detail.asset.rendition.preview · Homepage')).toBeInTheDocument();
    expect(screen.getByText('detail.asset.rendition.web')).toBeInTheDocument();
    expect(screen.getByText('detail.asset.audit.recent')).toBeInTheDocument();
    expect(screen.getByText('detail.asset.audit.latestBadge')).toBeInTheDocument();
    expect(
      screen.getByText('detail.asset.audit.file_asset_governance_updated'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(`Ops Team · ${formatDateTime(new Date('2026-04-05T10:30:00.000Z'))}`),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'detail.asset.classification.label: detail.asset.classification.general -> detail.asset.classification.legal',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText('detail.asset.rightsOwner.label: detail.asset.none -> Legal Team'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('detail.asset.audit.changedFields: detail.asset.reviewStatus.label'),
    ).toBeInTheDocument();
    expect(screen.getByText('detail.asset.audit.file_asset_approved')).toBeInTheDocument();
    expect(
      screen.getByText(`Arthur · ${formatDateTime(new Date('2026-04-04T08:00:00.000Z'))}`),
    ).toBeInTheDocument();
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
        governanceAuditTrailHasMore: false,
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
        reviewStatus: 'draft',
        rightsOwner: 'Brand Team',
        usagePolicy: 'restricted',
      });
    });

    expect(mockMessageSuccess).toHaveBeenCalledWith('detail.asset.saveSuccess');
  });

  it('keeps the current review status visible for editors without promote/archive permissions', () => {
    mockFileAssetState = {
      data: {
        capabilities: { canApprove: false, canArchive: false, canEditGovernance: true },
        item: {
          classification: 'general',
          fileId: 'file-1',
          metadata: {
            renditions: [{ kind: 'preview' }],
            version: { label: 'v1' },
          },
          reviewStatus: 'approved',
          rightsOwner: 'Ops Team',
          spaceId: 'spc_team',
          usagePolicy: 'internal',
        },
        governanceAuditTrailHasMore: false,
      },
      isLoading: false,
    };

    render(<FileDetail {...baseProps} />);

    const reviewStatusSelect = screen.getByLabelText(
      'detail.asset.reviewStatus.label',
    ) as HTMLSelectElement;
    const approvedOption = screen.getByRole('option', {
      name: 'detail.asset.reviewStatus.approved',
    }) as HTMLOptionElement;

    expect(reviewStatusSelect).toHaveValue('approved');
    expect(approvedOption.disabled).toBe(true);
  });

  it('enables the unsaved guard after governance fields change', () => {
    render(<FileDetail {...baseProps} />);

    expect(screen.getByText('detail.asset.status.saved')).toBeInTheDocument();
    expect(mockUnsavedChangesGuard).toHaveBeenLastCalledWith(
      expect.objectContaining({
        isDirty: false,
        message: 'form.unsavedWarning',
        title: 'form.unsavedChanges',
      }),
    );

    fireEvent.change(screen.getByLabelText('detail.asset.version.label'), {
      target: { value: 'v2' },
    });

    expect(screen.getByText('detail.asset.status.unsaved')).toBeInTheDocument();
    expect(mockUnsavedChangesGuard).toHaveBeenLastCalledWith(
      expect.objectContaining({
        isDirty: true,
        message: 'form.unsavedWarning',
        title: 'form.unsavedChanges',
      }),
    );
  });

  it('resets draft governance changes back to the latest saved state', () => {
    render(<FileDetail {...baseProps} />);

    const versionInput = screen.getByLabelText('detail.asset.version.label');

    fireEvent.change(versionInput, {
      target: { value: 'v2' },
    });

    expect(screen.getByText('detail.asset.status.unsaved')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'detail.asset.reset' }));

    expect(versionInput).toHaveValue('v1');
    expect(screen.getByText('detail.asset.status.saved')).toBeInTheDocument();
  });

  it('keeps local governance edits when fetched asset data refreshes mid-edit', () => {
    const { rerender } = render(<FileDetail {...baseProps} />);

    fireEvent.change(screen.getByLabelText('detail.asset.version.label'), {
      target: { value: 'v2-local' },
    });

    mockFileAssetState = {
      data: {
        ...mockFileAssetState.data,
        item: {
          ...mockFileAssetState.data.item,
          metadata: {
            ...mockFileAssetState.data.item.metadata,
            version: { label: 'v3-remote' },
          },
          rightsOwner: 'Remote Owner',
        },
      },
      isLoading: false,
    };

    rerender(<FileDetail {...baseProps} />);

    expect(screen.getByLabelText('detail.asset.version.label')).toHaveValue('v2-local');
    expect(screen.getByLabelText('detail.asset.rightsOwner.label')).toHaveValue('');
    expect(screen.getByText('detail.asset.status.unsaved')).toBeInTheDocument();
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
        governanceAuditTrailHasMore: false,
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

  it('allows admins to update review status from the governance form', async () => {
    mockFileAssetState = {
      data: {
        capabilities: { canApprove: true, canArchive: true, canEditGovernance: true },
        item: {
          classification: 'general',
          fileId: 'file-1',
          metadata: {
            renditions: [{ kind: 'preview' }],
            version: { label: 'v1' },
          },
          reviewStatus: 'draft',
          rightsOwner: 'Ops Team',
          spaceId: 'spc_team',
          usagePolicy: 'internal',
        },
        governanceAuditTrailHasMore: false,
      },
      isLoading: false,
    };

    mockUpdateFileAssetGovernance.mockResolvedValue({
      capabilities: { canApprove: true, canArchive: true, canEditGovernance: true },
      item: {
        classification: 'general',
        fileId: 'file-1',
        metadata: {
          renditions: [{ kind: 'preview' }],
          version: { label: 'v1' },
        },
        reviewStatus: 'archived',
        rightsOwner: 'Ops Team',
        spaceId: 'spc_team',
        usagePolicy: 'internal',
      },
    });

    render(<FileDetail {...baseProps} />);

    fireEvent.change(screen.getByLabelText('detail.asset.reviewStatus.label'), {
      target: { value: 'archived' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'detail.asset.save' }));

    await waitFor(() => {
      expect(mockUpdateFileAssetGovernance).toHaveBeenCalledWith('file-1', {
        classification: 'general',
        metadata: {
          renditions: [{ kind: 'preview' }],
          version: { label: 'v1' },
        },
        reviewStatus: 'archived',
        rightsOwner: 'Ops Team',
        usagePolicy: 'internal',
      });
    });
  });

  it('loads more governance activity entries on demand', async () => {
    mockFileAssetState = {
      data: {
        capabilities: { canApprove: false, canArchive: false, canEditGovernance: false },
        item: {
          classification: 'legal',
          fileId: 'file-1',
          reviewStatus: 'approved',
          rightsOwner: 'Legal Team',
          spaceId: 'spc_team',
          usagePolicy: 'restricted',
        },
        governanceAuditTrail: [
          {
            action: 'file_asset_governance_updated',
            actorDisplayName: 'Ops Team',
            actorId: 'user_ops',
            changedFields: ['classification'],
            createdAt: new Date('2026-04-05T10:30:00.000Z'),
          },
        ],
        governanceAuditTrailHasMore: true,
        latestGovernanceAudit: {
          action: 'file_asset_governance_updated',
          actorDisplayName: 'Ops Team',
          actorId: 'user_ops',
          changedFields: ['classification'],
          createdAt: new Date('2026-04-05T10:30:00.000Z'),
        },
      },
      isLoading: false,
    };

    mockUseClientDataSWR.mockImplementation((key: any) => {
      if (!key) {
        return {
          data: undefined,
          isLoading: false,
          isValidating: false,
        };
      }

      return {
        data: {
          hasMore: false,
          items: [
            {
              action: 'file_asset_governance_updated',
              actorDisplayName: 'Ops Team',
              actorId: 'user_ops',
              changedFields: ['classification'],
              createdAt: new Date('2026-04-05T10:30:00.000Z'),
            },
            {
              action: 'file_asset_approved',
              actorDisplayName: 'Arthur',
              actorId: 'user_admin',
              changedFields: ['reviewStatus'],
              createdAt: new Date('2026-04-04T08:00:00.000Z'),
            },
          ],
        },
        isLoading: false,
        isValidating: false,
      };
    });

    render(<FileDetail {...baseProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'loadMore' }));

    await waitFor(() => {
      expect(screen.getByText('detail.asset.audit.file_asset_approved')).toBeInTheDocument();
    });
  });
});
