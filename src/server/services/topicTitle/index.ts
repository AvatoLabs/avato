import { MessageModel } from '@/database/models/message';
import { TopicModel } from '@/database/models/topic';
import { type LobeChatDatabase } from '@/database/type';

import { SystemAgentService } from '../systemAgent';
import {
  pickLatestTitleContext,
  type TitleContextMessage,
  type TitleGenerationContext,
} from './titleContext';

const DEFAULT_TOPIC_TITLES = new Set([
  '',
  '...',
  'Default Topic',
  'New Chat',
  'New Conversation',
  'New Session',
  'Topics',
  'Untitled',
  '新會話',
  '新会话',
  '新對話',
  '新对话',
  '新話題',
  '新话题',
  '話題',
  '话题',
]);

const normalizeTitle = (value?: string | null) => value?.trim().replaceAll(/\s+/g, ' ') ?? '';

const buildPromptPlaceholderTitles = (userPrompt: string) => {
  const normalizedPrompt = normalizeTitle(userPrompt);
  const placeholders = new Set<string>();

  if (!normalizedPrompt) return placeholders;

  placeholders.add(normalizedPrompt);

  for (const length of [20, 50]) {
    const sliced = normalizedPrompt.slice(0, length).trim();
    if (!sliced) continue;

    placeholders.add(sliced);

    if (normalizedPrompt.length > length) {
      placeholders.add(`${sliced}...`);
    }
  }

  return placeholders;
};

export const shouldAutoRenameTopicTitle = (params: {
  title?: string | null;
  userPrompt?: string | null;
}) => {
  const currentTitle = normalizeTitle(params.title);
  if (!currentTitle || DEFAULT_TOPIC_TITLES.has(currentTitle)) return true;

  const normalizedPrompt = normalizeTitle(params.userPrompt);
  if (!normalizedPrompt) return false;

  return buildPromptPlaceholderTitles(normalizedPrompt).has(currentTitle);
};

interface SummarizeTopicTitleParams {
  force?: boolean;
  lastAssistantContent?: string | null;
  messages?: TitleContextMessage[];
  topicId: string;
  userPrompt?: string | null;
}

export class TopicTitleService {
  private readonly messageModel: MessageModel;
  private readonly systemAgent: SystemAgentService;
  private readonly topicModel: TopicModel;

  constructor(db: LobeChatDatabase, userId: string) {
    this.messageModel = new MessageModel(db, userId);
    this.systemAgent = new SystemAgentService(db, userId);
    this.topicModel = new TopicModel(db, userId);
  }

  async summarizeTopicTitle(params: SummarizeTopicTitleParams): Promise<string | null> {
    const { force = false, topicId } = params;
    const topic = await this.topicModel.findById(topicId);
    if (!topic) return null;

    const titleContext = await this.resolveTitleContext(params);
    if (!titleContext) return null;

    if (
      !force &&
      !shouldAutoRenameTopicTitle({
        title: topic.title,
        userPrompt: titleContext.userPrompt,
      })
    ) {
      return null;
    }

    const title = await this.systemAgent.generateTopicTitle(titleContext);
    if (!title) return null;

    if (normalizeTitle(topic.title) === normalizeTitle(title)) return title;

    await this.topicModel.update(topicId, { title });

    return title;
  }

  private async resolveTitleContext(
    params: SummarizeTopicTitleParams,
  ): Promise<TitleGenerationContext | null> {
    const normalizedPrompt = normalizeTitle(params.userPrompt);
    const normalizedAssistantContent = normalizeTitle(params.lastAssistantContent);

    if (normalizedPrompt && normalizedAssistantContent) {
      return {
        lastAssistantContent: normalizedAssistantContent,
        userPrompt: normalizedPrompt,
      };
    }

    if ((params.messages?.length ?? 0) > 0) {
      return pickLatestTitleContext(params.messages);
    }

    const messages = await this.messageModel.query({ topicId: params.topicId });
    return pickLatestTitleContext(messages);
  }
}
