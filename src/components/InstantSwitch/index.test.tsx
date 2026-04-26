/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import InstantSwitch from './index';

vi.mock('antd', () => ({
  Switch: ({ loading, onChange, value }: any) => (
    <button
      aria-checked={value ? 'true' : 'false'}
      data-loading={loading ? 'true' : 'false'}
      role="switch"
      type="button"
      onClick={() => {
        void onChange(!value);
      }}
    />
  ),
}));

describe('InstantSwitch', () => {
  it('reverts value and clears loading when onChange fails', async () => {
    const onChange = vi.fn().mockRejectedValue(new Error('toggle failed'));

    render(<InstantSwitch enabled={false} onChange={onChange} />);

    fireEvent.click(screen.getByRole('switch'));

    await waitFor(() => {
      expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
      expect(screen.getByRole('switch')).toHaveAttribute('data-loading', 'false');
    });
  });

  it('syncs with external enabled changes', async () => {
    const onChange = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(<InstantSwitch enabled={false} onChange={onChange} />);

    rerender(<InstantSwitch enabled={true} onChange={onChange} />);

    await waitFor(() => {
      expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    });
  });
});
