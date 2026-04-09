/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ModalPageClient from './ModalPageClient';

const navigateMock = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('./FileDetail', () => ({
  default: ({ id }: { id: string }) => <div>{`detail:${id}`}</div>,
}));

vi.mock('./FilePreview', () => ({
  default: ({ id }: { id: string }) => <div>{`preview:${id}`}</div>,
}));

vi.mock('./FullscreenModal', () => ({
  default: ({ children, detail, onClose }: any) => (
    <div>
      <button type={'button'} onClick={onClose}>
        close
      </button>
      <div>{detail}</div>
      <div>{children}</div>
    </div>
  ),
}));

describe('ModalPageClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders preview and detail panes for the selected file', () => {
    window.history.replaceState({}, '', '/spaces/space-1/files/modal?file=file-1');

    render(<ModalPageClient id={'file-1'} />);

    expect(screen.getByText('detail:file-1')).toBeInTheDocument();
    expect(screen.getByText('preview:file-1')).toBeInTheDocument();
  });

  it('closes back to the base files route while preserving the query string', () => {
    window.history.replaceState({}, '', '/spaces/space-1/files/modal?file=file-1');

    render(<ModalPageClient id={'file-1'} />);

    fireEvent.click(screen.getByRole('button', { name: 'close' }));

    expect(navigateMock).toHaveBeenCalledWith('/spaces/space-1/files?file=file-1', {
      replace: true,
    });
  });
});
