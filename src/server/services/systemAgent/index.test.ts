import { chainSummaryTitle } from '@lobechat/prompts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { initModelRuntimeFromDB } from '@/server/modules/ModelRuntime';

import { SystemAgentService } from './index';

const {
  mockChainSummaryTitle,
  mockGenerateObject,
  mockGetInfoForAIGeneration,
  mockGetServerGlobalConfig,
  mockGetUserSettings,
  mockInitModelRuntimeFromDB,
} = vi.hoisted(() => ({
  mockChainSummaryTitle: vi.fn(),
  mockGenerateObject: vi.fn(),
  mockGetInfoForAIGeneration: vi.fn(),
  mockGetServerGlobalConfig: vi.fn(),
  mockGetUserSettings: vi.fn(),
  mockInitModelRuntimeFromDB: vi.fn(),
}));

vi.mock('debug', () => ({
  default: () => vi.fn(),
}));

vi.mock('@lobechat/prompts', () => ({
  chainSummaryTitle: mockChainSummaryTitle,
}));

vi.mock('@/database/models/user', () => ({
  UserModel: Object.assign(
    vi.fn(() => ({
      getUserSettings: mockGetUserSettings,
    })),
    {
      getInfoForAIGeneration: mockGetInfoForAIGeneration,
    },
  ),
}));

vi.mock('@/server/globalConfig', () => ({
  getServerGlobalConfig: mockGetServerGlobalConfig,
}));

vi.mock('@/server/modules/ModelRuntime', () => ({
  initModelRuntimeFromDB: mockInitModelRuntimeFromDB,
}));

describe('SystemAgentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockChainSummaryTitle.mockReturnValue({
      messages: [{ content: 'summarize this conversation', role: 'system' }],
    });
    mockGetInfoForAIGeneration.mockResolvedValue({ responseLanguage: 'zh-CN' });
    mockGetServerGlobalConfig.mockResolvedValue({});
    mockGetUserSettings.mockResolvedValue(undefined);
    mockInitModelRuntimeFromDB.mockResolvedValue({
      generateObject: mockGenerateObject,
    });
  });

  it('should read title from a direct structured response', async () => {
    mockGenerateObject.mockResolvedValue({ title: '部署计划' });

    const service = new SystemAgentService({} as any, 'user-1');
    const title = await service.generateTopicTitle({
      lastAssistantContent: '可以先准备 Dockerfile，再执行 fly launch。',
      userPrompt: '怎么把这个应用部署到 Fly.io？',
    });

    expect(title).toBe('部署计划');
    expect(chainSummaryTitle).toHaveBeenCalledWith(
      [
        { content: '怎么把这个应用部署到 Fly.io？', role: 'user' },
        { content: '可以先准备 Dockerfile，再执行 fly launch。', role: 'assistant' },
      ],
      'zh-CN',
    );
    expect(initModelRuntimeFromDB).toHaveBeenCalledWith({} as any, 'user-1', 'openai');
  });

  it('should read title from tool-calling fallback output', async () => {
    mockGenerateObject.mockResolvedValue([
      {
        arguments: { title: 'Fly.io 部署指南' },
        name: 'topic_title',
      },
    ]);

    const service = new SystemAgentService({} as any, 'user-1');
    const title = await service.generateTopicTitle({
      lastAssistantContent: '可以先准备 Dockerfile，再执行 fly launch。',
      userPrompt: '怎么把这个应用部署到 Fly.io？',
    });

    expect(title).toBe('Fly.io 部署指南');
  });

  it('should return null when tool-calling output does not contain a valid title', async () => {
    mockGenerateObject.mockResolvedValue([
      {
        arguments: { summary: 'missing title field' },
        name: 'topic_title',
      },
    ]);

    const service = new SystemAgentService({} as any, 'user-1');
    const title = await service.generateTopicTitle({
      lastAssistantContent: '可以先准备 Dockerfile，再执行 fly launch。',
      userPrompt: '怎么把这个应用部署到 Fly.io？',
    });

    expect(title).toBeNull();
  });

  it('should use user system-agent settings when available', async () => {
    mockGetUserSettings.mockResolvedValue({
      systemAgent: {
        topic: {
          model: 'deepseek-chat',
          provider: 'deepseek',
        },
      },
    });
    mockGenerateObject.mockResolvedValue([
      {
        arguments: { title: 'DeepSeek 标题' },
        name: 'topic_title',
      },
    ]);

    const service = new SystemAgentService({} as any, 'user-1');
    const title = await service.generateTopicTitle({
      lastAssistantContent: '可以先准备 Dockerfile，再执行 fly launch。',
      userPrompt: '怎么把这个应用部署到 Fly.io？',
    });

    expect(title).toBe('DeepSeek 标题');
    expect(initModelRuntimeFromDB).toHaveBeenCalledWith({} as any, 'user-1', 'deepseek');
    expect(mockGenerateObject).toHaveBeenCalledWith({
      messages: [{ content: 'summarize this conversation', role: 'system' }],
      model: 'deepseek-chat',
      schema: {
        name: 'topic_title',
        schema: {
          additionalProperties: false,
          properties: {
            title: { description: 'A concise topic title', type: 'string' },
          },
          required: ['title'],
          type: 'object',
        },
        strict: true,
      },
    });
  });
});
