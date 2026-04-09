/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SortProviderModal from './index';

const mockMessageError = vi.hoisted(() => vi.fn());
const mockMessageSuccess = vi.hoisted(() => vi.fn());
const mockUpdateAiProviderSort = vi.hoisted(() => vi.fn());

vi.mock('@lobehub/ui', () => ({
  Button: ({ children, loading, onClick }: any) => (
    <button data-loading={loading ? 'true' : 'false'} type="button" onClick={onClick}>
      {children}
    </button>
  ),
  Flexbox: ({ children }: any) => <div>{children}</div>,
  Modal: ({ children, open }: any) => (open ? <div>{children}</div> : null),
  SortableList: Object.assign(
    ({ items, renderItem }: any) => <div>{items.map((item: any) => renderItem(item))}</div>,
    {
      Item: ({ children }: any) => <div>{children}</div>,
    },
  ),
}));

vi.mock('antd', () => ({
  App: {
    useApp: () => ({
      message: {
        error: mockMessageError,
        success: mockMessageSuccess,
      },
    }),
  },
}));

vi.mock('antd-style', () => ({
  createStaticStyles: () => ({
    container: 'container',
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/store/aiInfra', () => ({
  useAiInfraStore: (selector: any) =>
    selector({
      updateAiProviderSort: mockUpdateAiProviderSort,
    }),
}));

vi.mock('./GroupItem', () => ({
  default: ({ id }: any) => <div>{id}</div>,
}));

describe('SortProviderModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an error and clears loading when sorting providers fails', async () => {
    const error = new Error('sort failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockUpdateAiProviderSort.mockRejectedValue(error);

    render(
      <SortProviderModal
        defaultItems={[{ id: 'provider-1', name: 'Provider 1' } as any]}
        open
        onCancel={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'sortModal.update' }));

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('sortModal.error');
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to sort providers:', error);
    expect(screen.getByRole('button', { name: 'sortModal.update' })).toHaveAttribute(
      'data-loading',
      'false',
    );

    consoleErrorSpy.mockRestore();
  });
});
