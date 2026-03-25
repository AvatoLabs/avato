import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useSend } from './useSend';

const routerPush = vi.fn();
const sendMessage = vi.fn();
const clearChatUploadFileList = vi.fn();
const clearChatContextSelections = vi.fn();
const clearContent = vi.fn();

const fileState = {
  chatContextSelections: [
    {
      content: '<selection>Hello world</selection>',
      id: 'selection-1',
      pageId: 'page-1',
      preview: 'Hello world',
      type: 'text' as const,
    },
  ],
  chatUploadFileList: [],
  clearChatContextSelections,
  clearChatUploadFileList,
};

const chatState = {
  inputMessage: 'Ask this',
  mainInputEditor: {
    clearContent,
  },
  sendMessage,
};

const homeState = {
  homeInputLoading: false,
  inputActiveMode: 'default',
  sendAsAgent: vi.fn(),
  sendAsGroup: vi.fn(),
  sendAsResearch: vi.fn(),
  sendAsWrite: vi.fn(),
};

vi.mock('@/hooks/useQueryRoute', () => ({
  useQueryRoute: () => ({
    push: routerPush,
  }),
}));

vi.mock('@/store/agent/store', () => ({
  useAgentStore: (selector: (state: any) => unknown) => selector({ inboxAgentId: 'inbox-agent' }),
}));

vi.mock('@/store/agent/selectors', () => ({
  builtinAgentSelectors: {
    inboxAgentId: (state: any) => state.inboxAgentId,
  },
}));

vi.mock('@/store/chat', () => ({
  useChatStore: Object.assign(
    (selector: (state: typeof chatState) => unknown) => selector(chatState),
    {
      getState: () => chatState,
    },
  ),
}));

vi.mock('@/store/file', () => ({
  fileChatSelectors: {
    chatContextSelections: (state: typeof fileState) => state.chatContextSelections,
    chatUploadFileList: (state: typeof fileState) => state.chatUploadFileList,
  },
  useFileStore: Object.assign(
    (selector: (state: typeof fileState) => unknown) => selector(fileState),
    {
      getState: () => fileState,
    },
  ),
}));

vi.mock('@/store/home/store', () => ({
  useHomeStore: Object.assign(
    (selector: (state: typeof homeState) => unknown) => selector(homeState),
    {
      getState: () => homeState,
    },
  ),
}));

describe('useSend', () => {
  beforeEach(() => {
    clearChatContextSelections.mockClear();
    clearChatUploadFileList.mockClear();
    clearContent.mockClear();
    routerPush.mockClear();
    sendMessage.mockClear();
  });

  it('maps chat context selections to pageSelections for inbox sends', async () => {
    const { result } = renderHook(() => useSend());

    await act(async () => {
      await result.current.send();
    });

    expect(sendMessage).toHaveBeenCalledWith({
      context: { agentId: 'inbox-agent' },
      files: [],
      message: 'Ask this',
      pageSelections: [
        {
          content: 'Hello world',
          id: 'selection-1',
          pageId: 'page-1',
          xml: '<selection>Hello world</selection>',
        },
      ],
    });
    expect(clearChatUploadFileList).toHaveBeenCalled();
    expect(clearChatContextSelections).toHaveBeenCalled();
    expect(clearContent).toHaveBeenCalled();
    expect(routerPush).toHaveBeenCalled();
  });
});
