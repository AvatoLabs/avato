import { type AgentSourceItem } from '@lobechat/types';
import { type SWRResponse } from 'swr';

import { resolveWorkspaceSpaceId } from '@/helpers/activeWorkspaceSpace';
import { mutate, useClientDataSWR } from '@/libs/swr';
import { agentService } from '@/services/agent';
import { type StoreSetter } from '@/store/types';

import { type AgentStore } from '../../store';

const FETCH_AGENT_AVAILABLE_SOURCES_KEY = 'FETCH_AGENT_AVAILABLE_SOURCES';

/**
 * Agent source actions.
 * Handles source set and file assignments.
 */

type Setter = StoreSetter<AgentStore>;
export const createSourceSlice = (set: Setter, get: () => AgentStore, _api?: unknown) =>
  new SourceSliceActionImpl(set, get, _api);

export class SourceSliceActionImpl {
  readonly #get: () => AgentStore;

  constructor(set: Setter, get: () => AgentStore, _api?: unknown) {
    void _api;
    void set;
    this.#get = get;
  }

  addFilesToAgent = async (fileIds: string[], enabled?: boolean): Promise<void> => {
    const { activeAgentId, internal_refreshAgentConfig, internal_refreshAgentSources } =
      this.#get();
    if (!activeAgentId) return;
    if (fileIds.length === 0) return;

    await agentService.createAgentFiles(activeAgentId, fileIds, enabled);
    await internal_refreshAgentConfig(activeAgentId);
    await internal_refreshAgentSources();
  };

  attachSourceSetToAgent = async (sourceSetId: string): Promise<void> => {
    const { activeAgentId, internal_refreshAgentConfig, internal_refreshAgentSources } =
      this.#get();
    if (!activeAgentId) return;

    await agentService.attachSourceSetToAgent(activeAgentId, sourceSetId, true);
    await internal_refreshAgentConfig(activeAgentId);
    await internal_refreshAgentSources();
  };

  internal_refreshAgentSources = async (): Promise<void> => {
    await mutate([
      FETCH_AGENT_AVAILABLE_SOURCES_KEY,
      this.#get().activeAgentId,
      resolveWorkspaceSpaceId() ?? null,
    ]);
  };

  removeFileFromAgent = async (fileId: string): Promise<void> => {
    const { activeAgentId, internal_refreshAgentConfig, internal_refreshAgentSources } =
      this.#get();
    if (!activeAgentId) return;

    await agentService.deleteAgentFile(activeAgentId, fileId);
    await internal_refreshAgentConfig(activeAgentId);
    await internal_refreshAgentSources();
  };

  detachSourceSetFromAgent = async (sourceSetId: string): Promise<void> => {
    const { activeAgentId, internal_refreshAgentConfig, internal_refreshAgentSources } =
      this.#get();
    if (!activeAgentId) return;

    await agentService.detachSourceSetFromAgent(activeAgentId, sourceSetId);
    await internal_refreshAgentConfig(activeAgentId);
    await internal_refreshAgentSources();
  };

  toggleFile = async (id: string, open?: boolean): Promise<void> => {
    const { activeAgentId, internal_refreshAgentConfig } = this.#get();
    if (!activeAgentId) return;

    await agentService.toggleFile(activeAgentId, id, open);
    await internal_refreshAgentConfig(activeAgentId);
  };

  setSourceSetEnabled = async (id: string, open?: boolean): Promise<void> => {
    const { activeAgentId, internal_refreshAgentConfig } = this.#get();
    if (!activeAgentId) return;

    await agentService.setSourceSetEnabled(activeAgentId, id, open);
    await internal_refreshAgentConfig(activeAgentId);
  };

  useFetchAvailableSources = (agentId?: string): SWRResponse<AgentSourceItem[]> => {
    const activeSpaceId = resolveWorkspaceSpaceId();

    return useClientDataSWR<AgentSourceItem[]>(
      agentId ? [FETCH_AGENT_AVAILABLE_SOURCES_KEY, agentId, activeSpaceId ?? null] : null,
      ([, id, spaceId]: [string, string, string | null]) =>
        agentService.listAvailableSources(id, spaceId),
      {
        fallbackData: [],
      },
    );
  };
}

export type SourceSliceAction = Pick<SourceSliceActionImpl, keyof SourceSliceActionImpl>;
