import { ComputerUseIdentifier, ComputerUseManifest } from '@lobechat/builtin-tool-computer-use';
import { safeParseJSON } from '@lobechat/utils';

import { deviceProxy } from '../deviceProxy';
import { type ToolExecutionContext, type ToolExecutionResult } from '../types';
import { type ServerRuntimeRegistration } from './types';

interface DeviceToolCallResult {
  content: string;
  error?: string;
  success: boolean;
}

const pluginError = (message?: string) => ({
  message: message || 'Remote computer use failed',
  type: 'PluginServerError',
});

const isRecord = (value: unknown): value is Record<string, any> => {
  return !!value && typeof value === 'object' && !Array.isArray(value);
};

const readDevicePayload = (response: DeviceToolCallResult): unknown => {
  const parsed = safeParseJSON(response.content);
  return parsed ?? response.content;
};

const buildScreenshotState = async (
  payload: Record<string, any>,
  processContentBlocks?: ToolExecutionContext['processContentBlocks'],
) => {
  if (typeof payload.base64 !== 'string' || typeof payload.mediaType !== 'string') return payload;

  let imageUrl: string | undefined;

  if (processContentBlocks) {
    const processed = await processContentBlocks([
      {
        data: payload.base64,
        mimeType: payload.mediaType,
        type: 'image',
      } as any,
    ]);
    const imageBlock = processed[0];
    if (imageBlock?.type === 'image' && typeof imageBlock.data === 'string') {
      imageUrl = imageBlock.data;
    }
  }

  const { base64, ...state } = payload;
  void base64;

  return imageUrl ? { ...state, imageUrl } : state;
};

const formatComputerUseResult = async (
  apiName: string,
  response: DeviceToolCallResult,
  processContentBlocks?: ToolExecutionContext['processContentBlocks'],
): Promise<ToolExecutionResult> => {
  const payload = readDevicePayload(response);
  const success = response.success && (!isRecord(payload) || payload.success !== false);
  const error =
    isRecord(payload) && typeof payload.error === 'string' ? payload.error : response.error;

  if (apiName === 'screenshot' && isRecord(payload) && success) {
    const state = await buildScreenshotState(payload, processContentBlocks);

    return {
      content: `Screenshot captured from ${state.source || 'remote desktop'}${
        state.width && state.height ? ` (${state.width}x${state.height})` : ''
      }.`,
      state,
      success: true,
    };
  }

  return {
    content: typeof payload === 'string' ? payload : JSON.stringify(payload),
    error: success ? undefined : pluginError(error || response.content),
    state: isRecord(payload) ? payload : undefined,
    success,
  };
};

export const computerUseRuntime: ServerRuntimeRegistration = {
  factory: (context) => {
    if (!context.userId) {
      throw new Error('userId is required for Computer Use device proxy execution');
    }
    if (!context.activeDeviceId) {
      throw new Error('activeDeviceId is required for Computer Use device proxy execution');
    }

    const proxy: Record<string, (args: any) => Promise<ToolExecutionResult>> = {};

    for (const api of ComputerUseManifest.api) {
      proxy[api.name] = async (args: any) => {
        const toolArgs = isRecord(args) ? args : {};
        const response = await deviceProxy.executeToolCall(
          { deviceId: context.activeDeviceId!, userId: context.userId! },
          {
            apiName: api.name,
            arguments: JSON.stringify(toolArgs),
            identifier: ComputerUseIdentifier,
          },
        );

        return formatComputerUseResult(api.name, response, context.processContentBlocks);
      };
    }

    return proxy;
  },
  identifier: ComputerUseIdentifier,
};
