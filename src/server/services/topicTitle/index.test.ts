import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MessageModel } from '@/database/models/message';
import { TopicModel } from '@/database/models/topic';
import { SystemAgentService } from '@/server/services/systemAgent';

import { TopicTitleService } from './index';

vi.mock('@/database/models/message', () => ({
  MessageModel: vi.fn(),
}));

vi.mock('@/database/models/topic', () => ({
  TopicModel: vi.fn(),
}));

vi.mock('@/server/services/systemAgent', () => ({
  SystemAgentService: vi.fn(),
}));

describe('TopicTitleService', () => {
  const mockFindById = vi.fn();
  const mockUpdate = vi.fn();
  const mockQuery = vi.fn();
  const mockGenerateTopicTitle = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(TopicModel).mockImplementation(
      () =>
        ({
          findById: mockFindById,
          update: mockUpdate,
        }) as any,
    );

    vi.mocked(MessageModel).mockImplementation(
      () =>
        ({
          query: mockQuery,
        }) as any,
    );

    vi.mocked(SystemAgentService).mockImplementation(
      () =>
        ({
          generateTopicTitle: mockGenerateTopicTitle,
        }) as any,
    );
  });

  it('should auto-rename placeholder prompt titles without force', async () => {
    mockFindById.mockResolvedValue({ title: 'How do I deploy this' });
    mockGenerateTopicTitle.mockResolvedValue('Deployment plan');

    const service = new TopicTitleService({} as any, 'user-1');
    const title = await service.summarizeTopicTitle({
      messages: [
        { content: 'How do I deploy this app to Fly.io?', role: 'user' },
        { content: 'Use a Dockerfile and fly launch.', role: 'assistant' },
      ],
      topicId: 'topic-1',
    });

    expect(mockGenerateTopicTitle).toHaveBeenCalledWith({
      lastAssistantContent: 'Use a Dockerfile and fly launch.',
      userPrompt: 'How do I deploy this app to Fly.io?',
    });
    expect(mockUpdate).toHaveBeenCalledWith('topic-1', { title: 'Deployment plan' });
    expect(title).toBe('Deployment plan');
  });

  it('should skip auto-rename when the topic already has a custom title', async () => {
    mockFindById.mockResolvedValue({ title: 'Release checklist' });

    const service = new TopicTitleService({} as any, 'user-1');
    const title = await service.summarizeTopicTitle({
      messages: [
        { content: 'How do I deploy this app to Fly.io?', role: 'user' },
        { content: 'Use a Dockerfile and fly launch.', role: 'assistant' },
      ],
      topicId: 'topic-1',
    });

    expect(mockGenerateTopicTitle).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(title).toBeNull();
  });

  it('should respect force=true for manual smart rename', async () => {
    mockFindById.mockResolvedValue({ title: 'Release checklist' });
    mockGenerateTopicTitle.mockResolvedValue('Fly.io deployment guide');

    const service = new TopicTitleService({} as any, 'user-1');
    const title = await service.summarizeTopicTitle({
      force: true,
      messages: [
        { content: 'How do I deploy this app to Fly.io?', role: 'user' },
        { content: 'Use a Dockerfile and fly launch.', role: 'assistant' },
      ],
      topicId: 'topic-1',
    });

    expect(mockGenerateTopicTitle).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith('topic-1', { title: 'Fly.io deployment guide' });
    expect(title).toBe('Fly.io deployment guide');
  });
});
