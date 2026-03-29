/**
 * @vitest-environment happy-dom
 */
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import StoreUpdater from './StoreUpdater';

const {
  agentStoreApiMock,
  chatStoreApiMock,
  initMetaMock,
  setTitleMock,
  storeApiMock,
  storeState,
} = vi.hoisted(() => {
  const setActiveAgentId = vi.fn();
  const switchTopic = vi.fn();
  const initMeta = vi.fn();
  const setTitle = vi.fn();
  const state = {
    editor: undefined,
    initMeta,
    isMetaDirty: false,
    lastSavedEmoji: undefined as string | undefined,
    lastSavedTitle: undefined as string | undefined,
    setTitle,
    title: undefined as string | undefined,
  };

  return {
    agentStoreApiMock: {
      getState: vi.fn(() => ({
        setActiveAgentId,
      })),
    },
    chatStoreApiMock: {
      getState: vi.fn(() => ({
        activeAgentId: 'chat-agent',
        activeThreadId: 'thread-1',
        activeTopicId: 'main-topic',
        switchTopic,
      })),
      setState: vi.fn(),
    },
    initMetaMock: initMeta,
    setTitleMock: setTitle,
    storeApiMock: {
      getState: vi.fn(() => state),
    },
    storeState: state,
  };
});

vi.mock('zustand-utils', () => ({
  createStoreUpdater: () => () => undefined,
}));

vi.mock('@/store/tool/slices/builtin/executors/lobe-docs-agent', () => ({
  docsAgentRuntime: {
    setCurrentDocId: vi.fn(),
    setEditor: vi.fn(),
    setTitleHandlers: vi.fn(),
  },
}));

vi.mock('@/store/agent/store', () => ({
  useAgentStore: agentStoreApiMock,
}));

vi.mock('@/store/chat', () => ({
  useChatStore: chatStoreApiMock,
}));

vi.mock('./store', () => ({
  usePageEditorStore: vi.fn((selector: any) => selector(storeState)),
  useStoreApi: vi.fn(() => storeApiMock),
}));

describe('StoreUpdater', () => {
  beforeEach(() => {
    agentStoreApiMock.getState.mockClear();
    chatStoreApiMock.getState.mockClear();
    chatStoreApiMock.setState.mockClear();
    initMetaMock.mockClear();
    setTitleMock.mockClear();
    storeApiMock.getState.mockClear();

    storeState.editor = undefined;
    storeState.isMetaDirty = false;
    storeState.lastSavedEmoji = undefined;
    storeState.lastSavedTitle = undefined;
    storeState.title = undefined;
  });

  it('initializes meta on first mount', () => {
    render(<StoreUpdater emoji={undefined} pageId="doc-1" title={undefined} />);

    expect(initMetaMock).toHaveBeenCalledWith(undefined, undefined);
  });

  it('hydrates late-arriving meta when the page is still clean', () => {
    const { rerender } = render(
      <StoreUpdater emoji={undefined} pageId="doc-1" title={undefined} />,
    );

    initMetaMock.mockClear();

    rerender(<StoreUpdater emoji={undefined} pageId="doc-1" title="Loaded title" />);

    expect(initMetaMock).toHaveBeenCalledWith('Loaded title', undefined);
  });

  it('does not overwrite local meta edits when props arrive late', () => {
    const { rerender } = render(
      <StoreUpdater emoji={undefined} pageId="doc-1" title={undefined} />,
    );

    initMetaMock.mockClear();
    storeState.isMetaDirty = true;
    storeState.title = 'Local draft';

    rerender(<StoreUpdater emoji={undefined} pageId="doc-1" title="Loaded title" />);

    expect(initMetaMock).not.toHaveBeenCalled();
  });

  it('reinitializes meta when switching documents even if the current one is dirty', () => {
    const { rerender } = render(<StoreUpdater emoji={undefined} pageId="doc-1" title="Doc 1" />);

    initMetaMock.mockClear();
    storeState.isMetaDirty = true;
    storeState.title = 'Local draft';

    rerender(<StoreUpdater emoji="📄" pageId="doc-2" title="Doc 2" />);

    expect(initMetaMock).toHaveBeenCalledWith('Doc 2', '📄');
  });

  it('clears doc topic on page switch and restores the previous chat selection on unmount', () => {
    const { rerender, unmount } = render(
      <StoreUpdater emoji={undefined} pageId="doc-1" title="Doc 1" />,
    );

    const switchTopicMock = chatStoreApiMock.getState().switchTopic;
    const setActiveAgentIdMock = agentStoreApiMock.getState().setActiveAgentId;

    vi.mocked(switchTopicMock).mockClear();
    vi.mocked(setActiveAgentIdMock).mockClear();
    chatStoreApiMock.setState.mockClear();

    rerender(<StoreUpdater emoji={undefined} pageId="doc-2" title="Doc 2" />);

    expect(switchTopicMock).toHaveBeenCalledWith(null, {
      scope: 'doc',
      skipRefreshMessage: true,
    });

    unmount();

    expect(chatStoreApiMock.setState).toHaveBeenCalledWith(
      {
        activeAgentId: 'chat-agent',
        activeThreadId: 'thread-1',
        activeTopicId: 'main-topic',
      },
      false,
      'PageEditor/restoreChatSelection',
    );
    expect(setActiveAgentIdMock).toHaveBeenCalledWith('chat-agent');
  });
});
