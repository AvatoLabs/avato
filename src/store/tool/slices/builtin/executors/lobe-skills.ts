/**
 * Lobe Skills Executor
 *
 * Creates and exports the SkillsExecutor instance for registration.
 * Injects agentSkillService as dependency.
 */
import { builtinSkills } from '@lobechat/builtin-skills';
import { SkillsExecutionRuntime } from '@lobechat/builtin-tool-skills/executionRuntime';
import { SkillsExecutor } from '@lobechat/builtin-tool-skills/executor';

import { filterBuiltinSkills } from '@/helpers/skillFilters';
import { remoteDeviceService } from '@/services/remoteDevice';
import { agentSkillService } from '@/services/skill';

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

const isRemoteCommandResult = (value: unknown): value is RemoteCommandResult => {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    remoteCommandResultKeys.some((key) => key in value)
  );
};

const stringifyRemoteOutput = (value: unknown, fallback: string) => {
  if (typeof value === 'string') return value;
  if (value === undefined) return fallback;
  return JSON.stringify(value);
};

const missingDeviceResult = {
  exitCode: 1,
  output: '',
  stderr:
    'No online desktop device found with Remote Tool Execution enabled. Start LobeHub Desktop, connect it to Device Gateway, and enable Remote Tool Execution.',
  success: false,
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

const toCommandResult = (result: RemoteCommandResult) => {
  const exitCode = result.exitCode ?? result.exit_code ?? (result.success === false ? 1 : 0);

  return {
    exitCode,
    output: result.stdout || result.output || '',
    stderr: result.stderr || result.error || '',
    success: result.success ?? exitCode === 0,
  };
};

const toFailedCommandResult = (
  result: { content: string; error?: string },
  fallbackError: string,
) => {
  const parsedResult = toCommandResult(parseRemoteCommandResult(result.content));

  return {
    exitCode: parsedResult.exitCode === 0 ? 1 : parsedResult.exitCode,
    output: parsedResult.output || result.content || '',
    stderr: parsedResult.stderr || result.error || fallbackError,
    success: false,
  };
};

const resolveSkillPackage = async (config?: { id?: string; name?: string }) => {
  const skill = config?.id
    ? await agentSkillService.getById(config.id)
    : config?.name
      ? await agentSkillService.getByName(config.name)
      : undefined;

  if (!skill?.zipSha256) return {};

  const zipUrl = await agentSkillService.getZipUrl(skill.id);
  if (!zipUrl.url) return {};

  return {
    zipSha256: skill.zipSha256,
    zipUrl: zipUrl.url,
  };
};

// Create runtime with client-side service
const runtime = new SkillsExecutionRuntime({
  builtinSkills: filterBuiltinSkills(builtinSkills),
  service: {
    execScript: async (command, options) => {
      const { description, config, context } = options;

      try {
        const deviceId = await remoteDeviceService.getActiveDeviceId();
        if (!deviceId) {
          return missingDeviceResult;
        }

        const skillPackage = await resolveSkillPackage(config);
        const result = await remoteDeviceService.executeToolCall({
          apiName: 'execScript',
          arguments: JSON.stringify({
            command,
            config,
            description,
            executionContextId: context?.operationId || context?.messageId,
            ...skillPackage,
          }),
          deviceId,
          identifier: 'lobe-skills',
          timeout: 120_000,
        });

        if (!result.success) {
          return toFailedCommandResult(result, 'Remote device command execution failed');
        }

        return toCommandResult(parseRemoteCommandResult(result.content));
      } catch (error) {
        return {
          exitCode: 1,
          output: '',
          stderr: (error as Error).message || 'Command execution failed',
          success: false,
        };
      }
    },
    findAll: () => agentSkillService.list(),
    findById: (id) => agentSkillService.getById(id),
    findByName: (name) => agentSkillService.getByName(name),
    readResource: (id, path) => agentSkillService.readResource(id, path),
    runCommand: async ({ command, timeout }) => {
      try {
        const deviceId = await remoteDeviceService.getActiveDeviceId();
        if (!deviceId) {
          return missingDeviceResult;
        }

        const result = await remoteDeviceService.executeToolCall({
          apiName: 'runCommand',
          arguments: JSON.stringify({
            command,
            description: `Execute skill command: ${command.slice(0, 100)}${command.length > 100 ? '...' : ''}`,
            timeout,
          }),
          deviceId,
          identifier: 'lobe-local-system',
          timeout: timeout ?? 120_000,
        });

        if (!result.success) {
          return toFailedCommandResult(result, 'Remote device command execution failed');
        }

        return toCommandResult(parseRemoteCommandResult(result.content));
      } catch (error) {
        return {
          exitCode: 1,
          output: '',
          stderr: (error as Error).message || 'Command execution failed',
          success: false,
        };
      }
    },
  },
});

// Create executor instance with the runtime
export const skillsExecutor = new SkillsExecutor(runtime);
