/**
 * @vitest-environment happy-dom
 */
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useOpenCreateSpaceMemoryCandidateModal } from './useOpenCreateSpaceMemoryCandidateModal';

const mockCreateModal = vi.hoisted(() => vi.fn());
const mockClose = vi.hoisted(() => vi.fn());
const mockMutate = vi.hoisted(() => vi.fn());
const mockIngestCandidates = vi.hoisted(() => vi.fn());
const mockMessage = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
}));

let mockSpaceMemoryTargets: {
  defaultSpaceId?: string;
  isLoading: boolean;
  teamSpaces: Array<{ id: string; name?: string }>;
} = {
  defaultSpaceId: 'spc_team',
  isLoading: false,
  teamSpaces: [{ id: 'spc_team', name: 'Ops' }],
};

vi.mock('@lobehub/ui', () => ({
  Button: ({ children, disabled, onClick }: any) => (
    <button disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
  Flexbox: ({ children }: any) => <div>{children}</div>,
  Segmented: ({ options, value, onChange }: any) => (
    <div>
      {options.map((option: any) => (
        <button
          key={option.value}
          aria-pressed={value === option.value}
          onClick={() => onChange?.(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  ),
  Tag: ({ children }: any) => <span>{children}</span>,
  Text: ({ children }: any) => <span>{children}</span>,
}));

vi.mock('@lobehub/ui/base-ui', () => ({
  createModal: mockCreateModal,
  useModalContext: () => ({ close: mockClose }),
}));

vi.mock('antd', () => {
  const Input = ({ value, onChange, ...rest }: any) => (
    <input value={value} onChange={onChange} {...rest} />
  );

  Input.TextArea = ({ value, onChange, ...rest }: any) => (
    <textarea value={value} onChange={onChange} {...rest} />
  );

  return {
    App: {
      useApp: () => ({
        message: mockMessage,
      }),
    },
    Input,
    Select: ({ options, onChange, placeholder, value }: any) => (
      <select aria-label={placeholder} value={value} onChange={(e) => onChange?.(e.target.value)}>
        {options.map((option: any) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    ),
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('swr', () => ({
  useSWRConfig: () => ({
    mutate: mockMutate,
  }),
}));

vi.mock('@/libs/trpc/client', () => ({
  lambdaClient: {
    spaceMemory: {
      ingestCandidates: {
        mutate: mockIngestCandidates,
      },
    },
  },
}));

vi.mock('./useSpaceMemoryCandidateTargets', () => ({
  useSpaceMemoryCandidateTargets: () => mockSpaceMemoryTargets,
}));

describe('useOpenCreateSpaceMemoryCandidateModal', () => {
  beforeEach(() => {
    mockCreateModal.mockReset();
    mockClose.mockReset();
    mockMutate.mockReset();
    mockIngestCandidates.mockReset();
    mockMessage.error.mockReset();
    mockMessage.success.mockReset();
    mockMessage.warning.mockReset();
    mockSpaceMemoryTargets = {
      defaultSpaceId: 'spc_team',
      isLoading: false,
      teamSpaces: [{ id: 'spc_team', name: 'Ops' }],
    };
  });

  it('renders a blocked composer state when no writable team space is available', () => {
    mockSpaceMemoryTargets = {
      defaultSpaceId: undefined,
      isLoading: false,
      teamSpaces: [],
    };

    const { result } = renderHook(() => useOpenCreateSpaceMemoryCandidateModal());

    act(() => {
      result.current({
        defaultTitle: 'Release checklist',
        sourceRefs: [{ id: 'msg_1', kind: 'message', title: 'Release checklist' }],
      });
    });

    expect(mockCreateModal).toHaveBeenCalledTimes(1);

    const [{ children }] = mockCreateModal.mock.calls[0] as [{ children: any }];
    render(children);

    expect(screen.getByText('space.memory.composer.permissionHint')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'space.memory.actions.addFromSource' }),
    ).toBeDisabled();
  });

  it('renders a blocked composer state when the fixed space is no longer writable', () => {
    mockSpaceMemoryTargets = {
      defaultSpaceId: 'spc_team',
      isLoading: false,
      teamSpaces: [{ id: 'spc_team', name: 'Ops' }],
    };

    const { result } = renderHook(() => useOpenCreateSpaceMemoryCandidateModal());

    act(() => {
      result.current({
        defaultTitle: 'Release checklist',
        sourceRefs: [{ id: 'msg_1', kind: 'message', title: 'Release checklist' }],
        spaceId: 'spc_other',
      });
    });

    const [{ children }] = mockCreateModal.mock.calls[0] as [{ children: any }];
    render(children);

    expect(screen.getByText('space.memory.composer.permissionHint')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'space.memory.actions.addFromSource' }),
    ).toBeDisabled();
  });

  it('submits candidate creation when a writable team space is available', async () => {
    const { result } = renderHook(() => useOpenCreateSpaceMemoryCandidateModal());

    act(() => {
      result.current({
        defaultTitle: 'Release checklist',
        sourceRefs: [{ id: 'msg_1', kind: 'message', title: 'Release checklist' }],
      });
    });

    const [{ children }] = mockCreateModal.mock.calls[0] as [{ children: any }];
    render(children);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'space.memory.actions.addFromSource' }));
    });

    expect(mockIngestCandidates).toHaveBeenCalledWith({
      drafts: [
        {
          category: 'general',
          sourceRefs: [{ id: 'msg_1', kind: 'message', title: 'Release checklist' }],
          summary: undefined,
          title: 'Release checklist',
        },
      ],
      origin: 'manual',
      spaceId: 'spc_team',
    });
    expect(mockMessage.warning).not.toHaveBeenCalledWith(
      'space.memory.actions.createPermissionDenied',
    );
  });
});
