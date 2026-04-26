/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createBatchRightsOwnerModal } from './BatchRightsOwnerModal';

const mockCreateModal = vi.hoisted(() => vi.fn());
const mockClose = vi.hoisted(() => vi.fn());
const mockOnSubmit = vi.hoisted(() => vi.fn());

vi.mock('@lobehub/ui', () => ({
  Button: ({ children, disabled, loading, onClick }: any) => (
    <button disabled={disabled || loading} type="button" onClick={onClick}>
      {children}
    </button>
  ),
  Flexbox: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@lobehub/ui/base-ui', () => ({
  createModal: mockCreateModal,
  useModalContext: () => ({
    close: mockClose,
  }),
}));

vi.mock('antd', () => ({
  Input: ({ 'aria-label': ariaLabel, autoFocus: _autoFocus, onChange, onPressEnter, placeholder, value }: any) => (
    <input
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onPressEnter?.(event);
      }}
    />
  ),
}));

vi.mock('i18next', () => ({
  t: (key: string, options?: { count?: number }) =>
    (
      {
        'FileManager.actions.setAssetRightsOwnerTitle': `Set rights owner for ${options?.count} assets`,
      } as Record<string, string>
    )[key] || key,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) =>
      (
        {
          'FileManager.actions.clearAssetRightsOwner': 'Clear rights owner',
          'FileManager.actions.setAssetRightsOwnerDescription': `This updates the rights owner for ${options?.count} selected assets.`,
          'FileManager.actions.setAssetRightsOwnerHint': 'Leave this blank to clear the current owner.',
          'detail.asset.rightsOwner.label': 'Rights Owner',
          'detail.asset.rightsOwner.placeholder': 'Enter rights owner',
          cancel: 'Cancel',
          save: 'Save',
        } as Record<string, string>
      )[key] || key,
  }),
}));

describe('BatchRightsOwnerModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSubmit.mockResolvedValue(undefined);
  });

  it('opens an imperative modal and submits a rights owner value', async () => {
    createBatchRightsOwnerModal({ count: 2, onSubmit: mockOnSubmit });

    expect(mockCreateModal).toHaveBeenCalledWith(
      expect.objectContaining({
        footer: null,
        title: 'Set rights owner for 2 assets',
        width: 420,
      }),
    );

    const modalConfig = mockCreateModal.mock.calls[0][0];
    render(modalConfig.children);

    fireEvent.change(screen.getByLabelText('Rights Owner'), {
      target: { value: 'Brand Team' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith('Brand Team');
    });
    expect(mockClose).toHaveBeenCalled();
  });

  it('submits null when clearing the rights owner', async () => {
    createBatchRightsOwnerModal({ count: 3, onSubmit: mockOnSubmit });

    const modalConfig = mockCreateModal.mock.calls[0][0];
    render(modalConfig.children);

    fireEvent.click(screen.getByRole('button', { name: 'Clear rights owner' }));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(null);
    });
    expect(mockClose).toHaveBeenCalled();
  });
});
