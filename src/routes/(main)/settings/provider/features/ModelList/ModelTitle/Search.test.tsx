/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import Search from './Search';

vi.mock('@lobehub/ui', () => ({
  SearchBar: ({ onChange, value }: any) => (
    <input
      aria-label="model-search"
      value={value}
      onChange={(e) => onChange?.(e)}
    />
  ),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('ModelTitle Search', () => {
  it('stays in sync with external value changes', () => {
    const onChange = vi.fn();
    const { rerender } = render(<Search value="gpt" onChange={onChange} />);

    expect(screen.getByLabelText('model-search')).toHaveValue('gpt');

    rerender(<Search value="claude" onChange={onChange} />);

    expect(screen.getByLabelText('model-search')).toHaveValue('claude');
  });

  it('emits typed values through onChange', () => {
    const onChange = vi.fn();
    render(<Search value="" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('model-search'), {
      target: { value: 'gemini' },
    });

    expect(onChange).toHaveBeenCalledWith('gemini');
  });
});
