import { describe, expect, it, vi } from 'vitest';

import * as MechaModule from '@/server/modules/Mecha';

import { MobileChatService } from './index';

const findBySessionIdMock = vi.hoisted(() => vi.fn());
const findByIdOrSlugMock = vi.hoisted(() => vi.fn());
const getSessionAssignedFileContentsMock = vi.hoisted(() => vi.fn());
const findAccessibleSpaceByIdMock = vi.hoisted(() => vi.fn());

vi.mock('@/database/models/agent', () => ({
  AgentModel: class AgentModel {
    findBySessionId = findBySessionIdMock;
  },
}));

vi.mock('@/database/models/file', () => ({
  FileModel: class FileModel {
    getSessionAssignedFileContents = getSessionAssignedFileContentsMock;
  },
}));

vi.mock('@/database/models/session', () => ({
  SessionModel: class SessionModel {
    findByIdOrSlug = findByIdOrSlugMock;
  },
}));

vi.mock('@/database/models/space', () => ({
  SpaceModel: class SpaceModel {
    findAccessibleSpaceById = findAccessibleSpaceByIdMock;
  },
}));

vi.mock('@/server/modules/ModelRuntime', () => ({
  createTraceOptions: vi.fn(() => ({})),
}));

vi.mock('@/server/services/search', () => ({
  SearchService: class SearchService {},
}));

describe('MobileChatService', () => {
  it('should inject conversation-scoped files for session chats without agent config', async () => {
    findBySessionIdMock.mockResolvedValue(undefined);
    findByIdOrSlugMock.mockResolvedValue(undefined);

    const conversationFileContents = [
      {
        content: 'Conversation scoped note',
        fileId: 'file-1',
        filename: 'notes.md',
      },
    ];

    getSessionAssignedFileContentsMock.mockResolvedValue(conversationFileContents);

    const serverMessagesEngineSpy = vi
      .spyOn(MechaModule, 'serverMessagesEngine')
      .mockResolvedValue([{ content: 'hello', role: 'user' } as any]);

    const modelRuntime = {
      chat: vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [{ finish_reason: 'stop', message: { content: 'done', role: 'assistant' } }],
          }),
          { headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    };

    const service = new MobileChatService({
      modelRuntime: modelRuntime as any,
      provider: 'openai',
      requestSignal: new AbortController().signal,
      serverDB: {} as any,
      userId: 'user-1',
    });

    const response = await service.handleChat({
      messages: [{ content: 'hi', role: 'user' } as any],
      model: 'gpt-4o',
      sessionId: 'session-1',
      stream: false,
    } as any);

    expect(serverMessagesEngineSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        knowledge: expect.objectContaining({
          conversationFileContents,
        }),
      }),
    );

    await expect(response.json()).resolves.toEqual({
      choices: [{ finish_reason: 'stop', message: { content: 'done', role: 'assistant' } }],
    });
  });

  it('should reject inaccessible payload spaceId before running chat flow', async () => {
    findAccessibleSpaceByIdMock.mockResolvedValue(undefined);

    const service = new MobileChatService({
      modelRuntime: { chat: vi.fn() } as any,
      provider: 'openai',
      requestSignal: new AbortController().signal,
      serverDB: {} as any,
      userId: 'user-1',
    });

    await expect(
      service.handleChat({
        messages: [{ content: 'hi', role: 'user' } as any],
        model: 'gpt-4o',
        spaceId: 'spc_blocked',
        stream: false,
      } as any),
    ).rejects.toThrow('SPACE_ACCESS_DENIED');
  });
});
