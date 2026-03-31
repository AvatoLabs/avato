/**
 * @vitest-environment happy-dom
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SourceSetHeader from './SourceSetHeader';

const mockNavigate = vi.hoisted(() => vi.fn());
const mockSetMode = vi.hoisted(() => vi.fn());
const mockSetSourceSetId = vi.hoisted(() => vi.fn());
const mockUseFetchSourceSetList = vi.hoisted(() => vi.fn());

const sourceSets = [
  { id: 'ss-1', name: 'Library A' },
  { id: 'ss-2', name: 'Library B' },
];

vi.mock('@lobehub/ui', () => ({
  ActionIcon: ({ icon: Icon }: any) => <span>{Icon ? <Icon /> : 'action'}</span>,
  Block: ({ children, onClick, ...props }: any) => (
    <div
      data-testid="source-set-header-root"
      role="button"
      tabIndex={0}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  ),
  Center: ({ children, onClick, ...props }: any) => (
    <div onClick={onClick} {...props}>
      {children}
    </div>
  ),
  DropdownMenu: ({ children, items }: any) => (
    <div>
      {children}
      {items?.map((item: any) => (
        <button
          data-testid={`dropdown-item-${item.key}`}
          key={item.key}
          type="button"
          onClick={item.onClick}
        >
          {item.label}
        </button>
      ))}
    </div>
  ),
  Icon: ({ icon: Icon }: any) => <span>{Icon ? <Icon /> : 'icon'}</span>,
  Skeleton: () => <span>loading</span>,
  stopPropagation: (event: Event) => event.stopPropagation(),
  Text: ({ children }: any) => <span>{children}</span>,
}));

vi.mock('antd-style', () => ({
  createStaticStyles: () => ({
    dropZoneActive: 'dropZoneActive',
    menuIcon: 'menuIcon',
  }),
  cx: (...classNames: string[]) => classNames.filter(Boolean).join(' '),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');

  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: 'ss-1', spaceId: 'spc_1' }),
  };
});

vi.mock('@/config/contentIcons', () => ({
  RESOURCE_ENTRY_ICONS: {
    selector: () => <span>selector</span>,
    sourceSet: () => <span>sourceSet</span>,
  },
}));

vi.mock('@/features/ResourceSpaces', () => ({
  buildSourceSetPath: (spaceId: string | null | undefined, sourceSetId: string) =>
    spaceId
      ? `/spaces/${spaceId}/source-sets/${sourceSetId}`
      : `/content/source-sets/${sourceSetId}`,
  useSpaceName: () => 'Team Alpha',
}));

vi.mock('@/routes/(main)/content/features/DndContextWrapper', () => ({
  useDragActive: () => false,
}));

vi.mock('@/routes/(main)/content/features/store', () => ({
  useContentManagerStore: (selector: any) =>
    selector({
      setMode: mockSetMode,
      setSourceSetId: mockSetSourceSetId,
      spaceId: 'spc_1',
    }),
}));

vi.mock('@/store/sourceSet', () => ({
  sourceSetSelectors: {
    getSourceSetNameById: (id: string) => () => sourceSets.find((item) => item.id === id)?.name,
  },
  useSourceSetStore: (selector: any) =>
    selector({
      useFetchSourceSetList: mockUseFetchSourceSetList,
    }),
}));

describe('SourceSetHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockUseFetchSourceSetList.mockReturnValue({ data: sourceSets });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('navigates to the space-scoped source-set route when the header is clicked', () => {
    render(
      <MemoryRouter>
        <SourceSetHeader />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByTestId('source-set-header-root'));

    expect(mockSetMode).toHaveBeenCalledWith('explorer');
    expect(mockNavigate).toHaveBeenCalledWith('/spaces/spc_1/source-sets/ss-1');
  });

  it('keeps space context when switching source sets from the dropdown', () => {
    render(
      <MemoryRouter>
        <SourceSetHeader />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByTestId('dropdown-item-ss-2'));

    act(() => {
      vi.runAllTimers();
    });

    expect(mockSetSourceSetId).toHaveBeenCalledWith('ss-2');
    expect(mockSetMode).toHaveBeenCalledWith('explorer');
    expect(mockNavigate).toHaveBeenCalledWith('/spaces/spc_1/source-sets/ss-2');
  });
});
