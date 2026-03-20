import { type ChatCompletionErrorPayload, type ModelRuntime } from '@lobechat/model-runtime';
import { AGENT_RUNTIME_ERROR_SET } from '@lobechat/model-runtime';
import { ChatErrorType } from '@lobechat/types';

import { checkAuth } from '@/app/(backend)/middleware/auth';
import { initModelRuntimeFromDB } from '@/server/modules/ModelRuntime';
import { type MobileChatPayload, MobileChatService } from '@/server/services/mobileChat';
import { createErrorResponse } from '@/utils/errorResponse';
import { getTracePayload } from '@/utils/trace';

export const maxDuration = 300;

export const POST = checkAuth(
  async (req: Request, { params, userId, serverDB, createRuntime, jwtPayload }) => {
    const provider = (await params)!.provider!;

    try {
      let modelRuntime: ModelRuntime;
      if (createRuntime) {
        modelRuntime = createRuntime(jwtPayload);
      } else {
        modelRuntime = await initModelRuntimeFromDB(serverDB, userId, provider);
      }

      const payload = (await req.json()) as MobileChatPayload;
      const service = new MobileChatService({
        modelRuntime,
        provider,
        requestSignal: req.signal,
        serverDB,
        userId,
      });

      return await service.handleChat(payload, getTracePayload(req));
    } catch (error) {
      const {
        errorType = ChatErrorType.InternalServerError,
        error: errorContent,
        ...res
      } = error as ChatCompletionErrorPayload;

      const normalizedError = errorContent || error;
      const logMethod = AGENT_RUNTIME_ERROR_SET.has(errorType as string) ? 'warn' : 'error';

      // eslint-disable-next-line no-console
      console[logMethod](`Route: [${provider}] ${errorType}:`, normalizedError);

      return createErrorResponse(errorType, { error: normalizedError, ...res, provider });
    }
  },
);
