import { type ChatCompletionErrorPayload, type ModelRuntime } from '@lobechat/model-runtime';
import { AGENT_RUNTIME_ERROR_SET } from '@lobechat/model-runtime';
import { ChatErrorType } from '@lobechat/types';

import { checkAuth } from '@/app/(backend)/middleware/auth';
import { initModelRuntimeFromDB } from '@/server/modules/ModelRuntime';
import { MobileChatService } from '@/server/services/mobileChat';
import { getMobileInterventionResumeStore } from '@/server/services/mobileChat/resumeStore';
import { createErrorResponse } from '@/utils/errorResponse';

export const maxDuration = 300;

interface MobileContinuePayload {
  approvedToolCall?: {
    apiName: string;
    arguments: string;
    id: string;
    identifier: string;
    [key: string]: any;
  };
  assistantMessageId?: string;
  rejectedToolCall?: { id: string; reason?: string };
  sessionId: string;
  topicId?: string;
}

export const POST = checkAuth(
  async (req: Request, { params, userId, serverDB, createRuntime, jwtPayload }) => {
    const provider = (await params)!.provider!;

    try {
      const body = (await req.json()) as MobileContinuePayload;
      const { approvedToolCall, rejectedToolCall, sessionId, topicId } = body;

      const hasApprove = Boolean(approvedToolCall?.id);
      const hasReject = Boolean(rejectedToolCall?.id);
      if (!sessionId || hasApprove === hasReject) {
        return createErrorResponse(ChatErrorType.InvalidRequest, {
          error:
            'sessionId is required, and exactly one of approvedToolCall.id or rejectedToolCall.id',
          provider,
        });
      }

      const resumeStore = getMobileInterventionResumeStore();
      const rk = resumeStore.key(userId, sessionId, topicId);
      const state = resumeStore.get(rk);

      if (!state) {
        return createErrorResponse(ChatErrorType.InvalidRequest, {
          error: 'No pending intervention found or session expired',
          provider,
        });
      }

      let modelRuntime: ModelRuntime;
      if (createRuntime) {
        modelRuntime = createRuntime(jwtPayload);
      } else {
        modelRuntime = await initModelRuntimeFromDB(serverDB, userId, provider);
      }

      const service = new MobileChatService({
        modelRuntime,
        provider,
        requestSignal: req.signal,
        serverDB,
        userId,
      });

      return await service.continueIntervention({
        ...(hasApprove ? { approvedToolCall: approvedToolCall! } : {}),
        ...(hasReject ? { rejectedToolCall: rejectedToolCall! } : {}),
        payload: state.payload,
        resumeState: state,
      });
    } catch (error) {
      const {
        errorType = ChatErrorType.InternalServerError,
        error: errorContent,
        ...res
      } = error as ChatCompletionErrorPayload;

      const normalizedError = errorContent || error;
      const logMethod = AGENT_RUNTIME_ERROR_SET.has(errorType as string) ? 'warn' : 'error';

      // eslint-disable-next-line no-console
      console[logMethod](`Route: [${provider}] continue ${errorType}:`, normalizedError);

      return createErrorResponse(errorType, { error: normalizedError, ...res, provider });
    }
  },
);
