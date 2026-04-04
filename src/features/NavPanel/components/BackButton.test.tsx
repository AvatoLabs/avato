/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import BackButton from './BackButton';

const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock('@lobehub/ui', () => ({
  ActionIcon: ({ icon: Icon, ...props }: any) => (
    <button type="button" {...props}>
      {Icon ? <Icon /> : null}
    </button>
  ),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');

  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('BackButton', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    window.history.replaceState({ idx: 0 }, '');
  });

  it('uses browser history when a previous entry exists', () => {
    window.history.replaceState({ idx: 2 }, '');

    render(
      <MemoryRouter>
        <BackButton title="back" to="/content" />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button'));

    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('falls back to the target route when history cannot go back', () => {
    render(
      <MemoryRouter>
        <BackButton title="back" to="/content" />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button'));

    expect(mockNavigate).toHaveBeenCalledWith('/content');
  });

  it('can bypass browser history and always navigate to the target route', () => {
    window.history.replaceState({ idx: 3 }, '');

    render(
      <MemoryRouter>
        <BackButton title="back" to="/spaces/spc_1/files" useHistory={false} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button'));

    expect(mockNavigate).toHaveBeenCalledWith('/spaces/spc_1/files');
  });
});
