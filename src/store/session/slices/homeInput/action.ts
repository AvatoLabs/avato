import { agentSelectors, builtinAgentSelectors } from '@/store/agent/selectors';
import { getAgentStoreState } from '@/store/agent/store';
import { resolveWorkspaceSpaceId } from '@/helpers/activeWorkspaceSpace';
import { documentService } from '@/services/document';
import { useChatStore } from '@/store/chat';
import { useGlobalStore } from '@/store/global';
import { type SessionStore } from '@/store/session/store';
import { type StoreSetter } from '@/store/types';
import { settingsSelectors } from '@/store/user/selectors';
import { useUserStore } from '@/store/user/store';
import { getPageDetailPath } from '@/utils/docs';
import { resolveModelProviderWithFallback } from '@/utils/docsAgentModel';
import { setNamespace } from '@/utils/storeDebug';

import { type StarterMode } from './initialState';

const n = setNamespace('homeInput');

type Setter = StoreSetter<SessionStore>;
export const createHomeInputSlice = (set: Setter, get: () => SessionStore, _api?: unknown) =>
  new HomeInputActionImpl(set, get, _api);

export class HomeInputActionImpl {
  readonly #get: () => SessionStore;
  readonly #set: Setter;

  constructor(set: Setter, get: () => SessionStore, _api?: unknown) {
    void _api;
    this.#set = set;
    this.#get = get;
  }

  clearInputMode = (): void => {
    this.#set({ inputActiveMode: null }, false, n('clearInputMode'));
  };

  sendAsAgent = async (message: string): Promise<string> => {
    this.#set({ homeInputLoading: true }, false, n('sendAsAgent/start'));

    try {
      const agentState = getAgentStoreState();
      const defaultAgentConfig = settingsSelectors.defaultAgentConfig(useUserStore.getState());
      const inboxAgentId = builtinAgentSelectors.inboxAgentId(agentState);
      const inboxConfig = inboxAgentId
        ? agentSelectors.getAgentConfigById(inboxAgentId)(agentState)
        : null;
      const { model, provider } = resolveModelProviderWithFallback(inboxConfig, defaultAgentConfig);

      // 1. Create new Agent using existing createSession action
      const newAgentId = await this.#get().createSession(
        {
          config: { model: model ?? undefined, provider: provider ?? undefined, systemRole: message },
          meta: { title: message?.slice(0, 50) || 'New Agent' },
        },
        false, // Don't switch session, we'll navigate manually
      );

      // 2. Navigate to Agent profile page
      const navigate = useGlobalStore.getState().navigate;
      if (navigate) {
        navigate(`/agent/${newAgentId}/profile`);
      }

      // 3. Send initial message with agentId context
      const agentBuilderId = builtinAgentSelectors.agentBuilderId(agentState);
      if (agentBuilderId) {
        if (model && provider) {
          await agentState.updateAgentConfigById(agentBuilderId, { model, provider });
        }

        const { sendMessage } = useChatStore.getState();
        await sendMessage({
          context: { agentId: agentBuilderId, scope: 'agent_builder' },
          message,
        });
      }

      // 4. Clear mode
      this.#set({ inputActiveMode: null }, false, n('sendAsAgent/clearMode'));

      return newAgentId;
    } finally {
      this.#set({ homeInputLoading: false }, false, n('sendAsAgent/end'));
    }
  };

  sendAsImage = (): void => {
    // Navigate to /image page
    const navigate = useGlobalStore.getState().navigate;
    if (navigate) {
      navigate('/image');
    }

    // Clear mode
    this.#set({ inputActiveMode: null }, false, n('sendAsImage'));
  };

  sendAsResearch = async (message: string): Promise<void> => {
    // TODO: Implement DeepResearch mode
    console.info('sendAsResearch:', message);

    // Clear mode
    this.#set({ inputActiveMode: null }, false, n('sendAsResearch'));
  };

  sendAsWrite = async (message: string): Promise<string> => {
    this.#set({ homeInputLoading: true }, false, n('sendAsWrite/start'));

    try {
      const agentState = getAgentStoreState();
      const defaultAgentConfig = settingsSelectors.defaultAgentConfig(useUserStore.getState());
      const inboxAgentId = builtinAgentSelectors.inboxAgentId(agentState);
      const inboxConfig = inboxAgentId
        ? agentSelectors.getAgentConfigById(inboxAgentId)(agentState)
        : null;
      const { model, provider } = resolveModelProviderWithFallback(inboxConfig, defaultAgentConfig);
      const resolvedSpaceId = resolveWorkspaceSpaceId();
      const docsAgentId = builtinAgentSelectors.docsAgentId(agentState);

      // 1. Create new Document
      const newDoc = await documentService.createDocument({
        editorData: '{}',
        fileType: 'custom/document',
        spaceId: resolvedSpaceId,
        title: message?.slice(0, 50) || 'Untitled',
      });

      // 2. Navigate to Page
      const navigate = useGlobalStore.getState().navigate;
      if (navigate) {
        navigate(getPageDetailPath(newDoc.id, 'doc', newDoc.spaceId ?? resolvedSpaceId));
      }

      // 3. Send message with document scope context
      if (docsAgentId) {
        if (model && provider) {
          await agentState.updateAgentConfigById(docsAgentId, { model, provider });
        }

        const { sendMessage } = useChatStore.getState();
        await sendMessage({
          context: {
            agentId: docsAgentId,
            scope: 'doc',
          },
          message,
        });
      }

      // 4. Clear mode
      this.#set({ inputActiveMode: null }, false, n('sendAsWrite/clearMode'));

      return newDoc.id;
    } finally {
      this.#set({ homeInputLoading: false }, false, n('sendAsWrite/end'));
    }
  };

  setInputActiveMode = (mode: StarterMode): void => {
    this.#set({ inputActiveMode: mode }, false, n('setInputActiveMode', mode));
  };
}

export type HomeInputAction = Pick<HomeInputActionImpl, keyof HomeInputActionImpl>;
