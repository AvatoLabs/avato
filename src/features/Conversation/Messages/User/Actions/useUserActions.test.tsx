/**
 * @vitest-environment happy-dom
 */
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useUserActions } from './useUserActions';

const mockOpenCreateSpaceMemoryCandidateModal = vi.hoisted(() => vi.fn());
let mockResolvedSpaceId = 'spc_team';
let mockSpaceMemoryTargets = {
  defaultSpaceId: 'spc_team',
  isLoading: false,
  teamSpaces: [{ id: 'spc_team' }],
};

vi.mock('@lobehub/ui', () => ({
  copyToClipboard: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('antd', () => ({
  App: {
    useApp: () => ({
      message: { success: vi.fn() },
    }),
  },
  Upload: {},
}));

vi.mock('@/features/ResourceSpaces/useOpenCreateSpaceMemoryCandidateModal', () => ({
  useOpenCreateSpaceMemoryCandidateModal: () => mockOpenCreateSpaceMemoryCandidateModal,
}));

vi.mock('@/features/ResourceSpaces/useSpaceMemoryCandidateTargets', () => ({
  useSpaceMemoryCandidateTargets: () => mockSpaceMemoryTargets,
}));

vi.mock('@/helpers/activeWorkspaceSpace', () => ({
  resolveWorkspaceSpaceId: () => mockResolvedSpaceId,
}));

vi.mock('@/locales/contents', () => ({
  localeOptions: [],
}));

vi.mock('../../../store', () => ({
  messageStateSelectors: {
    isMessageRegenerating: () => () => false,
  },
  useConversationStore: (selector: any) =>
    selector({
      deleteMessage: vi.fn(),
      regenerateUserMessage: vi.fn(),
      toggleMessageEditing: vi.fn(),
      translateMessage: vi.fn(),
      ttsMessage: vi.fn(),
    }),
}));

describe('useUserActions', () => {
  beforeEach(() => {
    mockOpenCreateSpaceMemoryCandidateModal.mockReset();
    mockResolvedSpaceId = 'spc_team';
    mockSpaceMemoryTargets = {
      defaultSpaceId: 'spc_team',
      isLoading: false,
      teamSpaces: [{ id: 'spc_team' }],
    };
  });

  it('offers add-to-space-memory for message sources', () => {
    const { result } = renderHook(() =>
      useUserActions({
        data: {
          content: 'Please remember that Acme only ships to verified enterprise addresses.',
          createdAt: Date.now(),
          id: 'msg_1',
          role: 'user',
        } as any,
        id: 'msg_1',
      }),
    );

    expect(result.current.addToSpaceMemory?.label).toBe('space.memory.actions.addFromSource');

    result.current.addToSpaceMemory?.handleClick?.();

    expect(mockOpenCreateSpaceMemoryCandidateModal).toHaveBeenCalledWith({
      defaultSummary: 'Please remember that Acme only ships to verified enterprise addresses.',
      defaultTitle: 'Please remember that Acme only ships to verified enterprise addresses.',
      initialSpaceId: 'spc_team',
      sourceRefs: [
        {
          id: 'msg_1',
          kind: 'message',
          title: 'Please remember that Acme only ships to verified enterprise addresses.',
        },
      ],
    });
  });

  it('hides add-to-space-memory when no writable team space is available', () => {
    mockSpaceMemoryTargets = {
      defaultSpaceId: undefined,
      isLoading: false,
      teamSpaces: [],
    };

    const { result } = renderHook(() =>
      useUserActions({
        data: {
          content: 'Please remember that Acme only ships to verified enterprise addresses.',
          createdAt: Date.now(),
          id: 'msg_1',
          role: 'user',
        } as any,
        id: 'msg_1',
      }),
    );

    expect(result.current.addToSpaceMemory).toBeUndefined();
  });

  it('uses the resolved route workspace when picking writable targets', () => {
    mockResolvedSpaceId = 'spc_route';
    mockSpaceMemoryTargets = {
      defaultSpaceId: 'spc_route',
      isLoading: false,
      teamSpaces: [{ id: 'spc_route' }],
    };

    const { result } = renderHook(() =>
      useUserActions({
        data: {
          content: 'Use the route workspace for this memory target.',
          createdAt: Date.now(),
          id: 'msg_2',
          role: 'user',
        } as any,
        id: 'msg_2',
      }),
    );

    result.current.addToSpaceMemory?.handleClick?.();

    expect(mockOpenCreateSpaceMemoryCandidateModal).toHaveBeenCalledWith(
      expect.objectContaining({
        initialSpaceId: 'spc_route',
      }),
    );
  });
});
