import { DEFAULT_PROVIDER } from '@lobechat/business-const';
import {
  DEFAULT_AGENT_CONFIG,
  DEFAULT_AVATAR,
  DEFAULT_MODEL,
  DEFAUTT_AGENT_TTS_CONFIG,
  INBOX_SESSION_ID,
} from '@lobechat/const';
import { AgentSourceKind } from '@lobechat/types';
import { describe, expect, it, vi } from 'vitest';

import { type AgentStoreState } from '@/store/agent/initialState';
import { initialAgentSliceState } from '@/store/agent/slices/agent/initialState';
import { initialBuiltinAgentSliceState } from '@/store/agent/slices/builtin';

import { agentSelectors, currentAgentConfig } from './selectors';

// Mock VoiceList
vi.mock('@lobehub/tts', () => ({
  VoiceList: class {
    static openaiVoiceOptions = [{ value: 'alloy' }];
    edgeVoiceOptions = [{ value: 'edge-voice' }];
    microsoftVoiceOptions = [{ value: 'microsoft-voice' }];
  },
}));

const createState = (overrides: Partial<AgentStoreState> = {}): AgentStoreState => ({
  ...initialAgentSliceState,
  ...initialBuiltinAgentSliceState,
  ...overrides,
});

describe('agentSelectors', () => {
  describe('currentAgentConfig', () => {
    it('should return agent config from agentMap', () => {
      const state = createState({
        activeAgentId: 'agent-1',
        agentMap: {
          'agent-1': { model: 'gpt-4', systemRole: 'Test role' } as any,
        },
      });

      const config = currentAgentConfig(state);

      expect(config.model).toBe('gpt-4');
      expect(config.systemRole).toBe('Test role');
    });

    it('should return undefined when no agent config exists', () => {
      const state = createState({
        activeAgentId: 'non-existent',
        agentMap: {},
      });

      const config = currentAgentConfig(state);

      expect(config).toBeUndefined();
    });
  });

  describe('currentAgentModel', () => {
    it('should return model from current agent config', () => {
      const state = createState({
        activeAgentId: 'agent-1',
        agentMap: { 'agent-1': { model: 'gpt-4o' } },
      });

      expect(agentSelectors.currentAgentModel(state)).toBe('gpt-4o');
    });

    it('should return default model when not specified', () => {
      const state = createState({
        activeAgentId: 'agent-1',
        agentMap: { 'agent-1': {} },
      });

      expect(agentSelectors.currentAgentModel(state)).toBe(DEFAULT_MODEL);
    });
  });

  describe('currentAgentModelProvider', () => {
    it('should return provider from current agent config', () => {
      const state = createState({
        activeAgentId: 'agent-1',
        agentMap: { 'agent-1': { provider: 'anthropic' } },
      });

      expect(agentSelectors.currentAgentModelProvider(state)).toBe('anthropic');
    });

    it('should return default provider when not specified', () => {
      const state = createState({
        activeAgentId: 'agent-1',
        agentMap: { 'agent-1': {} },
      });

      expect(agentSelectors.currentAgentModelProvider(state)).toBe(DEFAULT_PROVIDER);
    });
  });

  describe('currentAgentMeta', () => {
    it('should return complete meta data', () => {
      const state = createState({
        activeAgentId: 'agent-1',
        agentMap: {
          'agent-1': {
            avatar: '🤖',
            backgroundColor: '#ff0000',
            description: 'Test agent',
            marketIdentifier: 'test-market-id',
            tags: ['tag1', 'tag2'],
            title: 'Test Agent',
          },
        },
      });

      const meta = agentSelectors.currentAgentMeta(state);

      expect(meta).toEqual({
        avatar: '🤖',
        backgroundColor: '#ff0000',
        description: 'Test agent',
        marketIdentifier: 'test-market-id',
        tags: ['tag1', 'tag2'],
        title: 'Test Agent',
      });
    });

    it('should return default values for missing fields', () => {
      const state = createState({
        activeAgentId: 'agent-1',
        agentMap: { 'agent-1': {} },
      });

      const meta = agentSelectors.currentAgentMeta(state);

      expect(meta.avatar).toBe(DEFAULT_AVATAR);
    });

    it('should force inbox title to Avato when active agent is builtin inbox', () => {
      const state = createState({
        activeAgentId: 'agent-inbox',
        agentMap: {
          'agent-inbox': {
            slug: INBOX_SESSION_ID,
            title: 'Dirty Inbox Title',
          } as any,
        },
        builtinAgentIdMap: { [INBOX_SESSION_ID]: 'agent-inbox' },
      });

      const meta = agentSelectors.currentAgentMeta(state);

      expect(meta.title).toBe('Avato');
    });
  });

  describe('currentAgentTitle', () => {
    it('should force inbox title to Avato when slug is inbox', () => {
      const state = createState({
        activeAgentId: 'agent-inbox',
        agentMap: {
          'agent-inbox': {
            slug: INBOX_SESSION_ID,
            title: 'Dirty Inbox Title',
          } as any,
        },
      });

      expect(agentSelectors.currentAgentTitle(state)).toBe('Avato');
    });
  });

  describe('getAgentMetaById', () => {
    it('should return meta for specified agent', () => {
      const state = createState({
        agentMap: {
          'agent-1': { title: 'Agent 1' },
          'agent-2': { title: 'Agent 2' },
        },
      });

      const meta = agentSelectors.getAgentMetaById('agent-2')(state);

      expect(meta.title).toBe('Agent 2');
    });

    it('should return empty object for non-existent agent', () => {
      const state = createState({
        agentMap: {},
      });

      const meta = agentSelectors.getAgentMetaById('non-existent')(state);

      expect(meta).toEqual({});
    });
  });

  describe('currentAgentPlugins', () => {
    it('should return plugins array', () => {
      const state = createState({
        activeAgentId: 'agent-1',
        agentMap: { 'agent-1': { plugins: ['plugin-1', 'plugin-2'] } },
      });

      expect(agentSelectors.currentAgentPlugins(state)).toEqual(['plugin-1', 'plugin-2']);
    });

    it('should return empty array when no plugins', () => {
      const state = createState({
        activeAgentId: 'agent-1',
        agentMap: { 'agent-1': {} },
      });

      expect(agentSelectors.currentAgentPlugins(state)).toEqual([]);
    });
  });

  describe('currentAgentSourceSets', () => {
    it('should return source-set array', () => {
      const state = createState({
        activeAgentId: 'agent-1',
        agentMap: {
          'agent-1': {
            sourceSets: [
              { enabled: true, id: 'kb-1', name: 'KB 1' },
              { enabled: false, id: 'kb-2', name: 'KB 2' },
            ],
          } as any,
        },
      });

      expect(agentSelectors.currentAgentSourceSets(state)).toHaveLength(2);
    });

    it('should return empty array when no source sets', () => {
      const state = createState({
        activeAgentId: 'agent-1',
        agentMap: { 'agent-1': {} },
      });

      expect(agentSelectors.currentAgentSourceSets(state)).toEqual([]);
    });
  });

  describe('currentAgentFiles', () => {
    it('should return files array', () => {
      const state = createState({
        activeAgentId: 'agent-1',
        agentMap: {
          'agent-1': {
            files: [{ enabled: true, id: 'file-1', name: 'file1.txt', type: 'text/plain' }],
          } as any,
        },
      });

      expect(agentSelectors.currentAgentFiles(state)).toHaveLength(1);
    });
  });

  describe('currentEnabledSources', () => {
    it('should return only enabled source items', () => {
      const state = createState({
        activeAgentId: 'agent-1',
        agentMap: {
          'agent-1': {
            files: [
              {
                enabled: true,
                id: 'file-1',
                name: 'file1.txt',
                spaceId: 'space-1',
                type: 'text/plain',
              },
              { enabled: false, id: 'file-2', name: 'file2.txt', type: 'text/plain' },
            ],
            sourceSets: [
              { enabled: true, id: 'kb-1', name: 'KB 1', spaceId: 'space-2' },
              { enabled: false, id: 'kb-2', name: 'KB 2' },
            ],
          } as any,
        },
      });

      const enabledSources = agentSelectors.currentEnabledSources(state);

      expect(enabledSources).toHaveLength(2);
      expect(enabledSources[0].type).toBe(AgentSourceKind.File);
      expect(enabledSources[0].spaceId).toBe('space-1');
      expect(enabledSources[1].type).toBe(AgentSourceKind.SourceSet);
      expect(enabledSources[1].spaceId).toBe('space-2');
    });
  });

  describe('hasSystemRole', () => {
    it('should return true when system role exists', () => {
      const state = createState({
        activeAgentId: 'agent-1',
        agentMap: { 'agent-1': { systemRole: 'You are a helpful assistant' } },
      });

      expect(agentSelectors.hasSystemRole(state)).toBe(true);
    });

    it('should return false when system role is empty', () => {
      const state = createState({
        activeAgentId: 'agent-1',
        agentMap: { 'agent-1': { systemRole: '' } },
      });

      expect(agentSelectors.hasSystemRole(state)).toBe(false);
    });
  });

  describe('hasSources', () => {
    it('should return true when source sets exist', () => {
      const state = createState({
        activeAgentId: 'agent-1',
        agentMap: {
          'agent-1': {
            sourceSets: [{ enabled: true, id: 'kb-1', name: 'KB' }],
          } as any,
        },
      });

      expect(agentSelectors.hasSources(state)).toBe(true);
    });

    it('should return true when has files', () => {
      const state = createState({
        activeAgentId: 'agent-1',
        agentMap: {
          'agent-1': {
            files: [{ enabled: true, id: 'file-1', name: 'file.txt', type: 'text/plain' }],
          } as any,
        },
      });

      expect(agentSelectors.hasSources(state)).toBe(true);
    });

    it('should return false when no sources', () => {
      const state = createState({
        activeAgentId: 'agent-1',
        agentMap: { 'agent-1': {} },
      });

      expect(agentSelectors.hasSources(state)).toBe(false);
    });
  });

  describe('isAgentConfigLoading', () => {
    it('should return true when no activeAgentId', () => {
      const state = createState({
        activeAgentId: undefined,
      });

      expect(agentSelectors.isAgentConfigLoading(state)).toBe(true);
    });

    it('should return true when agent not in agentMap', () => {
      const state = createState({
        activeAgentId: 'agent-1',
        agentMap: {},
      });

      expect(agentSelectors.isAgentConfigLoading(state)).toBe(true);
    });

    it('should return false when agent exists in agentMap', () => {
      const state = createState({
        activeAgentId: 'agent-1',
        agentMap: { 'agent-1': { id: 'agent-1' } },
      });

      expect(agentSelectors.isAgentConfigLoading(state)).toBe(false);
    });
  });

  describe('currentSourceIds', () => {
    it('should return enabled file and source-set IDs', () => {
      const state = createState({
        activeAgentId: 'agent-1',
        agentMap: {
          'agent-1': {
            files: [
              { enabled: true, id: 'file-1', name: 'file1.txt', type: 'text/plain' },
              { enabled: false, id: 'file-2', name: 'file2.txt', type: 'text/plain' },
            ],
            sourceSets: [
              { enabled: true, id: 'kb-1', name: 'KB 1' },
              { enabled: false, id: 'kb-2', name: 'KB 2' },
            ],
          } as any,
        },
      });

      const ids = agentSelectors.currentSourceIds(state);

      expect(ids.fileIds).toEqual(['file-1']);
      expect(ids.sourceSetIds).toEqual(['kb-1']);
    });
  });

  describe('inboxAgentConfig', () => {
    it('should return inbox agent config from builtinAgentIdMap', () => {
      const state = createState({
        builtinAgentIdMap: { [INBOX_SESSION_ID]: 'inbox' },
        agentMap: { inbox: { model: 'gpt-4o' } },
      });

      const config = agentSelectors.inboxAgentConfig(state);

      expect(config.model).toBe('gpt-4o');
    });

    it('should return default config when inbox agent not initialized', () => {
      const state = createState({
        builtinAgentIdMap: {},
      });

      const config = agentSelectors.inboxAgentConfig(state);

      expect(config).toEqual(DEFAULT_AGENT_CONFIG);
    });
  });

  describe('currentAgentTTS', () => {
    it('should return TTS config from current agent', () => {
      const state = createState({
        activeAgentId: 'agent-1',
        agentMap: {
          'agent-1': {
            tts: { ttsService: 'openai', voice: { openai: 'nova' } },
          },
        },
      });

      const tts = agentSelectors.currentAgentTTS(state);

      expect(tts.ttsService).toBe('openai');
      expect(tts.voice?.openai).toBe('nova');
    });

    it('should return default TTS config when not specified', () => {
      const state = createState({
        activeAgentId: 'agent-1',
        agentMap: { 'agent-1': {} },
      });

      const tts = agentSelectors.currentAgentTTS(state);

      expect(tts).toEqual(DEFAUTT_AGENT_TTS_CONFIG);
    });
  });

  describe('currentAgentTTSVoice', () => {
    it('should return openai voice when ttsService is openai', () => {
      const state = createState({
        activeAgentId: 'agent-1',
        agentMap: {
          'agent-1': {
            tts: { ttsService: 'openai', voice: { openai: 'nova' } },
          },
        },
      });

      expect(agentSelectors.currentAgentTTSVoice('en-US')(state)).toBe('nova');
    });

    it('should return edge voice when ttsService is edge', () => {
      const state = createState({
        activeAgentId: 'agent-1',
        agentMap: {
          'agent-1': {
            tts: { ttsService: 'edge', voice: { edge: 'edge-custom' } },
          },
        },
      });

      expect(agentSelectors.currentAgentTTSVoice('en-US')(state)).toBe('edge-custom');
    });

    it('should return microsoft voice when ttsService is microsoft', () => {
      const state = createState({
        activeAgentId: 'agent-1',
        agentMap: {
          'agent-1': {
            tts: { ttsService: 'microsoft', voice: { microsoft: 'microsoft-custom' } },
          },
        },
      });

      expect(agentSelectors.currentAgentTTSVoice('en-US')(state)).toBe('microsoft-custom');
    });

    it('should return default voice when no voice specified', () => {
      const state = createState({
        activeAgentId: 'agent-1',
        agentMap: {
          'agent-1': {
            tts: { ttsService: 'openai', voice: {} },
          },
        },
      });

      expect(agentSelectors.currentAgentTTSVoice('en-US')(state)).toBe('alloy');
    });
  });

  describe('hasEnabledSourceSets', () => {
    it('should return true when source sets are enabled', () => {
      const state = createState({
        activeAgentId: 'agent-1',
        agentMap: {
          'agent-1': {
            sourceSets: [{ enabled: true, id: 'kb-1', name: 'KB' }],
          } as any,
        },
      });

      expect(agentSelectors.hasEnabledSourceSets(state)).toBe(true);
    });

    it('should return false when no source sets are enabled', () => {
      const state = createState({
        activeAgentId: 'agent-1',
        agentMap: {
          'agent-1': {
            sourceSets: [{ enabled: false, id: 'kb-1', name: 'KB' }],
          } as any,
        },
      });

      expect(agentSelectors.hasEnabledSourceSets(state)).toBe(false);
    });
  });

  describe('openingQuestions', () => {
    it('should return opening questions from config', () => {
      const questions = ['Question 1', 'Question 2'];
      const state = createState({
        activeAgentId: 'agent-1',
        agentMap: {
          'agent-1': {
            openingQuestions: questions,
          },
        },
      });

      expect(agentSelectors.openingQuestions(state)).toEqual(questions);
    });

    it('should return default when no opening questions', () => {
      const state = createState({
        activeAgentId: 'agent-1',
        agentMap: { 'agent-1': {} },
      });

      const result = agentSelectors.openingQuestions(state);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('openingMessage', () => {
    it('should return opening message from config', () => {
      const state = createState({
        activeAgentId: 'agent-1',
        agentMap: {
          'agent-1': {
            openingMessage: 'Hello! How can I help you?',
          },
        },
      });

      expect(agentSelectors.openingMessage(state)).toBe('Hello! How can I help you?');
    });

    it('should return empty string when no opening message', () => {
      const state = createState({
        activeAgentId: 'agent-1',
        agentMap: { 'agent-1': {} },
      });

      expect(agentSelectors.openingMessage(state)).toBe('');
    });
  });

  describe('hasEnabledSources', () => {
    it('should return true when has enabled files', () => {
      const state = createState({
        activeAgentId: 'agent-1',
        agentMap: {
          'agent-1': {
            files: [{ enabled: true, id: 'file-1', name: 'file.txt', type: 'text/plain' }],
          } as any,
        },
      });

      expect(agentSelectors.hasEnabledSources(state)).toBe(true);
    });

    it('should return true when source sets are enabled', () => {
      const state = createState({
        activeAgentId: 'agent-1',
        agentMap: {
          'agent-1': {
            sourceSets: [{ enabled: true, id: 'kb-1', name: 'KB' }],
          } as any,
        },
      });

      expect(agentSelectors.hasEnabledSources(state)).toBe(true);
    });

    it('should return false when nothing enabled', () => {
      const state = createState({
        activeAgentId: 'agent-1',
        agentMap: {
          'agent-1': {
            files: [{ enabled: false, id: 'file-1', name: 'file.txt', type: 'text/plain' }],
            sourceSets: [{ enabled: false, id: 'kb-1', name: 'KB' }],
          } as any,
        },
      });

      expect(agentSelectors.hasEnabledSources(state)).toBe(false);
    });
  });

  describe('displayableAgentPlugins', () => {
    it('should return filtered plugins', () => {
      const state = createState({
        activeAgentId: 'agent-1',
        agentMap: {
          'agent-1': {
            plugins: ['plugin-1', 'plugin-2'],
          },
        },
      });

      // The filterToolIds function will filter out platform-specific tools
      const result = agentSelectors.displayableAgentPlugins(state);
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
