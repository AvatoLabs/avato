import type { ChatMessage, ChatToolPayload } from '../types';
import { mergeToolPayloadsCore } from './chatHelpers';

const MOBILE_ASSISTANT_CHAIN_ACTION_MESSAGE_ID = 'mobileAssistantChainActionMessageId';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const mergeToolPayloadLists = (
  previous: ChatToolPayload[] | null | undefined,
  incoming: ChatToolPayload[] | null | undefined,
) => {
  if (!previous?.length) return incoming?.length ? [...incoming] : undefined;
  if (!incoming?.length) return [...previous];
  return mergeToolPayloadsCore(previous, incoming, { autoApproveOnResult: false });
};

const buildToolPayloadFromMessage = (message: ChatMessage) => {
  const identifier = message.plugin?.identifier || message.plugin?.apiName || 'tool';
  const apiName = message.plugin?.apiName || message.plugin?.identifier || 'tool';

  return {
    apiName,
    arguments: message.plugin?.arguments || '{}',
    id: message.toolCallId || message.id,
    identifier,
    intervention: message.pluginIntervention ?? message.plugin?.intervention,
    pluginError: message.pluginError,
    pluginState: isRecord(message.pluginState) ? message.pluginState : undefined,
    result_content: message.content !== undefined ? message.content : undefined,
    result_msg_id: message.id,
    source:
      message.plugin?.identifier?.startsWith('lobe-') || identifier.startsWith('lobe-')
        ? ('builtin' as const)
        : undefined,
    type: message.plugin?.type || 'function',
  };
};

const collapseStandaloneToolMessages = (messages: ChatMessage[]) => {
  const result: ChatMessage[] = [];
  const assistantIndexById = new Map<string, number>();

  for (const message of messages) {
    if (message.role === 'assistant') {
      assistantIndexById.set(message.id, result.length);
      result.push(message);
      continue;
    }

    if (message.role === 'tool' && message.parentId) {
      const parentIndex = assistantIndexById.get(message.parentId);

      if (parentIndex !== undefined) {
        const parent = result[parentIndex];
        const toolPayload = buildToolPayloadFromMessage(message);
        const nextTools = mergeToolPayloadLists(parent.tools, [toolPayload]);

        result[parentIndex] = {
          ...parent,
          ...(nextTools?.length ? { tools: nextTools } : {}),
        };
        continue;
      }
    }

    result.push(message);
  }

  return result;
};

const getToolLinkIds = (message: ChatMessage) =>
  (message.tools ?? []).flatMap((tool) =>
    [tool.id, tool.result_msg_id].filter(
      (value): value is string => typeof value === 'string' && value.length > 0,
    ),
  );

const mergeMessageAssets = <
  T extends {
    id: string;
  },
>(
  messages: ChatMessage[],
  key: 'fileList' | 'imageList',
): T[] | undefined => {
  const merged = new Map<string, T>();

  for (const message of messages) {
    const items = message[key] as T[] | undefined;
    if (!items?.length) continue;

    for (const item of items) {
      if (!merged.has(item.id)) {
        merged.set(item.id, item);
      }
    }
  }

  return merged.size > 0 ? [...merged.values()] : undefined;
};

const mergeAssistantToolChain = (messages: ChatMessage[]): ChatMessage => {
  const firstMessage = messages[0]!;
  const lastMessage = messages.at(-1) ?? firstMessage;
  const lastContentMessage =
    [...messages].reverse().find((message) => message.content?.trim().length) ?? lastMessage;
  const mergedTools = messages.reduce<ChatToolPayload[] | undefined>(
    (tools, message) => mergeToolPayloadLists(tools, message.tools),
    undefined,
  );
  const mergedMetadata = messages.reduce<Record<string, unknown>>((metadata, message) => {
    if (!isRecord(message.metadata)) return metadata;
    return { ...metadata, ...message.metadata };
  }, {});

  return {
    ...firstMessage,
    agentId: lastMessage.agentId ?? firstMessage.agentId,
    children: messages,
    content: lastContentMessage.content,
    error: lastMessage.error ?? firstMessage.error,
    fileList: mergeMessageAssets(messages, 'fileList'),
    imageList: mergeMessageAssets(messages, 'imageList'),
    metadata: {
      ...mergedMetadata,
      [MOBILE_ASSISTANT_CHAIN_ACTION_MESSAGE_ID]: lastMessage.id,
    },
    model: lastMessage.model ?? firstMessage.model,
    performance: lastMessage.performance ?? firstMessage.performance,
    provider: lastMessage.provider ?? firstMessage.provider,
    reasoning: lastMessage.reasoning ?? firstMessage.reasoning,
    search: lastMessage.search ?? firstMessage.search,
    tools: mergedTools ?? firstMessage.tools,
    updatedAt: lastMessage.updatedAt,
    usage: lastMessage.usage ?? firstMessage.usage,
  };
};

const collapseAssistantToolChains = (messages: ChatMessage[]) => {
  const result: ChatMessage[] = [];
  const consumedIds = new Set<string>();

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];

    if (consumedIds.has(message.id)) continue;

    if (message.role !== 'assistant') {
      result.push(message);
      continue;
    }

    const initialToolLinkIds = getToolLinkIds(message);

    if (initialToolLinkIds.length === 0) {
      result.push(message);
      continue;
    }

    const chain: ChatMessage[] = [message];
    let nextParentIds = new Set(initialToolLinkIds);

    for (let scanIndex = index + 1; scanIndex < messages.length; scanIndex += 1) {
      const candidate = messages[scanIndex];

      if (consumedIds.has(candidate.id)) continue;

      if (
        candidate.role === 'assistant' &&
        candidate.parentId &&
        nextParentIds.has(candidate.parentId)
      ) {
        chain.push(candidate);
        consumedIds.add(candidate.id);

        const candidateToolLinkIds = getToolLinkIds(candidate);
        if (candidateToolLinkIds.length === 0) break;

        nextParentIds = new Set(candidateToolLinkIds);
        continue;
      }

      break;
    }

    result.push(chain.length > 1 ? mergeAssistantToolChain(chain) : message);
  }

  return result;
};

export function buildDisplayMessagesWithGroupTasks(messages: ChatMessage[]): ChatMessage[] {
  if (messages.length === 0) return [];

  const idToMsg = new Map<string, ChatMessage>();
  for (const m of messages) idToMsg.set(m.id, m);

  const parentToTasks = new Map<string, ChatMessage[]>();
  for (const m of messages) {
    if (m.role === 'task' && m.parentId) {
      const list = parentToTasks.get(m.parentId) ?? [];
      list.push(m);
      parentToTasks.set(m.parentId, list);
    }
  }

  const taskIdsToGroup = new Set<string>();
  for (const [, taskList] of parentToTasks) {
    const agentIds = new Set(taskList.map((t) => t.agentId).filter(Boolean));
    if (agentIds.size > 1) {
      for (const t of taskList) taskIdsToGroup.add(t.id);
    }
  }

  const result: ChatMessage[] = [];
  const groupedParentIds = new Set<string>();

  for (const m of messages) {
    if (m.role !== 'task' || !m.parentId || !taskIdsToGroup.has(m.id)) {
      result.push(m);
      continue;
    }

    if (groupedParentIds.has(m.parentId)) continue;

    const taskList = parentToTasks.get(m.parentId)!;
    const parentMsg = idToMsg.get(m.parentId);
    const taskIdsStr = taskList
      .map((t) => t.id)
      .sort()
      .join('-');
    const groupTasksId = `groupTasks-${m.parentId}-${taskIdsStr}`;

    const sortedTasks = [...taskList].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    const createdAt =
      sortedTasks.length > 0 ? sortedTasks[0].createdAt : (parentMsg?.createdAt ?? m.createdAt);
    const updatedAt =
      sortedTasks.length > 0
        ? sortedTasks.at(-1)?.updatedAt || sortedTasks[0].updatedAt
        : (parentMsg?.updatedAt ?? m.updatedAt);

    result.push({
      content: '',
      createdAt,
      id: groupTasksId,
      role: 'groupTasks',
      sessionId: m.sessionId,
      tasks: sortedTasks,
      updatedAt,
    });
    groupedParentIds.add(m.parentId);
  }

  return result;
}

export function buildDisplayMessages(
  messages: ChatMessage[],
  isGroupSession = false,
): ChatMessage[] {
  const toolCollapsedMessages = collapseStandaloneToolMessages(messages);
  const assistantChainCollapsedMessages = collapseAssistantToolChains(toolCollapsedMessages);

  if (!isGroupSession) {
    return assistantChainCollapsedMessages;
  }

  return buildDisplayMessagesWithGroupTasks(assistantChainCollapsedMessages);
}

export const getAssistantChainActionMessageId = (message: ChatMessage) => {
  if (!isRecord(message.metadata)) return message.id;

  const actionMessageId = message.metadata[MOBILE_ASSISTANT_CHAIN_ACTION_MESSAGE_ID];

  return typeof actionMessageId === 'string' && actionMessageId.length > 0
    ? actionMessageId
    : message.id;
};
