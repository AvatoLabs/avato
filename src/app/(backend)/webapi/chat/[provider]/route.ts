import { type ChatCompletionErrorPayload, type ModelRuntime } from '@lobechat/model-runtime';
import { AGENT_RUNTIME_ERROR_SET } from '@lobechat/model-runtime';
import { ChatErrorType } from '@lobechat/types';

import { checkAuth } from '@/app/(backend)/middleware/auth';
import { AgentModel } from '@/database/models/agent';
import { UserMemoryIdentityModel } from '@/database/models/userMemory/identity';
import { type LobeChatDatabase } from '@/database/type';
import { createTraceOptions, initModelRuntimeFromDB } from '@/server/modules/ModelRuntime';
import { type ChatStreamPayload } from '@/types/openai/chat';
import { createErrorResponse } from '@/utils/errorResponse';
import { getTracePayload } from '@/utils/trace';

// If user don't use fluid compute, will build  failed
// this enforce user to enable fluid compute
export const maxDuration = 300;

const MEMORY_LIMIT_BY_EFFORT = {
  high: 50,
  low: 12,
  medium: 30,
} as const;

type MobileMemoryEffort = keyof typeof MEMORY_LIMIT_BY_EFFORT;

const normalizeMemoryEffort = (effort?: string): MobileMemoryEffort => {
  if (effort === 'low' || effort === 'medium' || effort === 'high') return effort;
  return 'medium';
};

const buildMemoryContext = (
  memories: Array<{
    description?: string | null;
    role?: string | null;
    type?: string | null;
  }>,
) => {
  const lines = memories
    .map((item) => {
      const role = item.role || item.type || 'user';
      const content = item.description?.trim();
      if (!content) return null;
      return `[${role}] ${content}`;
    })
    .filter(Boolean);

  if (lines.length === 0) return undefined;

  return `## User Memory\n${lines.join('\n')}`;
};

interface MobileMemoryPayload {
  effort?: MobileMemoryEffort;
  enabled?: boolean;
}

interface MobileChatPayload extends ChatStreamPayload {
  memory?: MobileMemoryPayload;
  sessionId?: string;
  topicId?: string;
}

const resolveEffectiveMemoryPayload = async (params: {
  explicitMemory?: MobileMemoryPayload;
  serverDB: LobeChatDatabase;
  sessionId?: string;
  userId: string;
}): Promise<MobileMemoryPayload | undefined> => {
  if (params.explicitMemory) return params.explicitMemory;
  if (!params.sessionId) return undefined;

  try {
    const agentModel = new AgentModel(params.serverDB, params.userId);
    const agent = await agentModel.findBySessionId(params.sessionId);
    const sessionMemory = agent?.chatConfig?.memory;

    if (!sessionMemory) return undefined;

    return {
      effort: normalizeMemoryEffort(
        typeof sessionMemory.effort === 'string' ? sessionMemory.effort : undefined,
      ),
      enabled: sessionMemory.enabled !== false,
    };
  } catch (error) {
    console.error('[webapi/chat] failed to resolve memory config from session:', error);
    return undefined;
  }
};

export const POST = checkAuth(
  async (req: Request, { params, userId, serverDB, createRuntime, jwtPayload }) => {
    const provider = (await params)!.provider!;

    try {
      // ============  1. init chat model   ============ //
      let modelRuntime: ModelRuntime;
      if (createRuntime) {
        // Legacy support for custom runtime creation
        modelRuntime = createRuntime(jwtPayload);
      } else {
        // Read user's provider config from database
        modelRuntime = await initModelRuntimeFromDB(serverDB, userId, provider);
      }

      // ============  2. create chat completion   ============ //

      const data = (await req.json()) as MobileChatPayload;
      const effectiveMemory = await resolveEffectiveMemoryPayload({
        explicitMemory: data.memory,
        serverDB,
        sessionId: data.sessionId,
        userId,
      });

      // Mobile-only memory payload: inject user memories on server side
      // so client doesn't need to splice memory context manually.
      if (effectiveMemory && effectiveMemory.enabled !== false) {
        try {
          const effort = normalizeMemoryEffort(effectiveMemory.effort);
          const limit = MEMORY_LIMIT_BY_EFFORT[effort];
          const memoryModel = new UserMemoryIdentityModel(serverDB, userId);
          const memories = await memoryModel.queryForInjection(limit);
          const memoryContext = buildMemoryContext(memories);

          if (memoryContext) {
            data.messages = [{ content: memoryContext, role: 'system' }, ...data.messages];
          }
        } catch (error) {
          // Best-effort: chat should continue even if memory context loading fails.
          console.error('[webapi/chat] failed to inject memory context:', error);
        }
      }

      // `memory` is a mobile extension field and should not be sent to model runtimes.
      delete (data as any).memory;
      delete (data as any).sessionId;
      delete (data as any).topicId;

      const tracePayload = getTracePayload(req);

      let traceOptions = {};
      // If user enable trace
      if (tracePayload?.enabled) {
        traceOptions = createTraceOptions(data, { provider, trace: tracePayload });
      }

      return await modelRuntime.chat(data, {
        user: userId,
        ...traceOptions,
        signal: req.signal,
      });
    } catch (e) {
      const {
        errorType = ChatErrorType.InternalServerError,
        error: errorContent,
        ...res
      } = e as ChatCompletionErrorPayload;

      const error = errorContent || e;

      const logMethod = AGENT_RUNTIME_ERROR_SET.has(errorType as string) ? 'warn' : 'error';
      // track the error at server side
      // eslint-disable-next-line no-console
      console[logMethod](`Route: [${provider}] ${errorType}:`, error);

      return createErrorResponse(errorType, { error, ...res, provider });
    }
  },
);
