import type {
  ContentRouteParams,
  ConversationOriginRouteParams,
  MessageDetailPortalParams,
  MessageDetailRouteParams,
  NotebookRouteParams,
  PortalRouteName,
  PortalRouteParams,
  PortalStackEntry,
  ThreadDetailRouteParams,
  ThreadListRouteParams,
  ToolDetailRouteParams,
} from '../navigation/types';

const MAX_PORTAL_STACK_DEPTH = 8;
type PortalScreenRouteName = PortalRouteName | 'PortalContent';

const hasPortalStack = (params: unknown): params is PortalRouteParams =>
  !!params && typeof params === 'object' && 'portalStack' in params;

const trimStack = (stack: PortalStackEntry[]) => stack.slice(-MAX_PORTAL_STACK_DEPTH);

const samePortalEntry = (left: PortalStackEntry, right: PortalStackEntry) => {
  if (left.route !== right.route) return false;

  switch (left.route) {
    case 'MessageDetail': {
      return left.params.messageId === (right.params as MessageDetailPortalParams).messageId;
    }
    case 'Notebook': {
      return left.params.documentId === (right.params as NotebookRouteParams).documentId;
    }
    case 'Content': {
      return (
        left.params.openItemId === (right.params as ContentRouteParams).openItemId &&
        left.params.openKind === (right.params as ContentRouteParams).openKind &&
        left.params.openSourceSetId === (right.params as ContentRouteParams).openSourceSetId
      );
    }
    case 'ThreadDetail': {
      const leftParams = left.params as ThreadDetailRouteParams;
      const rightParams = right.params as ThreadDetailRouteParams;

      if (leftParams.threadId || rightParams.threadId) {
        return leftParams.threadId === rightParams.threadId;
      }

      return (
        leftParams.sessionId === rightParams.sessionId &&
        leftParams.sourceMessageId === rightParams.sourceMessageId &&
        leftParams.threadType === rightParams.threadType &&
        leftParams.topicId === rightParams.topicId
      );
    }
    case 'ThreadList': {
      return left.params.topicId === (right.params as ThreadListRouteParams).topicId;
    }
    case 'ToolDetail': {
      return left.params.toolCallId === (right.params as ToolDetailRouteParams).toolCallId;
    }
    default: {
      return false;
    }
  }
};

export const isPortalRouteName = (name: string): name is PortalScreenRouteName =>
  name === 'MessageDetail' ||
  name === 'Notebook' ||
  name === 'PortalContent' ||
  name === 'Content' ||
  name === 'ThreadDetail' ||
  name === 'ThreadList' ||
  name === 'ToolDetail';

export const createPortalEntry = (
  routeName: string,
  routeParams: unknown,
): PortalStackEntry | null => {
  if (!isPortalRouteName(routeName) || !routeParams || typeof routeParams !== 'object') return null;

  switch (routeName) {
    case 'MessageDetail': {
      const params = routeParams as MessageDetailRouteParams;
      return {
        params: {
          messageId: params.messageId,
          sessionId: params.sessionId,
          ...(params.threadId ? { threadId: params.threadId } : {}),
          ...(params.title ? { title: params.title } : {}),
          ...(params.topicId ? { topicId: params.topicId } : {}),
        },
        route: 'MessageDetail',
      };
    }
    case 'Notebook': {
      const params = routeParams as NotebookRouteParams;
      if (!params.documentId) return null;
      return {
        params: {
          ...(params.documentId ? { documentId: params.documentId } : {}),
          ...(params.sessionId ? { sessionId: params.sessionId } : {}),
          ...(params.threadId ? { threadId: params.threadId } : {}),
          ...(params.topicId ? { topicId: params.topicId } : {}),
        },
        route: 'Notebook',
      };
    }
    case 'PortalContent':
    case 'Content': {
      const params = routeParams as ContentRouteParams;
      if (
        !params.openItem &&
        !params.openItemId &&
        params.openSourceSetId === undefined
      ) {
        return null;
      }
      return {
        params: {
          ...(params.openItem ? { openItem: params.openItem } : {}),
          ...(params.openItemId ? { openItemId: params.openItemId } : {}),
          ...(params.openKind ? { openKind: params.openKind } : {}),
          ...(params.openSourceSetId !== undefined ? { openSourceSetId: params.openSourceSetId } : {}),
          ...(params.sessionId ? { sessionId: params.sessionId } : {}),
          ...(params.threadId ? { threadId: params.threadId } : {}),
          ...(params.topicId ? { topicId: params.topicId } : {}),
        },
        route: 'Content',
      };
    }
    case 'ThreadDetail': {
      const params = routeParams as ThreadDetailRouteParams;
      return {
        params: {
          sessionId: params.sessionId,
          ...(params.sourceMessageId ? { sourceMessageId: params.sourceMessageId } : {}),
          ...(params.threadId ? { threadId: params.threadId } : {}),
          ...(params.threadType ? { threadType: params.threadType } : {}),
          ...(params.title ? { title: params.title } : {}),
          ...(params.topicId ? { topicId: params.topicId } : {}),
        },
        route: 'ThreadDetail',
      };
    }
    case 'ThreadList': {
      const params = routeParams as ThreadListRouteParams;
      return {
        params: {
          sessionId: params.sessionId,
          topicId: params.topicId,
          ...(params.threadId ? { threadId: params.threadId } : {}),
        },
        route: 'ThreadList',
      };
    }
    case 'ToolDetail': {
      const params = routeParams as ToolDetailRouteParams;
      return {
        params: {
          ...(params.apiName ? { apiName: params.apiName } : {}),
          ...(params.arguments ? { arguments: params.arguments } : {}),
          ...(params.content ? { content: params.content } : {}),
          ...(params.error !== undefined ? { error: params.error } : {}),
          ...(params.identifier ? { identifier: params.identifier } : {}),
          ...(params.pluginState ? { pluginState: params.pluginState } : {}),
          ...(params.sessionId ? { sessionId: params.sessionId } : {}),
          ...(params.threadId ? { threadId: params.threadId } : {}),
          ...(params.title ? { title: params.title } : {}),
          ...(params.topicId ? { topicId: params.topicId } : {}),
          ...(params.toolCallId ? { toolCallId: params.toolCallId } : {}),
        },
        route: 'ToolDetail',
      };
    }
    default: {
      return null;
    }
  }
};

export const getPortalTrail = (routeName: string, routeParams: unknown) => {
  const currentEntry = createPortalEntry(routeName, routeParams);
  const currentStack = hasPortalStack(routeParams) && Array.isArray(routeParams.portalStack)
    ? routeParams.portalStack
    : [];

  if (!currentEntry) return trimStack(currentStack);
  if (currentStack.length > 0 && samePortalEntry(currentStack.at(-1)!, currentEntry)) {
    return trimStack(currentStack);
  }

  return trimStack([...currentStack, currentEntry]);
};

export const appendCurrentPortalStack = <T extends object>(
  routeName: string,
  routeParams: unknown,
  nextParams: T,
): T & PortalRouteParams => {
  const currentEntry = createPortalEntry(routeName, routeParams);
  const currentStack = hasPortalStack(routeParams) && Array.isArray(routeParams.portalStack)
    ? routeParams.portalStack
    : [];

  if (!currentEntry) return nextParams as T & PortalRouteParams;

  const nextStack =
    currentStack.length > 0 && samePortalEntry(currentStack.at(-1)!, currentEntry)
      ? trimStack(currentStack)
      : trimStack([...currentStack, currentEntry]);

  return {
    ...nextParams,
    ...(nextStack.length > 0 ? { portalStack: nextStack } : {}),
  };
};

export const createConversationOrigin = (
  params?: ConversationOriginRouteParams | null,
): ConversationOriginRouteParams | undefined => {
  if (!params) return undefined;

  const origin = {
    ...(params.sessionId ? { sessionId: params.sessionId } : {}),
    ...(params.threadId ? { threadId: params.threadId } : {}),
    ...(params.topicId ? { topicId: params.topicId } : {}),
  };

  return Object.keys(origin).length > 0 ? origin : undefined;
};

export const appendCurrentPortalStackWithOrigin = <T extends object>(
  routeName: string,
  routeParams: unknown,
  nextParams: T,
  origin?: ConversationOriginRouteParams | null,
) =>
  appendCurrentPortalStack(routeName, routeParams, {
    ...createConversationOrigin(origin),
    ...nextParams,
  });

export const getPreviousPortalTarget = (portalStack?: PortalStackEntry[]) => {
  if (!portalStack?.length) return null;

  const previous = portalStack.at(-1);
  if (!previous) return null;

  const remainingStack = portalStack.slice(0, -1);
  return {
    entry: previous,
    remainingStack,
  };
};
