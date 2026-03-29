// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { INBOX_SESSION_ID } from '@/const/session';
import { DEFAULT_AGENT_CONFIG } from '@/const/settings';
import { AgentModel } from '@/database/models/agent';
import { FileModel } from '@/database/models/file';
import { SessionModel } from '@/database/models/session';
import { SourceSetModel } from '@/database/models/sourceSet';
import { SpaceModel } from '@/database/models/space';
import { UserModel } from '@/database/models/user';
import { AgentService } from '@/server/services/agent';
import { ContentAuthorizer } from '@/server/services/content';
import { AgentSourceKind } from '@/types/sourceSet';

import { agentRouter } from '../agent';

vi.mock('@/database/models/user', () => ({
  UserModel: {
    findById: vi.fn(),
  },
}));

vi.mock('@/database/models/agent', () => ({
  AgentModel: vi.fn(),
}));

vi.mock('@/database/models/session', () => ({
  SessionModel: vi.fn(),
}));

vi.mock('@/database/models/file', () => ({
  FileModel: vi.fn(),
}));

vi.mock('@/database/models/sourceSet', () => ({
  SourceSetModel: vi.fn(),
}));

vi.mock('@/database/models/space', () => ({
  SpaceModel: vi.fn(),
}));

vi.mock('@/server/services/agent', () => ({
  AgentService: vi.fn(),
}));

vi.mock('@/server/services/content', () => ({
  ContentAuthorizer: vi.fn(),
}));

describe('agentRouter', () => {
  const userId = 'testUserId';
  let mockCtx: any;
  let agentModelMock: any;
  let sessionModelMock: any;
  let fileModelMock: any;
  let sourceSetModelMock: any;
  let contentAuthorizerMock: any;
  let agentServiceMock: any;
  let spaceModelMock: any;

  beforeEach(() => {
    vi.clearAllMocks();

    agentModelMock = {
      createAgentFiles: vi.fn(),
      attachSourceSetToAgent: vi.fn(),
      deleteAgentFile: vi.fn(),
      detachSourceSetFromAgent: vi.fn(),
      findBySessionId: vi.fn(),
      getAgentAssignedSources: vi.fn(),
      toggleFile: vi.fn(),
      setSourceSetEnabled: vi.fn(),
      update: vi.fn(),
    };
    vi.mocked(AgentModel).mockImplementation(() => agentModelMock);

    sessionModelMock = {
      findByIdOrSlug: vi.fn(),
    };
    vi.mocked(SessionModel).mockImplementation(() => sessionModelMock);

    fileModelMock = {
      query: vi.fn(),
    };
    vi.mocked(FileModel).mockImplementation(() => fileModelMock);

    sourceSetModelMock = {
      query: vi.fn(),
    };
    vi.mocked(SourceSetModel).mockImplementation(() => sourceSetModelMock);

    contentAuthorizerMock = {
      filterVisibleFileIdsForList: vi.fn(),
      filterVisibleSourceSetIdsForList: vi.fn(),
    };
    vi.mocked(ContentAuthorizer).mockImplementation(() => contentAuthorizerMock);

    spaceModelMock = {
      findAccessibleSpaceById: vi.fn(),
    };
    vi.mocked(SpaceModel).mockImplementation(() => spaceModelMock);

    agentServiceMock = {
      createInbox: vi.fn(),
    };
    vi.mocked(AgentService).mockImplementation(() => agentServiceMock);

    mockCtx = {
      userId,
      agentModel: agentModelMock,
      agentService: agentServiceMock,
      fileModel: fileModelMock,
      knowledgeBaseModel: sourceSetModelMock,
      contentAuthorizer: contentAuthorizerMock,
      sessionModel: sessionModelMock,
      spaceModel: spaceModelMock,
    };
  });

  describe('getAgentConfig', () => {
    it('should return default config if user not found when getting inbox config', async () => {
      vi.mocked(UserModel.findById).mockResolvedValue(undefined);
      sessionModelMock.findByIdOrSlug.mockResolvedValue(undefined);

      const caller = agentRouter.createCaller(mockCtx);
      const result = await caller.getAgentConfig({ sessionId: INBOX_SESSION_ID });

      expect(result).toEqual(DEFAULT_AGENT_CONFIG);
    });

    it('should create inbox session if user exists but no inbox session', async () => {
      const mockUser = { id: userId };
      const mockSession = { id: 'inboxSessionId' };

      vi.mocked(UserModel.findById).mockResolvedValue(mockUser as any);
      sessionModelMock.findByIdOrSlug.mockResolvedValue(mockSession);
      agentModelMock.findBySessionId.mockResolvedValue(DEFAULT_AGENT_CONFIG);

      const caller = agentRouter.createCaller(mockCtx);
      const result = await caller.getAgentConfig({ sessionId: INBOX_SESSION_ID });

      expect(agentServiceMock.createInbox).toHaveBeenCalled();
      expect(result).toEqual(DEFAULT_AGENT_CONFIG);
    });

    it('should find agent by session id if session exists', async () => {
      const mockSession = { id: 'session1' };
      sessionModelMock.findByIdOrSlug.mockResolvedValue(mockSession);
      agentModelMock.findBySessionId.mockResolvedValue(DEFAULT_AGENT_CONFIG);

      const caller = agentRouter.createCaller(mockCtx);
      const result = await caller.getAgentConfig({ sessionId: 'session1' });

      expect(agentModelMock.findBySessionId).toHaveBeenCalledWith('session1');
      expect(result).toEqual(DEFAULT_AGENT_CONFIG);
    });
  });

  describe('listAvailableSources', () => {
    it('should return combined knowledge bases and files', async () => {
      const mockFiles = [
        { fileType: 'text', id: 'file1', name: 'File 1', spaceId: 'space-1' },
        { fileType: 'pdf', id: 'file2', name: 'File 2', spaceId: 'space-2' },
      ];

      const mockSourceSets = [
        {
          avatar: 'avatar1',
          description: 'desc 1',
          id: 'kb1',
          name: 'Source Set 1',
          spaceId: 'space-1',
        },
        {
          avatar: 'avatar2',
          description: 'desc 2',
          id: 'kb2',
          name: 'Source Set 2',
          spaceId: 'space-2',
        },
      ];

      const mockKnowledge = {
        files: [{ id: 'file1', enabled: true }],
        sourceSets: [{ id: 'kb1', enabled: true }],
      };

      fileModelMock.query.mockResolvedValue(mockFiles);
      sourceSetModelMock.query.mockResolvedValue(mockSourceSets);
      agentModelMock.getAgentAssignedSources.mockResolvedValue(mockKnowledge);
      contentAuthorizerMock.filterVisibleFileIdsForList.mockResolvedValue(['file1', 'file2']);
      contentAuthorizerMock.filterVisibleSourceSetIdsForList.mockResolvedValue(['kb1']);

      const caller = agentRouter.createCaller(mockCtx);
      const result = await caller.listAvailableSources({ agentId: 'agent1' });

      expect(result).toEqual([
        {
          enabled: true,
          fileType: 'text',
          id: 'file1',
          name: 'File 1',
          spaceId: 'space-1',
          type: AgentSourceKind.File,
        },
        {
          enabled: false,
          fileType: 'pdf',
          id: 'file2',
          name: 'File 2',
          spaceId: 'space-2',
          type: AgentSourceKind.File,
        },
        {
          avatar: 'avatar1',
          description: 'desc 1',
          enabled: true,
          id: 'kb1',
          name: 'Source Set 1',
          spaceId: 'space-1',
          type: AgentSourceKind.SourceSet,
        },
      ]);
    });

    it('should keep disabled assigned items disabled in the modal data', async () => {
      fileModelMock.query.mockResolvedValue([
        { fileType: 'text', id: 'file1', name: 'File 1', spaceId: 'space-1' },
      ]);
      sourceSetModelMock.query.mockResolvedValue([
        {
          avatar: 'avatar1',
          description: 'desc 1',
          id: 'kb1',
          name: 'Source Set 1',
          spaceId: 'space-1',
        },
      ]);
      agentModelMock.getAgentAssignedSources.mockResolvedValue({
        files: [{ id: 'file1', enabled: false }],
        sourceSets: [{ id: 'kb1', enabled: false }],
      });
      contentAuthorizerMock.filterVisibleFileIdsForList.mockResolvedValue(['file1']);
      contentAuthorizerMock.filterVisibleSourceSetIdsForList.mockResolvedValue(['kb1']);

      const caller = agentRouter.createCaller(mockCtx);
      const result = await caller.listAvailableSources({ agentId: 'agent1' });

      expect(result).toEqual([
        {
          enabled: false,
          fileType: 'text',
          id: 'file1',
          name: 'File 1',
          spaceId: 'space-1',
          type: AgentSourceKind.File,
        },
        {
          avatar: 'avatar1',
          description: 'desc 1',
          enabled: false,
          id: 'kb1',
          name: 'Source Set 1',
          spaceId: 'space-1',
          type: AgentSourceKind.SourceSet,
        },
      ]);
    });

    it('should scope knowledge and files by the provided space', async () => {
      spaceModelMock.findAccessibleSpaceById.mockResolvedValue({ id: 'space-1' });
      fileModelMock.query.mockResolvedValue([]);
      sourceSetModelMock.query.mockResolvedValue([]);
      agentModelMock.getAgentAssignedSources.mockResolvedValue({ files: [], sourceSets: [] });
      contentAuthorizerMock.filterVisibleFileIdsForList.mockResolvedValue([]);
      contentAuthorizerMock.filterVisibleSourceSetIdsForList.mockResolvedValue([]);

      const caller = agentRouter.createCaller(mockCtx);
      await caller.listAvailableSources({ agentId: 'agent1', spaceId: 'space-1' });

      expect(spaceModelMock.findAccessibleSpaceById).toHaveBeenCalledWith('space-1');
      expect(sourceSetModelMock.query).toHaveBeenCalledWith('space-1');
      expect(fileModelMock.query).toHaveBeenCalledWith({
        showFilesInSourceSet: false,
        spaceId: 'space-1',
      });
    });
  });

  describe('createAgentFiles', () => {
    it('should create agent files', async () => {
      const mockInput = {
        agentId: 'agent1',
        fileIds: ['file1', 'file2'],
        enabled: true,
      };

      const caller = agentRouter.createCaller(mockCtx);
      await caller.createAgentFiles(mockInput);

      expect(agentModelMock.createAgentFiles).toHaveBeenCalledWith(
        mockInput.agentId,
        mockInput.fileIds,
        mockInput.enabled,
      );
    });
  });

  describe('deleteAgentFile', () => {
    it('should delete agent file', async () => {
      const mockInput = {
        agentId: 'agent1',
        fileId: 'file1',
      };

      const caller = agentRouter.createCaller(mockCtx);
      await caller.deleteAgentFile(mockInput);

      expect(agentModelMock.deleteAgentFile).toHaveBeenCalledWith(
        mockInput.agentId,
        mockInput.fileId,
      );
    });
  });

  describe('toggleFile', () => {
    it('should toggle file', async () => {
      const mockInput = {
        agentId: 'agent1',
        fileId: 'file1',
        enabled: true,
      };

      const caller = agentRouter.createCaller(mockCtx);
      await caller.toggleFile(mockInput);

      expect(agentModelMock.toggleFile).toHaveBeenCalledWith(
        mockInput.agentId,
        mockInput.fileId,
        mockInput.enabled,
      );
    });
  });

  describe('attachSourceSetToAgent', () => {
    it('should create agent knowledge base', async () => {
      const mockInput = {
        agentId: 'agent1',
        sourceSetId: 'kb1',
        enabled: true,
      };

      const caller = agentRouter.createCaller(mockCtx);
      await caller.attachSourceSetToAgent(mockInput);

      expect(agentModelMock.attachSourceSetToAgent).toHaveBeenCalledWith(
        mockInput.agentId,
        mockInput.sourceSetId,
        mockInput.enabled,
      );
    });
  });

  describe('detachSourceSetFromAgent', () => {
    it('should delete agent knowledge base', async () => {
      const mockInput = {
        agentId: 'agent1',
        sourceSetId: 'kb1',
      };

      const caller = agentRouter.createCaller(mockCtx);
      await caller.detachSourceSetFromAgent(mockInput);

      expect(agentModelMock.detachSourceSetFromAgent).toHaveBeenCalledWith(
        mockInput.agentId,
        mockInput.sourceSetId,
      );
    });
  });

  describe('setSourceSetEnabled', () => {
    it('should toggle knowledge base', async () => {
      const mockInput = {
        agentId: 'agent1',
        sourceSetId: 'kb1',
        enabled: true,
      };

      const caller = agentRouter.createCaller(mockCtx);
      await caller.setSourceSetEnabled(mockInput);

      expect(agentModelMock.setSourceSetEnabled).toHaveBeenCalledWith(
        mockInput.agentId,
        mockInput.sourceSetId,
        mockInput.enabled,
      );
    });
  });

  describe('updateAgentPinned', () => {
    it('should pin an agent', async () => {
      const mockInput = {
        id: 'agent1',
        pinned: true,
      };

      const caller = agentRouter.createCaller(mockCtx);
      await caller.updateAgentPinned(mockInput);

      expect(agentModelMock.update).toHaveBeenCalledWith(mockInput.id, { pinned: true });
    });

    it('should unpin an agent', async () => {
      const mockInput = {
        id: 'agent1',
        pinned: false,
      };

      const caller = agentRouter.createCaller(mockCtx);
      await caller.updateAgentPinned(mockInput);

      expect(agentModelMock.update).toHaveBeenCalledWith(mockInput.id, { pinned: false });
    });
  });
});
