import { ChatErrorType } from '@lobechat/types';
import OpenAI from 'openai';

import { getOpenAIAuthFromRequest } from '@/const/fetch';
import { getLLMConfig } from '@/envs/llm';
import { createErrorResponse } from '@/utils/errorResponse';

// create OpenAI instance
const createOpenai = (userApiKey: string | null, endpoint?: string | null) => {
    const { OPENAI_API_KEY } = getLLMConfig();
    const OPENAI_PROXY_URL = process.env.OPENAI_PROXY_URL;

    const baseURL = endpoint || OPENAI_PROXY_URL || undefined;

    const apiKey = userApiKey || OPENAI_API_KEY;

    if (!apiKey) throw new Error('OPENAI_API_KEY is empty', { cause: ChatErrorType.NoOpenAIAPIKey });

    return new OpenAI({ apiKey, baseURL });
};

/**
 * Create OpenAI Instance with Auth and azure openai support
 * If auth not pass, return error response
 */
export const createBizOpenAI = (req: Request): Response | OpenAI => {
    const { apiKey, endpoint } = getOpenAIAuthFromRequest(req);

    let openai: OpenAI;

    try {
        openai = createOpenai(apiKey, endpoint);
    } catch (error) {
        if ((error as Error).cause === ChatErrorType.NoOpenAIAPIKey) {
            return createErrorResponse(ChatErrorType.NoOpenAIAPIKey);
        }

        console.error(error); // log error to trace it
        return createErrorResponse(ChatErrorType.InternalServerError);
    }

    return openai;
};
