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

describe('useAddFilesToSourceSetModal', () => {
  it('should forward onClose to createModal afterClose', () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useAddFilesToSourceSetModal());

    result.current.open({ fileIds: ['file-1'], onClose });

    expect(mockCreateModal).toHaveBeenCalledWith(expect.objectContaining({ afterClose: onClose }));
  });
});
