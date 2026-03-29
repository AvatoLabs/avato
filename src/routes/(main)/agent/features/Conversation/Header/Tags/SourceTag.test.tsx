/**
 * @vitest-environment happy-dom
 */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setActiveWorkspaceSpaceId } from '@/helpers/activeWorkspaceSpace';
import { AgentSourceKind } from '@/types/sourceSet';

import SourceTag from './SourceTag';

vi.mock('@lobehub/ui', () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  Flexbox: ({ as, children, ...props }: any) => {
    const Component = as || 'div';
    return <Component {...props}>{children}</Component>;
  },
  Icon: ({ icon: Icon }: any) => (Icon ? <Icon /> : null),
  Tag: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/SourceIcon', () => ({
  default: ({ name }: { name: string }) => <span>{name}-icon</span>,
}));

vi.mock('@/features/ResourceSpaces', () => ({
  useSpaceName: (spaceId?: string | null) =>
    ({ 'space-1': 'My Space', 'space-2': 'Shared Space' })[spaceId || ''],
}));

describe('SourceTag', () => {
  beforeEach(() => {
    setActiveWorkspaceSpaceId('space-1');
  });

  it('shows the workspace name for a source from a different space', () => {
    render(
      <SourceTag
        data={[
          {
            id: 'kb-1',
            name: 'Handbook',
            spaceId: 'space-2',
            type: AgentSourceKind.SourceSet,
          },
          {
            fileType: 'text/markdown',
            id: 'file-1',
            name: 'Guide',
            spaceId: 'space-1',
            type: AgentSourceKind.File,
          },
        ]}
      />,
    );

    expect(screen.getByText('Handbook · Shared Space')).toBeInTheDocument();
    expect(screen.getByText('(1+)')).toBeInTheDocument();
  });
});
