import { type UIChatMessage } from '@lobechat/types';

import { getActiveWorkspaceSpaceId } from '@/helpers/activeWorkspaceSpace';
import { createAgentToolsEngine } from '@/helpers/toolEngineering';
import { lambdaClient } from '@/libs/trpc/client';
import { type HumanInterventionRequest } from '@/services/agentRuntime/type';
import { contextEngineering } from '@/services/chat/mecha';
import { agentChatConfigSelectors, agentSelectors } from '@/store/agent/selectors';
import { getAgentStoreState } from '@/store/agent/store';

export { agentRuntimeClient } from './client';
export * from './type';

interface AgentOperationRequest {
  appSessionId?: string;
  autoStart?: boolean;
  messages: UIChatMessage[];
  spaceId?: string | null;
  threadId?: string;
  topicId?: string;
  userMessageId: string;
}

class AgentRuntimeService {
  createOperation = async (data: AgentOperationRequest) => {
    const agentStoreState = getAgentStoreState();
    const agentConfig = agentSelectors.currentAgentConfig(agentStoreState);
    const chatConfig = agentChatConfigSelectors.currentChatConfig(agentStoreState);

    const modelRuntimeConfig = {
      model: agentConfig.model,
      provider: agentConfig.provider!,
    };

    const toolsEngine = createAgentToolsEngine({
      model: agentConfig.model,
      provider: agentConfig.provider!,
    });

    const { tools, enabledToolIds } = toolsEngine.generateToolsDetailed({
      model: agentConfig.model,
      provider: agentConfig.provider!,
      toolIds: agentConfig.plugins,
    });

    // Apply context engineering with preprocessing configuration
    const llmMessages = await contextEngineering({
      enableHistoryCount: agentChatConfigSelectors.enableHistoryCount(agentStoreState),
      // include user messages
      historyCount: agentChatConfigSelectors.historyCount(agentStoreState) + 2,
      inputTemplate: chatConfig.inputTemplate,
      messages: data.messages as any,
      ...modelRuntimeConfig,
      plugins: agentConfig.plugins,
      systemRole: agentConfig.systemRole,
      tools: enabledToolIds,
    });

    const toolManifestMap = Object.fromEntries(
      toolsEngine.getEnabledPluginManifests(enabledToolIds).entries(),
    );

    const effectiveSpaceId = data.spaceId ?? getActiveWorkspaceSpaceId() ?? undefined;

    return await lambdaClient.aiAgent.createOperation.mutate({
      ...data,
      ...(effectiveSpaceId ? { spaceId: effectiveSpaceId } : {}),
      agentConfig: {
        enableSearch: agentChatConfigSelectors.isAgentEnableSearch(agentStoreState),
        maxSteps: 50,
        // costLimit: agentChatConfig.costLimit,
        // enableRAG: false,
        // humanApprovalRequired: agentChatConfig.humanApprovalRequired || false,
      },
      messages: llmMessages,
      modelRuntimeConfig,
      toolManifestMap,
      tools,
    });
  };

  /**
   * Get operation status
   */
  async getOperationStatus(operationId: string, includeHistory = false): Promise<any> {
    return await lambdaClient.aiAgent.getOperationStatus.query({ includeHistory, operationId });
  }

  /**
   * Handle human intervention
   */
  async handleHumanIntervention(request: HumanInterventionRequest): Promise<any> {
    return await lambdaClient.aiAgent.processHumanIntervention.mutate({
      action: request.action,
      data: request.data,
      operationId: request.operationId,
      reason: request.reason,
      stepIndex: 0, // Default to 0 since it's not provided in the request type
    });
  }
}

export const agentRuntimeService = new AgentRuntimeService();
