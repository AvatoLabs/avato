/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import FolderTree from './index';

vi.mock('@lobehub/ui', () => ({
  ActionIcon: ({ onClick }: any) => (
    <button aria-label="toggle" type="button" onClick={onClick}>
      toggle
    </button>
  ),
  Flexbox: ({ children, className, onClick, style, ...props }: any) => (
    <div className={className} style={style} onClick={onClick} {...props}>
      {children}
    </div>
  ),
  Icon: () => <span aria-hidden="true" />,
}));

vi.mock('antd-style', () => ({
  createStaticStyles: () => ({
    folderHeader: 'folderHeader',
    folderHeaderActive: 'folderHeaderActive',
  }),
  cx: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' '),
}));

vi.mock('motion/react-m', () => ({
  div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

vi.mock('@/config/contentIcons', () => ({
  RESOURCE_ENTRY_ICONS: {
    folder: () => null,
    folderOpen: () => null,
  },
}));

describe('FolderTree', () => {
  it('uses document ids for expansion and lazy loading even when a slug exists', async () => {
    const onLoadFolder = vi.fn().mockResolvedValue(undefined);
    const onToggleFolder = vi.fn();

    render(
      <FolderTree
        expandedFolders={new Set()}
        items={[{ id: 'docs_folder_1', name: 'Folder A', slug: 'folder-a' }]}
        loadedFolders={new Set()}
        onLoadFolder={onLoadFolder}
        onToggleFolder={onToggleFolder}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'toggle' }));

    expect(onToggleFolder).toHaveBeenCalledWith('docs_folder_1');
    expect(onLoadFolder).toHaveBeenCalledWith('docs_folder_1');
  });
});
