import { builtinSkills } from '@lobechat/builtin-skills';
import { type CommandResult, SkillsIdentifier } from '@lobechat/builtin-tool-skills';
import {
  type ExportFileResult,
  type SkillRuntimeContext,
  type SkillRuntimeService,
  SkillsExecutionRuntime,
} from '@lobechat/builtin-tool-skills/executionRuntime';
import type { LobeChatDatabase } from '@lobechat/database';
import type { SkillItem, SkillListItem, SkillResourceContent } from '@lobechat/types';
import debug from 'debug';

import { AgentSkillModel } from '@/database/models/agentSkill';
import { FileModel } from '@/database/models/file';
import { filterBuiltinSkills } from '@/helpers/skillFilters';
import { getBlobProvider } from '@/server/modules/BlobProvider';
import { FileService } from '@/server/services/file';
import {
  generateSandboxExportStorageKey,
  resolveTargetSpaceIdForSandboxExport,
} from '@/server/services/file/sandboxExport';
import { resolveAccessibleSkillZipProxyUrl } from '@/server/services/skill/resolveAccessibleSkillZipProxyUrl';
import { SkillResourceService } from '@/server/services/skill/resource';
import { deviceProxy } from '@/server/services/toolExecution/deviceProxy';

import { type ServerRuntimeRegistration } from './types';

const log = debug('lobe-server:skills-runtime');

interface ExecScriptDeviceParams {
  command: string;
  config?: { description?: string; id?: string; name?: string };
  description: string;
  executionContextId?: string;
  timeout?: number;
  zipSha256?: string;
  zipUrl?: string;
}

interface ExportFileDeviceResult {
  error?: string;
  filename?: string;
  mimeType?: string;
  path?: string;
  sha256?: string;
  size?: number;
  success?: boolean;
}

interface RemoteCommandResult {
  error?: string;
  exit_code?: number;
  exitCode?: number;
  output?: string;
  shell_id?: string;
  stderr?: string;
  stdout?: string;
  success?: boolean;
}

const remoteCommandResultKeys = [
  'error',
  'exitCode',
  'exit_code',
  'output',
  'shell_id',
  'stderr',
  'stdout',
  'success',
] as const;

const REMOTE_COMMAND_DEFAULT_TIMEOUT = 120_000;
const REMOTE_COMMAND_MIN_TIMEOUT = 1000;
const REMOTE_COMMAND_MAX_TIMEOUT = 600_000;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === 'object' && !Array.isArray(value);
};

const isRemoteCommandResult = (value: unknown): value is RemoteCommandResult => {
  return isRecord(value) && remoteCommandResultKeys.some((key) => key in value);
};

const normalizeRemoteCommandTimeout = (timeout?: number) => {
  if (typeof timeout !== 'number' || !Number.isFinite(timeout)) return undefined;

  return Math.min(
    Math.max(Math.trunc(timeout), REMOTE_COMMAND_MIN_TIMEOUT),
    REMOTE_COMMAND_MAX_TIMEOUT,
  );
};

const stringifyRemoteOutput = (value: unknown, fallback: string) => {
  if (typeof value === 'string') return value;
  if (value === undefined) return fallback;
  return JSON.stringify(value);
};

const parseRemoteCommandResult = (content?: string): RemoteCommandResult => {
  if (!content) return { output: '', success: true };

  try {
    const parsed = JSON.parse(content) as unknown;
    return isRemoteCommandResult(parsed)
      ? parsed
      : { output: stringifyRemoteOutput(parsed, content), success: true };
  } catch {
    return { output: content, success: true };
  }
};

const toCommandResult = (result: RemoteCommandResult): CommandResult => {
  const exitCode = result.exitCode ?? result.exit_code ?? (result.success === false ? 1 : 0);

  return {
    exitCode,
    output: result.stdout || result.output || '',
    stderr: result.stderr || result.error || '',
    success: result.success ?? exitCode === 0,
  };
};

const toFailedCommandResult = (
  response: { content: string; error?: string },
  fallbackError: string,
): CommandResult => {
  const parsedResult = toCommandResult(parseRemoteCommandResult(response.content));

  return {
    exitCode: parsedResult.exitCode === 0 ? 1 : parsedResult.exitCode,
    output: parsedResult.output || response.content || '',
    stderr: parsedResult.stderr || response.error || fallbackError,
    success: false,
  };
};

const resolveExecutionContextId = (context?: SkillRuntimeContext) =>
  context?.operationId || context?.messageId;

const parseRemoteExportFileResult = (content?: string): ExportFileDeviceResult => {
  if (!content) return { success: true };

  try {
    const parsed = JSON.parse(content) as unknown;
    return isRecord(parsed) ? (parsed as ExportFileDeviceResult) : { success: true };
  } catch {
    return { success: true };
  }
};

class SkillServerRuntimeService implements SkillRuntimeService {
  private resourceService: SkillResourceService;
  private serverDB: LobeChatDatabase;
  private spaceId?: string;
  private skillModel: AgentSkillModel;
  private fileService: FileService;
  private fileModel: FileModel;
  private topicId?: string;
  private userId: string;
  private activeDeviceId?: string;

  constructor(options: {
    activeDeviceId?: string;
    fileModel: FileModel;
    fileService: FileService;
    resourceService: SkillResourceService;
    serverDB: LobeChatDatabase;
    spaceId?: string;
    skillModel: AgentSkillModel;
    topicId?: string;
    userId: string;
  }) {
    this.skillModel = options.skillModel;
    this.resourceService = options.resourceService;
    this.serverDB = options.serverDB;
    this.spaceId = options.spaceId;
    this.fileService = options.fileService;
    this.fileModel = options.fileModel;
    this.topicId = options.topicId;
    this.userId = options.userId;
    this.activeDeviceId = options.activeDeviceId;
  }

  findAll = (): Promise<{ data: SkillListItem[]; total: number }> => {
    return this.skillModel.findAll();
  };

  findById = (id: string): Promise<SkillItem | undefined> => {
    return this.skillModel.findById(id);
  };

  findByName = (name: string): Promise<SkillItem | undefined> => {
    return this.skillModel.findByName(name);
  };

  readResource = async (id: string, path: string): Promise<SkillResourceContent> => {
    const skill = await this.skillModel.findById(id);
    if (!skill) throw new Error(`Skill not found: ${id}`);
    if (!skill.resources) throw new Error(`Skill has no resources: ${id}`);
    return this.resourceService.readResource(skill.resources, path);
  };

  execScript = async (
    command: string,
    options: {
      config?: { description?: string; id?: string; name?: string };
      context?: SkillRuntimeContext;
      description: string;
      runInClient?: boolean;
      timeout?: number;
    },
  ): Promise<CommandResult> => {
    const { config, context, description } = options;

    if (!this.activeDeviceId) {
      return {
        exitCode: 1,
        output: '',
        stderr:
          'No active desktop device selected. Start LobeHub Desktop, connect it to Device Gateway, enable Remote Tool Execution, and activate the device before running Skills.',
        success: false,
      };
    }

    try {
      // Look up skill zipUrl if config is provided (same logic as market.ts)
      const enhancedParams: ExecScriptDeviceParams = {
        command,
        config,
        description,
      };
      const executionContextId = resolveExecutionContextId(context);
      if (executionContextId) enhancedParams.executionContextId = executionContextId;

      const timeout = normalizeRemoteCommandTimeout(options.timeout);
      if (timeout !== undefined) enhancedParams.timeout = timeout;

      if (config?.name) {
        const skill = await this.skillModel.findByName(config.name);

        // If skill not found, return error with available skills
        if (!skill) {
          const allSkills = await this.skillModel.findAll();
          const availableSkills = allSkills.data.map((s) => s.name).join(', ');

          const errorMessage = availableSkills
            ? `Skill "${config.name}" not found. Available skills: ${availableSkills}`
            : `Skill "${config.name}" not found. No skills available. Please import a skill first.`;

          log('Skill not found: %s. Available skills: %s', config.name, availableSkills);

          return {
            exitCode: 1,
            output: '',
            stderr: errorMessage,
            success: false,
          };
        }

        if (skill.zipSha256) {
          const zipUrl = await resolveAccessibleSkillZipProxyUrl({
            fileModel: this.fileModel,
            internal: true,
            skillId: skill.id,
            zipSha256: skill.zipSha256,
          });
          if (zipUrl) {
            enhancedParams.zipUrl = zipUrl;
            enhancedParams.zipSha256 = skill.zipSha256;
            log(
              'Added stable zipUrl to execScript params for skill %s: %s',
              skill.name,
              enhancedParams.zipUrl,
            );
          }
        }
      }

      return await this.execScriptOnDevice(enhancedParams);
    } catch (error) {
      log('Error executing script: %O', error);
      return {
        exitCode: 1,
        output: '',
        stderr: (error as Error).message || 'Command execution failed',
        success: false,
      };
    }
  };

  private execScriptOnDevice = async (params: ExecScriptDeviceParams): Promise<CommandResult> => {
    if (!this.activeDeviceId) {
      return {
        exitCode: 1,
        output: '',
        stderr: 'No active device selected',
        success: false,
      };
    }

    const response = await deviceProxy.executeToolCall(
      { deviceId: this.activeDeviceId, userId: this.userId },
      {
        apiName: 'execScript',
        arguments: JSON.stringify(params),
        identifier: SkillsIdentifier,
      },
      params.timeout ?? REMOTE_COMMAND_DEFAULT_TIMEOUT,
    );

    if (!response.success) {
      return toFailedCommandResult(response, 'Device command execution failed');
    }

    return toCommandResult(parseRemoteCommandResult(response.content));
  };

  exportFile = async (
    path: string,
    filename: string,
    context?: SkillRuntimeContext,
  ): Promise<ExportFileResult> => {
    if (!this.topicId) {
      throw new Error('topicId is required for exportFile');
    }
    if (!this.activeDeviceId) {
      return {
        filename,
        success: false,
      };
    }

    try {
      const exportSpaceId = await resolveTargetSpaceIdForSandboxExport({
        db: this.serverDB,
        ...(this.spaceId ? { spaceId: this.spaceId } : {}),
        topicId: this.topicId,
        userId: this.userId,
      });

      const blobProvider = getBlobProvider();
      const key = generateSandboxExportStorageKey(exportSpaceId);

      // Step 1: Generate pre-signed upload URL
      const uploadUrl = await blobProvider.createUploadUrl(key);
      log('Generated upload URL for key: %s', key);

      // Step 2: Ask the active desktop device to upload the generated file directly to storage.
      const response = await deviceProxy.executeToolCall(
        { deviceId: this.activeDeviceId, userId: this.userId },
        {
          apiName: 'exportFile',
          arguments: JSON.stringify({
            executionContextId: resolveExecutionContextId(context),
            filename,
            path,
            uploadUrl,
          }),
          identifier: SkillsIdentifier,
        },
        120_000,
      );

      log('Device exportFile response: %O', response);

      if (!response.success) {
        return {
          filename,
          success: false,
        };
      }

      const result = parseRemoteExportFileResult(response.content);
      const uploadSuccess = result?.success !== false;

      if (!uploadSuccess) {
        return {
          filename,
          success: false,
        };
      }

      // Step 3: Resolve content type from storage metadata / device response
      const metadata = await blobProvider.getObjectMetadata(key);
      const mimeType = metadata.contentType || result?.mimeType || 'application/octet-stream';

      // Step 4: Create a persistent file record using the real stored-object sha256
      const {
        fileId,
        size: fileSize,
        url,
      } = await this.fileService.createFileRecordFromStorageObject({
        fileType: mimeType,
        name: filename,
        spaceId: exportSpaceId,
        storageKey: key, // Store S3 key
      });

      log('Created file record: fileId=%s, url=%s', fileId, url);

      return {
        fileId,
        filename,
        mimeType,
        size: fileSize,
        success: true,
        url, // This is the permanent /f:id URL
      };
    } catch (error) {
      log('Error exporting file: %O', error);
      return {
        filename,
        success: false,
      };
    }
  };
}

/**
 * Skills Server Runtime
 * Per-request runtime (needs serverDB, userId, topicId)
 */
export const skillsRuntime: ServerRuntimeRegistration = {
  factory: async (context) => {
    if (!context.serverDB) {
      throw new Error('serverDB is required for Skills execution');
    }
    if (!context.userId) {
      throw new Error('userId is required for Skills execution');
    }

    const skillModel = new AgentSkillModel(context.serverDB, context.userId);
    const resourceService = new SkillResourceService(context.serverDB, context.userId);
    const fileService = new FileService(context.serverDB, context.userId);
    const fileModel = new FileModel(context.serverDB, context.userId);

    const service = new SkillServerRuntimeService({
      activeDeviceId: context.activeDeviceId,
      fileModel,
      fileService,
      resourceService,
      serverDB: context.serverDB,
      spaceId: context.spaceId,
      skillModel,
      topicId: context.topicId,
      userId: context.userId,
    });

    return new SkillsExecutionRuntime({
      builtinSkills: filterBuiltinSkills(builtinSkills),
      service,
    });
  },
  identifier: SkillsIdentifier,
};
