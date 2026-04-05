import type * as ModelBankModule from 'model-bank';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AiAgentService } from '../index';

const {
  mockCreateOperation,
  mockFindAccessibleSpaceById,
  mockGetAgentConfig,
  mockGetLatestPersonaDocument,
  mockGetUserMessagesQueryForTopic,
  mockGetUserSettings,
  mockListPublishedRecallEntries,
  mockMessageCreate,
  mockMessageQuery,
  mockTopicCreate,
  mockTopicFindById,
} = vi.hoisted(() => ({
  mockCreateOperation: vi.fn(),
  mockFindAccessibleSpaceById: vi.fn(),
  mockGetAgentConfig: vi.fn(),
  mockGetLatestPersonaDocument: vi.fn(),
  mockGetUserMessagesQueryForTopic: vi.fn(),
  mockGetUserSettings: vi.fn(),
  mockListPublishedRecallEntries: vi.fn(),
  mockMessageCreate: vi.fn(),
  mockMessageQuery: vi.fn(),
  mockTopicCreate: vi.fn(),
  mockTopicFindById: vi.fn(),
}));

vi.mock('@/libs/trusted-client', () => ({
  generateTrustedClientToken: vi.fn().mockReturnValue(undefined),
  getTrustedClientTokenForSession: vi.fn().mockResolvedValue(undefined),
  isTrustedClientEnabled: vi.fn().mockReturnValue(false),
}));

vi.mock('@/database/models/message', () => ({
  MessageModel: vi.fn().mockImplementation(() => ({
    create: mockMessageCreate,
    query: mockMessageQuery,
    update: vi.fn().mockResolvedValue({}),
  })),
}));

vi.mock('@/database/models/agent', () => ({
  AgentModel: vi.fn().mockImplementation(() => ({
    getAgentConfig: vi.fn(),
  })),
}));

vi.mock('@/server/services/agent', () => ({
  AgentService: vi.fn().mockImplementation(() => ({
    getAgentConfig: mockGetAgentConfig,
  })),
}));

vi.mock('@/database/models/plugin', () => ({
  PluginModel: vi.fn().mockImplementation(() => ({
    query: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock('@/database/models/topic', () => ({
  TopicModel: vi.fn().mockImplementation(() => ({
    create: mockTopicCreate,
    findById: mockTopicFindById,
  })),
}));

vi.mock('@/database/repositories/userMemory', () => ({
  UserMemoryTopicRepository: vi.fn().mockImplementation(() => ({
    getUserMessagesQueryForTopic: mockGetUserMessagesQueryForTopic,
  })),
}));

vi.mock('@/database/models/space', () => ({
  SpaceModel: vi.fn().mockImplementation(() => ({
    findAccessibleSpaceById: mockFindAccessibleSpaceById,
  })),
}));

vi.mock('@/database/models/spaceMemory', () => ({
  SpaceMemoryModel: vi.fn().mockImplementation(() => ({
    listPublishedRecallEntries: mockListPublishedRecallEntries,
  })),
}));

vi.mock('@/database/models/user', () => ({
  UserModel: vi.fn().mockImplementation(() => ({
    getUserSettings: mockGetUserSettings,
  })),
}));

vi.mock('@/database/models/userMemory/persona', () => ({
  UserPersonaModel: vi.fn().mockImplementation(() => ({
    getLatestPersonaDocument: mockGetLatestPersonaDocument,
  })),
}));

vi.mock('@/database/models/thread', () => ({
  ThreadModel: vi.fn().mockImplementation(() => ({
    create: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
  })),
}));

vi.mock('@/server/services/agentRuntime', () => ({
  AgentRuntimeService: vi.fn().mockImplementation(() => ({
    createOperation: mockCreateOperation,
  })),
}));

vi.mock('@/server/services/market', () => ({
  MarketService: vi.fn().mockImplementation(() => ({
    getLobehubSkillManifests: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock('@/server/services/klavis', () => ({
  KlavisService: vi.fn().mockImplementation(() => ({
    getKlavisManifests: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock('@/server/services/file', () => ({
  FileService: vi.fn().mockImplementation(() => ({
    uploadFromUrl: vi.fn(),
  })),
}));

vi.mock('@/server/modules/Mecha', () => ({
  createServerAgentToolsEngine: vi.fn().mockReturnValue({
    generateToolsDetailed: vi.fn().mockReturnValue({ enabledToolIds: [], tools: [] }),
    getEnabledPluginManifests: vi.fn().mockReturnValue(new Map()),
  }),
  serverMessagesEngine: vi.fn().mockResolvedValue([{ content: 'test', role: 'user' }]),
}));

vi.mock('@/server/services/toolExecution/deviceProxy', () => ({
  deviceProxy: {
    isConfigured: false,
    queryDeviceList: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('model-bank', async (importOriginal) => {
  const actual = await importOriginal<typeof ModelBankModule>();
  return {
    ...actual,
    LOBE_DEFAULT_MODEL_LIST: [
      {
        abilities: { functionCall: true, video: false, vision: true },
        id: 'gpt-4',
        providerId: 'openai',
      },
    ],
  };
});

const publishedSpaceMemories = [
  {
    category: 'general',
    content: 'During active Sev1 incidents, pause all non-emergency deploys.',
    id: 'sm-general-1',
    summary: 'Deploys pause during incident review.',
    title: 'Release window',
    updatedAt: '2026-04-04T09:00:00.000Z',
  },
  {
    category: 'playbook',
    content: 'Assign a named rollback owner before rollout.',
    id: 'sm-playbook-1',
    summary: 'Practice rollback owner assignment.',
    title: 'Rollback drill',
    updatedAt: '2026-04-04T09:10:00.000Z',
  },
  {
    category: 'policy',
    content: 'Do not promise an ETA without incident commander approval.',
    id: 'sm-policy-1',
    summary: 'Customer ETA commitments require approval.',
    title: 'Customer comms',
    updatedAt: '2026-04-04T09:20:00.000Z',
  },
] as const;

describe('AiAgentService.execAgent - team space memory recall', () => {
  let service: AiAgentService;

  beforeEach(() => {
    vi.clearAllMocks();

    mockGetAgentConfig.mockResolvedValue({
      chatConfig: {},
      files: [],
      id: 'agent-1',
      model: 'gpt-4',
      plugins: [],
      provider: 'openai',
      sourceSets: [],
      systemRole: 'You are a helpful assistant',
    });
    mockGetLatestPersonaDocument.mockResolvedValue({
      persona: 'A team-aware engineer who prefers operational clarity.',
      tagline: 'OSS maintainer',
      version: 1,
    });
    mockGetUserSettings.mockResolvedValue({
      general: { timezone: 'Asia/Shanghai' },
      memory: { enabled: true },
    });
    mockGetUserMessagesQueryForTopic.mockImplementation(async (topicId: string) =>
      topicId === 'topic-existing'
        ? 'We are discussing rollback planning for the current production deploy.'
        : null,
    );
    mockCreateOperation.mockResolvedValue({
      autoStarted: true,
      messageId: 'queue-msg-1',
      operationId: 'op-123',
      success: true,
    });
    mockListPublishedRecallEntries.mockResolvedValue([...publishedSpaceMemories]);
    mockFindAccessibleSpaceById.mockResolvedValue({
      id: 'spc_team',
      kind: 'team',
      membershipRole: 'owner',
      name: 'Ops Space',
    });
    mockMessageCreate.mockResolvedValue({ id: 'msg-1' });
    mockMessageQuery.mockResolvedValue([]);
    mockTopicCreate.mockResolvedValue({ id: 'topic-new' });
    mockTopicFindById.mockResolvedValue({ id: 'topic-existing', spaceId: 'spc_topic_team' });

    service = new AiAgentService({} as any, 'user-1');
  });

  it('injects published team space memories when appContext.spaceId is provided', async () => {
    await service.execAgent({
      agentId: 'agent-1',
      appContext: { spaceId: 'spc_team' },
      prompt: 'Should we keep deploying during this incident?',
    });

    expect(mockFindAccessibleSpaceById).toHaveBeenCalledWith('spc_team');
    expect(mockListPublishedRecallEntries).toHaveBeenCalledWith({
      query: 'Should we keep deploying during this incident?',
      spaceId: 'spc_team',
    });

    const createOperationArgs = mockCreateOperation.mock.calls[0][0];
    expect(createOperationArgs.userMemory).toMatchObject({
      memories: {
        persona: {
          narrative: 'A team-aware engineer who prefers operational clarity.',
          tagline: 'OSS maintainer',
        },
      },
    });
    expect(createOperationArgs.userMemory.memories.contexts).toEqual([
      expect.objectContaining({
        description: expect.stringContaining('Deploys pause during incident review.'),
        id: 'sm-general-1',
        title: 'Release window',
      }),
    ]);
    expect(createOperationArgs.userMemory.memories.experiences).toEqual([
      expect.objectContaining({
        action: expect.stringContaining('Assign a named rollback owner before rollout.'),
        id: 'sm-playbook-1',
        keyLearning: expect.stringContaining('Assign a named rollback owner before rollout.'),
        situation: 'Rollback drill',
      }),
    ]);
    expect(createOperationArgs.userMemory.memories.preferences).toEqual([
      expect.objectContaining({
        conclusionDirectives: expect.stringContaining('Customer comms'),
        id: 'sm-policy-1',
        suggestions: expect.stringContaining('Customer ETA commitments require approval.'),
      }),
    ]);
  });

  it('falls back to topic.spaceId when appContext.spaceId is missing', async () => {
    await service.execAgent({
      agentId: 'agent-1',
      appContext: { topicId: 'topic-existing' },
      prompt: 'What is our rollback practice?',
    });

    expect(mockGetUserMessagesQueryForTopic).toHaveBeenCalledWith('topic-existing');
    expect(mockTopicFindById).toHaveBeenCalledWith('topic-existing');
    expect(mockFindAccessibleSpaceById).toHaveBeenCalledWith('spc_topic_team');
    expect(mockListPublishedRecallEntries).toHaveBeenCalledWith({
      query: expect.stringContaining('rollback planning'),
      spaceId: 'spc_topic_team',
    });
    expect(mockListPublishedRecallEntries).toHaveBeenCalledWith({
      query: expect.stringContaining('What is our rollback practice?'),
      spaceId: 'spc_topic_team',
    });
  });

  it('skips published recall for personal spaces', async () => {
    mockFindAccessibleSpaceById.mockResolvedValue({
      id: 'spc_personal',
      kind: 'personal',
      membershipRole: 'owner',
      name: 'My Space',
    });

    await service.execAgent({
      agentId: 'agent-1',
      appContext: { spaceId: 'spc_personal' },
      prompt: 'Hello',
    });

    expect(mockListPublishedRecallEntries).not.toHaveBeenCalled();

    const createOperationArgs = mockCreateOperation.mock.calls[0][0];
    expect(createOperationArgs.userMemory.memories.contexts).toEqual([]);
    expect(createOperationArgs.userMemory.memories.experiences).toEqual([]);
    expect(createOperationArgs.userMemory.memories.preferences).toEqual([]);
    expect(createOperationArgs.userMemory.memories.persona).toEqual({
      narrative: 'A team-aware engineer who prefers operational clarity.',
      tagline: 'OSS maintainer',
    });
  });
});
