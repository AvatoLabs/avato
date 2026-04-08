import { describe, expect, it, vi } from 'vitest';

import {
  navigateToMessageDetail,
  navigateToNotebook,
  navigateToResources,
  navigateToThreadDetail,
  navigateToThreadList,
  navigateToToolDetail,
} from './navigation';
import {
  handleIncomingShareUrl,
  parseIncomingNavigationUrl,
  parseResourceShareUrl,
} from './shareLinkNavigation';

vi.mock('./navigation', () => ({
  navigateToChatDetail: vi.fn(),
  navigateToMessageDetail: vi.fn(),
  navigateToNotebook: vi.fn(),
  navigateToResources: vi.fn(),
  navigateToToolDetail: vi.fn(),
  navigateToThreadDetail: vi.fn(),
  navigateToThreadList: vi.fn(),
  navigationRef: {
    isReady: vi.fn(() => true),
    navigate: vi.fn(),
  },
}));

describe('shareLinkNavigation', () => {
  it('parses public resource share urls', () => {
    expect(parseResourceShareUrl('https://example.com/share/r/token-1?password=abc')).toEqual({
      initialPassword: 'abc',
      token: 'token-1',
    });
  });

  it('parses chat deep links', () => {
    expect(
      parseIncomingNavigationUrl('lobehub://chat?sessionId=session-1&topicId=topic-2&messageId=msg-3'),
    ).toEqual({
      params: {
        messageId: 'msg-3',
        sessionId: 'session-1',
        topicId: 'topic-2',
      },
      route: 'ChatDetail',
    });
  });

  it('parses notebook deep links', () => {
    expect(
      parseIncomingNavigationUrl(
        'https://example.com/notebook?sessionId=session-1&topicId=topic-2&threadId=thread-3&documentId=doc-4',
      ),
    ).toEqual({
      params: {
        documentId: 'doc-4',
        sessionId: 'session-1',
        threadId: 'thread-3',
        topicId: 'topic-2',
      },
      route: 'Notebook',
    });
  });

  it('parses message detail deep links', () => {
    expect(
      parseIncomingNavigationUrl(
        'lobehub://chat/message?sessionId=session-1&topicId=topic-2&messageId=msg-3&threadId=thread-4&title=Long%20reply',
      ),
    ).toEqual({
      params: {
        messageId: 'msg-3',
        sessionId: 'session-1',
        threadId: 'thread-4',
        title: 'Long reply',
        topicId: 'topic-2',
      },
      route: 'MessageDetail',
    });
  });

  it('parses thread list deep links', () => {
    expect(
      parseIncomingNavigationUrl('lobehub://threads?sessionId=session-1&topicId=topic-2'),
    ).toEqual({
      params: {
        sessionId: 'session-1',
        topicId: 'topic-2',
      },
      route: 'ThreadList',
    });
  });

  it('parses thread detail deep links', () => {
    expect(
      parseIncomingNavigationUrl(
        'https://example.com/chat/thread?sessionId=session-1&topicId=topic-2&threadId=thread-3&title=Branch%20A',
      ),
    ).toEqual({
      params: {
        sessionId: 'session-1',
        threadId: 'thread-3',
        title: 'Branch A',
        topicId: 'topic-2',
      },
      route: 'ThreadDetail',
    });
  });

  it('parses tool detail deep links', () => {
    expect(
      parseIncomingNavigationUrl(
        'lobehub://chat/tool?identifier=lobe-source-set&apiName=readSourceFiles&toolCallId=tool-1&title=Source%20files&sessionId=session-1&topicId=topic-2&threadId=thread-3',
      ),
    ).toEqual({
      params: {
        apiName: 'readSourceFiles',
        identifier: 'lobe-source-set',
        sessionId: 'session-1',
        threadId: 'thread-3',
        title: 'Source files',
        topicId: 'topic-2',
        toolCallId: 'tool-1',
      },
      route: 'ToolDetail',
    });
  });

  it('parses docs links into resource preview targets', () => {
    expect(
      parseIncomingNavigationUrl(
        'https://example.com/spaces/team/docs/docs_1?sessionId=session-1&topicId=topic-2',
      ),
    ).toEqual({
      params: {
        documentId: 'docs_1',
        sessionId: 'session-1',
        topicId: 'topic-2',
      },
      route: 'Notebook',
    });
  });

  it('parses table docs links into notebook targets', () => {
    expect(
      parseIncomingNavigationUrl(
        'https://example.com/spaces/team/docs/table/docs_1?sessionId=session-1&topicId=topic-2',
      ),
    ).toEqual({
      params: {
        documentId: 'docs_1',
        sessionId: 'session-1',
        topicId: 'topic-2',
      },
      route: 'Notebook',
    });
  });

  it('parses file item links into resource preview targets', () => {
    expect(
      parseIncomingNavigationUrl(
        'https://example.com/spaces/team/files/folder-a/item/file_1?sessionId=session-1&threadId=thread-3&topicId=topic-2',
      ),
    ).toEqual({
      params: {
        openItemId: 'file_1',
        openKind: 'file',
        sessionId: 'session-1',
        threadId: 'thread-3',
        topicId: 'topic-2',
      },
      route: 'Resources',
    });
  });

  it('dispatches thread detail deep links through navigation helpers', () => {
    handleIncomingShareUrl(
      'lobehub://thread?sessionId=session-1&topicId=topic-2&threadId=thread-3',
    );

    expect(navigateToThreadDetail).toHaveBeenCalledWith({
      sessionId: 'session-1',
      threadId: 'thread-3',
      topicId: 'topic-2',
    });
  });

  it('dispatches message detail deep links through navigation helpers', () => {
    handleIncomingShareUrl(
      'https://example.com/chat/message?sessionId=session-1&topicId=topic-2&messageId=msg-3',
    );

    expect(navigateToMessageDetail).toHaveBeenCalledWith({
      messageId: 'msg-3',
      sessionId: 'session-1',
      topicId: 'topic-2',
    });
  });

  it('dispatches notebook deep links through navigation helpers', () => {
    handleIncomingShareUrl(
      'https://example.com/spaces/team/docs/docs_1?sessionId=session-1&threadId=thread-3&topicId=topic-2',
    );

    expect(navigateToNotebook).toHaveBeenCalledWith({
      documentId: 'docs_1',
      sessionId: 'session-1',
      threadId: 'thread-3',
      topicId: 'topic-2',
    });
  });

  it('dispatches tool detail deep links through navigation helpers', () => {
    handleIncomingShareUrl(
      'lobehub://tool?identifier=lobe-source-set&apiName=readSourceFiles&toolCallId=tool-1&sessionId=session-1&threadId=thread-3&topicId=topic-2',
    );

    expect(navigateToToolDetail).toHaveBeenCalledWith({
      apiName: 'readSourceFiles',
      identifier: 'lobe-source-set',
      sessionId: 'session-1',
      threadId: 'thread-3',
      topicId: 'topic-2',
      toolCallId: 'tool-1',
    });
  });

  it('dispatches resource preview deep links through navigation helpers', () => {
    handleIncomingShareUrl(
      'https://example.com/resources?id=file_1&kind=file&sessionId=session-1&topicId=topic-2',
    );

    expect(navigateToResources).toHaveBeenCalledWith({
      openItemId: 'file_1',
      openKind: 'file',
      sessionId: 'session-1',
      topicId: 'topic-2',
    });
  });

  it('dispatches thread list deep links through navigation helpers', () => {
    handleIncomingShareUrl('https://example.com/chat/threads?sessionId=session-1&topicId=topic-2');

    expect(navigateToThreadList).toHaveBeenCalledWith({
      sessionId: 'session-1',
      topicId: 'topic-2',
    });
  });
});
