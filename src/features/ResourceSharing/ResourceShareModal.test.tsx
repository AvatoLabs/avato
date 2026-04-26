/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ResourceShareModal from './ResourceShareModal';

const copyToClipboardMock = vi.hoisted(() => vi.fn());
const createContentShareLinkMutate = vi.hoisted(() => vi.fn());
const disableContentShareLinkMutate = vi.hoisted(() => vi.fn());
const grantContentPermissionMutate = vi.hoisted(() => vi.fn());
const listContentPermissionsQuery = vi.hoisted(() => vi.fn());
const listContentShareLinksQuery = vi.hoisted(() => vi.fn());
const explainContentAccessQuery = vi.hoisted(() => vi.fn());
const revokeContentPermissionMutate = vi.hoisted(() => vi.fn());
const searchUsersQuery = vi.hoisted(() => vi.fn());
const messageApi = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
}));

const swrState = vi.hoisted(() => ({
  access: {
    authzEpoch: 3,
    matchedBy: 'content_permission',
    reason: 'owner',
  } as any,
  links: [
    {
      createdAt: new Date('2026-04-06T04:00:00.000Z'),
      disabledAt: null,
      expiresAt: new Date('2026-04-13T04:00:00.000Z'),
      id: 'link-1',
    },
  ] as any[],
  permissions: [
    {
      canReshare: true,
      expiresAt: null,
      id: 'perm-1',
      inheritsToChildren: true,
      role: 'editor',
      subjectAvatar: null,
      subjectId: 'user-1',
      subjectName: 'Ada Lovelace',
      subjectUsername: 'ada',
    },
  ] as any[],
  searchedMembers: [] as any[],
}));

const mutateSpies = vi.hoisted(() => ({
  access: vi.fn().mockResolvedValue(undefined),
  links: vi.fn().mockResolvedValue(undefined),
  permissions: vi.fn().mockResolvedValue(undefined),
  search: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@lobehub/ui', () => ({
  Avatar: ({ alt }: any) => <div>{alt}</div>,
  Block: ({ children }: any) => <section>{children}</section>,
  Button: ({ children, disabled, loading, onClick, type }: any) => (
    <button data-type={type} disabled={disabled || loading} type={'button'} onClick={onClick}>
      {children}
    </button>
  ),
  Collapse: ({ items }: any) => (
    <div>
      {items.map((item: any) => (
        <section key={item.key}>
          <div>{item.label}</div>
          <div>{item.children}</div>
        </section>
      ))}
    </div>
  ),
  copyToClipboard: copyToClipboardMock,
  Flexbox: ({ as, children, onSubmit, ...props }: any) => {
    const Component = as || 'div';
    return (
      <Component onSubmit={onSubmit} {...props}>
        {children}
      </Component>
    );
  },
  Input: ({ onChange, placeholder, type, value }: any) => (
    <input placeholder={placeholder} type={type} value={value ?? ''} onChange={onChange} />
  ),
  SearchBar: ({ onInputChange, onSearch, placeholder, value }: any) => (
    <input
      aria-label={placeholder}
      placeholder={placeholder}
      value={value ?? ''}
      onChange={(event) => onInputChange?.(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onSearch?.((event.target as HTMLInputElement).value);
      }}
    />
  ),
  Select: ({ onChange, options, value }: any) => (
    <select value={value} onChange={(event) => onChange?.(event.target.value)}>
      {options?.map((option: any) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
  Tag: ({ children }: any) => <span>{children}</span>,
  Text: ({ as, children }: any) => {
    const Component = as || 'span';
    return <Component>{children}</Component>;
  },
}));

vi.mock('antd', () => ({
  Alert: ({ message }: any) => <div>{message}</div>,
  App: {
    useApp: () => ({ message: messageApi }),
  },
  Switch: ({ checked, disabled, onChange }: any) => (
    <input
      checked={checked}
      disabled={disabled}
      type={'checkbox'}
      onChange={(event) => onChange?.(event.target.checked)}
    />
  ),
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

vi.mock('ahooks', () => ({
  useDebounce: (value: string) => value,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, any>) =>
      (
        ({
          'share.accessSummary': `Access ${options?.reason} ${options?.authzEpoch}`,
          'share.accessUnknown': 'Unknown access',
          'share.links.copy': 'Copy Link',
          'share.links.copyDirectDownload': 'Copy Direct Download',
          'share.links.create': 'Create Link',
          'share.links.created': 'Link created',
          'share.links.createdAt': `Created ${options?.date}`,
          'share.links.currentTitle': 'Active Links',
          'share.links.directDownloadHint': 'Direct download available',
          'share.links.disable': 'Disable',
          'share.links.disabled': 'Disabled',
          'share.links.disabledSuccess': 'Link disabled',
          'share.links.empty': 'No active links',
          'share.links.expiry.1': '1 day',
          'share.links.expiry.7': '7 days',
          'share.links.expiry.30': '30 days',
          'share.links.expiresAt': `Expires ${options?.date}`,
          'share.links.latest': 'Latest Link',
          'share.links.note': 'Anyone with the link can view this resource.',
          'share.links.passwordPlaceholder': 'Password',
          'share.links.subtitle': 'Create time-limited share links.',
          'share.links.title': 'Share Links',
          'share.loading': 'Loading',
          'share.manage.actionFailed': 'Action failed',
          'share.manage.retry': 'Retry',
          'share.members.add': 'Add Member',
          'share.members.currentTitle': 'People with access',
          'share.members.empty': 'No people yet',
          'share.members.expiresAtValue': `Expires ${options?.date}`,
          'share.members.filterPlaceholder': 'Filter people',
          'share.members.inheritsDisabled': 'No inherit',
          'share.members.inheritsEnabled': 'Inherits',
          'share.members.noExpiry': 'No expiry',
          'share.members.revoked': 'Access revoked',
          'share.members.searchHint': 'Search by username to grant access.',
          'share.members.searchResultsTitle': 'Search Results',
          'share.members.searching': 'Searching',
          'share.members.select': 'Select',
          'share.members.selected': 'Selected',
          'share.members.subtitle': 'Grant direct access to specific members.',
          'share.members.title': 'Share with Members',
          'share.members.usernamePlaceholder': 'Search username',
          'share.roles.editor': 'Editor',
          'share.roles.viewer': 'Viewer',
          'space.roles.owner': 'Owner',
        }) as Record<string, string>
      )[key] || key,
  }),
}));

vi.mock('swr', () => ({
  default: (key: any) => {
    if (!key)
      return { data: undefined, error: undefined, isLoading: false, mutate: mutateSpies.search };

    const cacheKey = Array.isArray(key) ? key[0] : key;

    switch (cacheKey) {
      case 'resource-share-permissions': {
        return {
          data: swrState.permissions,
          error: undefined,
          isLoading: false,
          mutate: mutateSpies.permissions,
        };
      }
      case 'resource-share-links': {
        return {
          data: swrState.links,
          error: undefined,
          isLoading: false,
          mutate: mutateSpies.links,
        };
      }
      case 'content-share-explain': {
        return {
          data: swrState.access,
          error: undefined,
          isLoading: false,
          mutate: mutateSpies.access,
        };
      }
      case 'resource-share-member-search': {
        return {
          data: swrState.searchedMembers,
          error: undefined,
          isLoading: false,
          mutate: mutateSpies.search,
        };
      }
      default: {
        return { data: undefined, error: undefined, isLoading: false, mutate: vi.fn() };
      }
    }
  },
}));

vi.mock('@/libs/trpc/client', () => ({
  lambdaClient: {
    contentShare: {
      createContentShareLink: { mutate: createContentShareLinkMutate },
      disableContentShareLink: { mutate: disableContentShareLinkMutate },
      explainContentAccess: { query: explainContentAccessQuery },
      grantContentPermission: { mutate: grantContentPermissionMutate },
      listContentPermissions: { query: listContentPermissionsQuery },
      listContentShareLinks: { query: listContentShareLinksQuery },
      revokeContentPermission: { mutate: revokeContentPermissionMutate },
    },
    user: {
      searchUsers: { query: searchUsersQuery },
    },
  },
}));

describe('ResourceShareModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    swrState.access = {
      authzEpoch: 3,
      matchedBy: 'content_permission',
      reason: 'owner',
    };
    swrState.links = [
      {
        createdAt: new Date('2026-04-06T04:00:00.000Z'),
        disabledAt: null,
        expiresAt: new Date('2026-04-13T04:00:00.000Z'),
        id: 'link-1',
      },
    ];
    swrState.permissions = [
      {
        canReshare: true,
        expiresAt: null,
        id: 'perm-1',
        inheritsToChildren: true,
        role: 'editor',
        subjectAvatar: null,
        subjectId: 'user-1',
        subjectName: 'Ada Lovelace',
        subjectUsername: 'ada',
      },
    ];
    swrState.searchedMembers = [];

    createContentShareLinkMutate.mockResolvedValue({
      fileShareDownloadUrl: 'https://example.com/f/direct-download',
      shareUrl: 'https://example.com/share/latest',
    });
    disableContentShareLinkMutate.mockResolvedValue(undefined);
    grantContentPermissionMutate.mockResolvedValue(undefined);
    revokeContentPermissionMutate.mockResolvedValue(undefined);
  });

  it('renders a top summary with access context and current share counts', () => {
    render(<ResourceShareModal id={'file-1'} kind={'file'} name={'Brand Spec.md'} />);

    expect(screen.getByRole('heading', { name: 'Brand Spec.md' })).toBeInTheDocument();
    expect(screen.getByText('Access owner 3')).toBeInTheDocument();
    expect(screen.getByText('People with access · 1')).toBeInTheDocument();
    expect(screen.getByText('Active Links · 1')).toBeInTheDocument();
    expect(screen.getByText('Share with Members')).toBeInTheDocument();
    expect(screen.getByText('Share Links')).toBeInTheDocument();
  });

  it('shows the latest link workbench after creating a share link', async () => {
    render(<ResourceShareModal id={'file-1'} kind={'file'} name={'Brand Spec.md'} />);

    fireEvent.click(screen.getByRole('button', { name: 'Create Link' }));

    await waitFor(() => {
      expect(createContentShareLinkMutate).toHaveBeenCalledWith({
        expiresInDays: 7,
        id: 'file-1',
        kind: 'file',
        password: undefined,
      });
    });

    expect(screen.getByText('Latest Link')).toBeInTheDocument();
    expect(screen.getByText('https://example.com/share/latest')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy Link' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy Direct Download' })).toBeInTheDocument();
    expect(screen.getByText('https://example.com/f/direct-download')).toBeInTheDocument();
    expect(messageApi.success).toHaveBeenCalledWith('Link created');
  });
});
