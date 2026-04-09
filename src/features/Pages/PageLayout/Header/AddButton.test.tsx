/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AddButton from './AddButton';

const mockCreateNewPage = vi.hoisted(() => vi.fn());
const mockCreateNewTable = vi.hoisted(() => vi.fn());
const mockMessageError = vi.hoisted(() => vi.fn());

vi.mock('@lobehub/ui', () => ({
  ActionIcon: ({ onClick, title }: any) => (
    <button aria-label={title} type="button" onClick={onClick}>
      {title}
    </button>
  ),
}));

vi.mock('antd', () => ({
  App: {
    useApp: () => ({
      message: {
        error: mockMessageError,
      },
    }),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/features/Pages/usePageKind', () => ({
  usePageKind: () => 'doc',
}));

vi.mock('@/features/Pages/usePageScope', () => ({
  usePageScope: () => ({
    sourceSetId: undefined,
  }),
}));

vi.mock('@/features/Pages/usePageSpaceId', () => ({
  usePageSpaceId: () => 'space-1',
}));

vi.mock('@/store/docs', () => ({
  usePageStore: (selector: any) =>
    selector({
      createNewPage: mockCreateNewPage,
      createNewTable: mockCreateNewTable,
    }),
}));

vi.mock('@/store/sourceSet', () => ({
  sourceSetSelectors: {
    getSourceSetById: () => () => undefined,
  },
  useSourceSetStore: (selector: any) => selector({}),
}));

describe('AddButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles create page failures without leaking unhandled rejections', async () => {
    const error = new Error('create failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockCreateNewPage.mockRejectedValue(error);

    render(<AddButton />);
    fireEvent.click(screen.getByRole('button', { name: 'header.newPageButton' }));

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('pageList.createFailed');
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to create page:', error);

    consoleErrorSpy.mockRestore();
  });
});
