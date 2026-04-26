import { type LobeChatDatabase } from '@lobechat/database';

import { MessageModel } from '@/database/models/message';
import { TopicModel } from '@/database/models/topic';
import { createAuthenticatedAttachmentUrlResolver } from '@/server/services/message/createAuthenticatedAttachmentUrlResolver';
import { normalizeMessageFileUrlsForClient } from '@/server/services/message/normalizeMessageFileUrls';

export class AiChatService {
  private messageModel: MessageModel;
  private topicModel: TopicModel;

  constructor(serverDB: LobeChatDatabase, userId: string) {
    this.messageModel = new MessageModel(serverDB, userId);
    this.topicModel = new TopicModel(serverDB, userId);
  }

  async getMessagesAndTopics(params: {
    agentId?: string;
    current?: number;
    groupId?: string;
    includeTopic?: boolean;
    pageSize?: number;
    sessionId?: string;
    threadId?: string;
    topicId?: string;
  }) {
    const [messages, topics] = await Promise.all([
      this.messageModel.query(params, {
        postProcessUrl: createAuthenticatedAttachmentUrlResolver(),
      }),
      params.includeTopic
        ? this.topicModel.query({ agentId: params.agentId, groupId: params.groupId })
        : undefined,
    ]);

    return { messages: normalizeMessageFileUrlsForClient(messages), topics };
  }
}
