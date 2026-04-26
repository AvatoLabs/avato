import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useAddFilesToSourceSetModal } from './index';

const mockCreateModal = vi.hoisted(() => vi.fn());

vi.mock('@lobehub/ui', () => ({
  Flexbox: () => null,
  Icon: () => null,
}));

vi.mock('@lobehub/ui/base-ui', () => ({
  createModal: mockCreateModal,
  useModalContext: () => ({ close: vi.fn() }),
}));

vi.mock('./SelectForm', () => ({
  default: () => null,
}));

describe('useAddFilesToSourceSetModal', () => {
  it('should render modal content without unsupported afterClose props', () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useAddFilesToSourceSetModal());

    result.current.open({ fileIds: ['file-1'], onClose });

    const modalProps = mockCreateModal.mock.calls[0]?.[0];

    expect(modalProps).toBeDefined();
    expect(modalProps).not.toHaveProperty('afterClose');
    expect(modalProps).toEqual(
      expect.objectContaining({
        children: expect.anything(),
        footer: null,
        title: null,
      }),
    );
  });
});
