/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SourceSetItem from './index';

const setScopeMock = vi.hoisted(() => vi.fn());

vi.mock('@lobehub/ui', () => ({
  Icon: () => <span>icon</span>,
}));

vi.mock('@/config/contentIcons', () => ({
  RESOURCE_ENTRY_ICONS: {
    loader: () => null,
    sourceSet: () => null,
  },
}));

vi.mock('@/features/ContentManager/useFileScope', () => ({
  buildSourceSetFileScope: (id: string) => `source-set:${id}`,
  useFileScope: () => ({
    setScope: setScopeMock,
  }),
}));

vi.mock('@/features/NavPanel/components/NavItem', () => ({
  default: ({
    actions,
    onClick,
    title,
  }: {
    actions?: React.ReactNode;
    onClick?: () => void;
    title: string;
  }) => (
    <div>
      <button type="button" onClick={onClick}>
        {title}
      </button>
      <div data-testid={`actions-${title}`}>{actions ?? null}</div>
    </div>
  ),
}));

vi.mock('@/features/ResourceSharing', () => ({
  useResourceShareModal: () => ({
    open: vi.fn(),
  }),
}));

vi.mock('@/store/sourceSet', () => ({
  useSourceSetStore: (selector: any) =>
    selector({
      sourceSetLoadingIds: [],
      sourceSetRenamingId: null,
    }),
}));

vi.mock('./Actions', () => ({
  default: () => <button type="button">More Actions</button>,
}));

vi.mock('./Editing', () => ({
  default: () => null,
}));

vi.mock('./useDropdownMenu', () => ({
  useDropdownMenu: () => [],
}));

describe('SourceSetItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows row actions only for the active source set', () => {
    const { rerender } = render(
      <SourceSetItem active description={null} id="sst_1" name="Design System" spaceId="spc_1" />,
    );

    expect(screen.getByTestId('actions-Design System')).toHaveTextContent('More Actions');

    rerender(
      <SourceSetItem
        active={false}
        description={null}
        id="sst_1"
        name="Design System"
        spaceId="spc_1"
      />,
    );

    expect(screen.getByTestId('actions-Design System')).toBeEmptyDOMElement();
  });

  it('still switches scope when clicking an inactive row', () => {
    render(
      <SourceSetItem
        active={false}
        description={null}
        id="sst_1"
        name="Design System"
        spaceId="spc_1"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Design System' }));

    expect(setScopeMock).toHaveBeenCalledWith('source-set:sst_1', 'spc_1');
  });
});
