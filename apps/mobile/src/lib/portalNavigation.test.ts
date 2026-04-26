import { describe, expect, it } from 'vitest';

import {
  appendCurrentPortalStack,
  appendCurrentPortalStackWithOrigin,
  createConversationOrigin,
  createPortalEntry,
  getPortalTrail,
  getPreviousPortalTarget,
} from './portalNavigation';

describe('portalNavigation', () => {
  it('creates a stack entry for message detail routes', () => {
    expect(
      createPortalEntry('MessageDetail', {
        messageId: 'msg-1',
        sessionId: 'session-1',
        threadId: 'thread-1',
        title: 'Long reply',
        topicId: 'topic-1',
      }),
    ).toEqual({
      params: {
        messageId: 'msg-1',
        sessionId: 'session-1',
        threadId: 'thread-1',
        title: 'Long reply',
        topicId: 'topic-1',
      },
      route: 'MessageDetail',
    });
  });

  it('appends the current portal route when navigating deeper', () => {
    expect(
      appendCurrentPortalStack(
        'ToolDetail',
        {
          apiName: 'readSourceFiles',
          identifier: 'lobe-source-set',
          portalStack: [
            {
              params: {
                messageId: 'msg-1',
                sessionId: 'session-1',
              },
              route: 'MessageDetail' as const,
            },
          ],
          sessionId: 'session-1',
          toolCallId: 'tool-1',
        },
        {
          documentId: 'doc-1',
          sessionId: 'session-1',
        },
      ),
    ).toEqual({
      documentId: 'doc-1',
      portalStack: [
        {
          params: {
            messageId: 'msg-1',
            sessionId: 'session-1',
          },
          route: 'MessageDetail',
        },
        {
          params: {
            apiName: 'readSourceFiles',
            identifier: 'lobe-source-set',
            sessionId: 'session-1',
            toolCallId: 'tool-1',
          },
          route: 'ToolDetail',
        },
      ],
      sessionId: 'session-1',
    });
  });

  it('returns the previous portal target and remaining stack', () => {
    expect(
      getPreviousPortalTarget([
        {
          params: {
            messageId: 'msg-1',
            sessionId: 'session-1',
          },
          route: 'MessageDetail',
        },
        {
          params: {
            documentId: 'doc-1',
            sessionId: 'session-1',
          },
          route: 'Notebook',
        },
      ]),
    ).toEqual({
      entry: {
        params: {
          documentId: 'doc-1',
          sessionId: 'session-1',
        },
        route: 'Notebook',
      },
      remainingStack: [
        {
          params: {
            messageId: 'msg-1',
            sessionId: 'session-1',
          },
          route: 'MessageDetail',
        },
      ],
    });
  });

  it('omits notebook root routes without a document identity from the trail', () => {
    expect(
      getPortalTrail('Notebook', {
        sessionId: 'session-1',
      }),
    ).toEqual([]);
  });

  it('creates a stack entry for thread list routes', () => {
    expect(
      createPortalEntry('ThreadList', {
        sessionId: 'session-1',
        topicId: 'topic-1',
      }),
    ).toEqual({
      params: {
        sessionId: 'session-1',
        topicId: 'topic-1',
      },
      route: 'ThreadList',
    });
  });

  it('normalizes conversation origin params by dropping undefined values', () => {
    expect(
      createConversationOrigin({
        sessionId: 'session-1',
        threadId: undefined,
        topicId: 'topic-1',
      }),
    ).toEqual({
      sessionId: 'session-1',
      topicId: 'topic-1',
    });
  });

  it('appends stack entries while merging conversation origin into next params', () => {
    expect(
      appendCurrentPortalStackWithOrigin(
        'ToolDetail',
        {
          identifier: 'lobe-source-set',
          portalStack: [
            {
              params: {
                messageId: 'msg-1',
                sessionId: 'session-1',
              },
              route: 'MessageDetail' as const,
            },
          ],
          sessionId: 'session-1',
          toolCallId: 'tool-1',
        },
        {
          documentId: 'doc-1',
        },
        {
          sessionId: 'session-1',
          topicId: 'topic-1',
        },
      ),
    ).toEqual({
      documentId: 'doc-1',
      portalStack: [
        {
          params: {
            messageId: 'msg-1',
            sessionId: 'session-1',
          },
          route: 'MessageDetail',
        },
        {
          params: {
            identifier: 'lobe-source-set',
            sessionId: 'session-1',
            toolCallId: 'tool-1',
          },
          route: 'ToolDetail',
        },
      ],
      sessionId: 'session-1',
      topicId: 'topic-1',
    });
  });
});
