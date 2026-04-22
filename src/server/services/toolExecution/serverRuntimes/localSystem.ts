import { LocalSystemIdentifier, LocalSystemManifest } from '@lobechat/builtin-tool-local-system';
import {
  formatCommandOutput,
  formatCommandResult,
  formatEditResult,
  formatFileContent,
  formatFileList,
  formatFileSearchResults,
  formatGlobResults,
  formatGrepResults,
  formatKillResult,
  formatMoveResults,
  formatMultipleFiles,
  formatRenameResult,
  formatWriteResult,
} from '@lobechat/prompts';
import { safeParseJSON } from '@lobechat/utils';

import { deviceProxy } from '../deviceProxy';
import { type ToolExecutionResult } from '../types';
import { type ServerRuntimeRegistration } from './types';

interface DeviceToolCallResult {
  content: string;
  error?: string;
  success: boolean;
}

const REMOTE_COMMAND_DEFAULT_TIMEOUT = 120_000;
const REMOTE_COMMAND_MIN_TIMEOUT = 1000;
const REMOTE_COMMAND_MAX_TIMEOUT = 600_000;

const pluginError = (message?: string) => ({
  message: message || 'Remote desktop execution failed',
  type: 'PluginServerError',
});

const isRecord = (value: unknown): value is Record<string, any> => {
  return !!value && typeof value === 'object' && !Array.isArray(value);
};

const readDevicePayload = (response: DeviceToolCallResult): unknown => {
  const parsed = safeParseJSON(response.content);
  return parsed ?? response.content;
};

const clampRemoteTimeout = (timeout: number) =>
  Math.min(Math.max(Math.trunc(timeout), REMOTE_COMMAND_MIN_TIMEOUT), REMOTE_COMMAND_MAX_TIMEOUT);

const resolveDeviceRpcTimeout = (apiName: string, args: Record<string, any>) => {
  if (apiName !== 'runCommand') return undefined;

  return typeof args.timeout === 'number' && Number.isFinite(args.timeout)
    ? clampRemoteTimeout(args.timeout)
    : REMOTE_COMMAND_DEFAULT_TIMEOUT;
};

const toDate = (value: unknown): Date | undefined => {
  if (value instanceof Date) return value;
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;

  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : undefined;
};

const normalizeFileItem = (value: unknown) => {
  if (!isRecord(value)) return value;

  return {
    ...value,
    createdTime: toDate(value.createdTime) ?? value.createdTime,
    lastAccessTime: toDate(value.lastAccessTime) ?? value.lastAccessTime,
    modifiedTime: toDate(value.modifiedTime) ?? value.modifiedTime,
  };
};

const passThroughDeviceResult = (response: DeviceToolCallResult): ToolExecutionResult => ({
  content: response.content,
  error: response.success ? undefined : pluginError(response.error || response.content),
  success: response.success,
});

const readPayloadError = (payload: unknown, response: DeviceToolCallResult) => {
  if (isRecord(payload)) {
    const error = payload.error || payload.stderr || payload.message;
    if (typeof error === 'string' && error.length > 0) return error;
  }

  return response.error || (response.success ? undefined : response.content);
};

const withRemoteFailure = (
  result: ToolExecutionResult,
  payload: unknown,
  response: DeviceToolCallResult,
): ToolExecutionResult => {
  if (result.success !== false || result.error) return result;
  const message = readPayloadError(payload, response) || result.content;

  return {
    ...result,
    content: message || result.content,
    error: pluginError(message),
  };
};

const formatLocalSystemDeviceResult = (
  apiName: string,
  args: Record<string, any>,
  response: DeviceToolCallResult,
): ToolExecutionResult => {
  const payload = readDevicePayload(response);

  if (!isRecord(payload) && !Array.isArray(payload)) {
    return passThroughDeviceResult(response);
  }

  try {
    switch (apiName) {
      case 'listLocalFiles': {
        const result = payload as { files?: unknown[]; totalCount?: number };
        const files = Array.isArray(result.files) ? result.files.map(normalizeFileItem) : [];
        return withRemoteFailure(
          {
            content: formatFileList({
              directory: String(args.path || ''),
              files: files as any,
              sortBy: args.sortBy,
              sortOrder: args.sortOrder,
              totalCount: result.totalCount,
            }),
            state: { listResults: files, totalCount: result.totalCount ?? files.length },
            success: response.success,
          },
          payload,
          response,
        );
      }

      case 'readLocalFile': {
        const result = payload as { content?: string };
        return withRemoteFailure(
          {
            content: formatFileContent({
              content: result.content || '',
              lineRange: args.loc,
              path: String(args.path || ''),
            }),
            state: { fileContent: payload },
            success: response.success,
          },
          payload,
          response,
        );
      }

      case 'readLocalFiles': {
        const results = Array.isArray(payload) ? payload : [];
        return withRemoteFailure(
          {
            content: formatMultipleFiles(results as any),
            state: { filesContent: results },
            success: response.success,
          },
          payload,
          response,
        );
      }

      case 'searchLocalFiles': {
        const results = Array.isArray(payload) ? payload : [];
        return withRemoteFailure(
          {
            content: formatFileSearchResults(results as any),
            state: { searchResults: results },
            success: response.success,
          },
          payload,
          response,
        );
      }

      case 'moveLocalFiles': {
        const results = Array.isArray(payload) ? payload : [];
        return withRemoteFailure(
          {
            content: formatMoveResults(results as any),
            state: {
              results,
              successCount: results.filter((result) => isRecord(result) && result.success).length,
              totalCount: results.length,
            },
            success: response.success,
          },
          payload,
          response,
        );
      }

      case 'renameLocalFile': {
        const result = payload as { error?: string; success?: boolean };
        const success = response.success && result.success !== false;
        return {
          content: formatRenameResult({
            error: result.error || response.error,
            newName: String(args.newName || ''),
            oldPath: String(args.path || ''),
            success,
          }),
          error: success ? undefined : pluginError(result.error || response.error),
          state: { ...result, oldPath: args.path },
          success,
        };
      }

      case 'writeLocalFile': {
        const result = payload as { error?: string; success?: boolean };
        const success = response.success && result.success !== false;
        return {
          content: formatWriteResult({
            error: result.error || response.error,
            path: String(args.path || ''),
            success,
          }),
          error: success ? undefined : pluginError(result.error || response.error),
          success,
        };
      }

      case 'editLocalFile': {
        const result = payload as {
          error?: string;
          linesAdded?: number;
          linesDeleted?: number;
          replacements?: number;
          success?: boolean;
        };
        const success = response.success && result.success !== false;
        return {
          content: success
            ? formatEditResult({
                filePath: String(args.file_path || ''),
                linesAdded: result.linesAdded,
                linesDeleted: result.linesDeleted,
                replacements: result.replacements ?? 0,
              })
            : `Edit failed: ${result.error || response.error || 'Unknown error'}`,
          error: success ? undefined : pluginError(result.error || response.error),
          state: result,
          success,
        };
      }

      case 'runCommand': {
        const result = payload as {
          error?: string;
          exit_code?: number;
          shell_id?: string;
          stderr?: string;
          stdout?: string;
          success?: boolean;
        };
        const success = response.success && result.success !== false;
        const errorMessage =
          result.error || response.error || result.stderr || result.stdout || 'Unknown error';
        const content = formatCommandResult({
          error: success ? undefined : errorMessage,
          exitCode: result.exit_code,
          shellId: result.shell_id,
          stderr: result.stderr,
          stdout: result.stdout,
          success,
        });
        return {
          content,
          error: success ? undefined : pluginError(errorMessage),
          state: { message: content.split('\n\n')[0], result },
          success,
        };
      }

      case 'getCommandOutput': {
        const result = payload as {
          error?: string;
          output?: string;
          running?: boolean;
          success?: boolean;
        };
        const success = response.success && result.success !== false;
        const content = formatCommandOutput({
          error: result.error || response.error,
          output: result.output,
          running: result.running ?? false,
          success,
        });
        return {
          content,
          error: success ? undefined : pluginError(result.error || response.error || content),
          state: { message: content.split('\n\n')[0], result },
          success,
        };
      }

      case 'killCommand': {
        const result = payload as { error?: string; success?: boolean };
        const success = response.success && result.success !== false;
        const content = formatKillResult({
          error: result.error || response.error,
          shellId: String(args.shell_id || ''),
          success,
        });
        return {
          content,
          error: success ? undefined : pluginError(result.error || response.error || content),
          state: { message: content, result },
          success,
        };
      }

      case 'grepContent': {
        const result = payload as {
          error?: string;
          matches?: string[];
          success?: boolean;
          total_matches?: number;
        };
        const success = response.success && result.success !== false;
        const content = success
          ? formatGrepResults({
              matches: Array.isArray(result.matches) ? result.matches : [],
              totalMatches: result.total_matches ?? 0,
            })
          : `Search failed: ${result.error || response.error || 'Unknown error'}`;
        return {
          content,
          error: success ? undefined : pluginError(result.error || response.error),
          state: { message: content.split('\n')[0], result },
          success,
        };
      }

      case 'globLocalFiles': {
        const result = payload as {
          error?: string;
          files?: string[];
          success?: boolean;
          total_files?: number;
        };
        const success = response.success && result.success !== false;
        const content = success
          ? formatGlobResults({
              files: Array.isArray(result.files) ? result.files : [],
              totalFiles: result.total_files ?? 0,
            })
          : `Glob search failed: ${result.error || response.error || 'Unknown error'}`;
        return {
          content,
          error: success ? undefined : pluginError(result.error || response.error),
          state: { message: content.split('\n')[0], result },
          success,
        };
      }

      default: {
        return passThroughDeviceResult(response);
      }
    }
  } catch (error) {
    return {
      content: response.content,
      error: pluginError((error as Error).message),
      success: false,
    };
  }
};

export const localSystemRuntime: ServerRuntimeRegistration = {
  factory: (context) => {
    if (!context.userId) {
      throw new Error('userId is required for Local System device proxy execution');
    }
    if (!context.activeDeviceId) {
      throw new Error('activeDeviceId is required for Local System device proxy execution');
    }

    const proxy: Record<string, (args: any) => Promise<any>> = {};

    for (const api of LocalSystemManifest.api) {
      proxy[api.name] = async (args: any) => {
        const toolArgs = isRecord(args) ? args : {};
        const target = { deviceId: context.activeDeviceId!, userId: context.userId! };
        const toolCall = {
          apiName: api.name,
          arguments: JSON.stringify(toolArgs),
          identifier: LocalSystemIdentifier,
        };
        const timeout = resolveDeviceRpcTimeout(api.name, toolArgs);
        const response =
          timeout === undefined
            ? await deviceProxy.executeToolCall(target, toolCall)
            : await deviceProxy.executeToolCall(target, toolCall, timeout);

        return formatLocalSystemDeviceResult(api.name, toolArgs, response);
      };
    }

    return proxy;
  },
  identifier: LocalSystemIdentifier,
};
