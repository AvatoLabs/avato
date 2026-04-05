/**
 * @vitest-environment happy-dom
 */
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAssistantActions } from './useAssistantActions';

const mockOpenCreateSpaceMemoryCandidateModal = vi.hoisted(() => vi.fn());
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
  getActiveWorkspaceSpaceId: () => 'spc_team',
}));

vi.mock('@/locales/contents', () => ({
  localeOptions: [],
}));

vi.mock('../../../store', () => ({
  messageStateSelectors: {
    isMessageCollapsed: () => () => false,
    isMessageRegenerating: () => () => false,
  },
  useConversationStore: (selector: any) =>
    selector({
      delAndRegenerateMessage: vi.fn(),
      deleteMessage: vi.fn(),
      regenerateAssistantMessage: vi.fn(),
      toggleMessageCollapsed: vi.fn(),
      toggleMessageEditing: vi.fn(),
      translateMessage: vi.fn(),
      ttsMessage: vi.fn(),
    }),
}));

describe('useAssistantActions', () => {
  beforeEach(() => {
    mockOpenCreateSpaceMemoryCandidateModal.mockReset();
    mockSpaceMemoryTargets = {
      defaultSpaceId: 'spc_team',
      isLoading: false,
      teamSpaces: [{ id: 'spc_team' }],
    };
  });

  it('offers add-to-space-memory for message sources', () => {
    const { result } = renderHook(() =>
      useAssistantActions({
        data: {
          content: 'This is a long assistant answer about the weekly sync and next steps.',
          createdAt: Date.now(),
          id: 'msg_1',
          role: 'assistant',
        } as any,
        id: 'msg_1',
        index: 0,
      }),
    );

    expect(result.current.addToSpaceMemory?.label).toBe('space.memory.actions.addFromSource');

    result.current.addToSpaceMemory?.handleClick?.();

    expect(mockOpenCreateSpaceMemoryCandidateModal).toHaveBeenCalledWith({
      defaultSummary: 'This is a long assistant answer about the weekly sync and next steps.',
      defaultTitle: 'This is a long assistant answer about the weekly sync and next steps.',
      initialSpaceId: 'spc_team',
      sourceRefs: [
        {
          id: 'msg_1',
          kind: 'message',
          title: 'This is a long assistant answer about the weekly sync and next steps.',
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
      useAssistantActions({
        data: {
          content: 'This is a long assistant answer about the weekly sync and next steps.',
          createdAt: Date.now(),
          id: 'msg_1',
          role: 'assistant',
        } as any,
        id: 'msg_1',
        index: 0,
      }),
    );

    expect(result.current.addToSpaceMemory).toBeUndefined();
  });
});
