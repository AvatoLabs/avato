import { render, screen } from '@testing-library/react';
import { beforeEach } from 'vitest';
import { describe, expect, it, vi } from 'vitest';

import Header from './index';

const titleBarProps = vi.hoisted(() => ({
  current: null as null | Record<string, unknown>,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      (
        ({
          'shared.title': 'Shared with me',
          'space.quickAccessTitle': 'Quick Access',
          'tab.files': 'Files',
          'trash.title': 'Trash',
        }) as Record<string, string>
      )[key] || key,
  }),
}));

const locationState = vi.hoisted(() => ({
  pathname: '/spaces/spc_ops/files',
}));

vi.mock('react-router-dom', () => ({
  useLocation: () => locationState,
  useParams: () => ({ spaceId: 'spc_ops' }),
}));

vi.mock('@/features/NavPanel/components/SubSidebarTitleBar', () => ({
  default: (props: Record<string, unknown>) => {
    titleBarProps.current = props;

    return <div>{String(props.title)}</div>;
  },
}));

vi.mock('@/features/ResourceSpaces', () => ({
  buildFilesRootPath: (spaceId?: string) => (spaceId ? `/spaces/${spaceId}/files` : '/spaces'),
  buildFilesTrashPath: (spaceId?: string) =>
    spaceId ? `/spaces/${spaceId}/files/trash` : '/spaces/trash',
  buildSharedFilesPath: () => '/spaces/shared',
  useSpaceName: () => 'Ops Space',
}));

vi.mock('@/features/ContentManager/useFileScope', () => ({
  useFileScope: () => ({
    sourceSetId: 'ss_ops',
  }),
}));

vi.mock('@/store/sourceSet', () => ({
  sourceSetSelectors: {
    getSourceSetNameById: () => () => 'Operations Set',
  },
  useSourceSetStore: (selector: any) =>
    selector({
      activeSourceSetItems: {
        ss_ops: { id: 'ss_ops', name: 'Operations Set' },
      },
    }),
}));

describe('Resource Sidebar Header', () => {
  beforeEach(() => {
    locationState.pathname = '/spaces/spc_ops/files';
  });

  it('uses a files-only title and keeps the current space root as the title link', () => {
    render(<Header />);

    expect(screen.getByText('Files')).toBeInTheDocument();
    expect(titleBarProps.current).toMatchObject({
      backTo: '/',
      backUseHistory: false,
      showBackButton: true,
      title: 'Files',
      titleTo: '/spaces/spc_ops/files',
    });
  });

  it('treats shared-with-me as an independent quick access surface', () => {
    locationState.pathname = '/spaces/shared';

    render(<Header />);

    expect(screen.getByText('Quick Access / Shared with me')).toBeInTheDocument();
    expect(titleBarProps.current).toMatchObject({
      showBackButton: false,
      title: 'Quick Access / Shared with me',
      titleTo: undefined,
    });
  });

  it('shows trash as attached to the current source set when scoped', () => {
    locationState.pathname = '/spaces/spc_ops/files/trash';

    render(<Header />);

    expect(screen.getByText('Operations Set / Trash')).toBeInTheDocument();
    expect(titleBarProps.current).toMatchObject({
      showBackButton: false,
      title: 'Operations Set / Trash',
      titleTo: undefined,
    });
  });
});
