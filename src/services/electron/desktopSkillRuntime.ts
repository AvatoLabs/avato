import type { ExecScriptParams } from '@lobechat/builtin-tool-skills';
import type {
  ExportFileResult,
  SkillRuntimeContext,
} from '@lobechat/builtin-tool-skills/executionRuntime';

import { fileService } from '@/services/file';
import { agentSkillService } from '@/services/skill';
import { uploadService } from '@/services/upload';

import { localFileService } from './localFileService';

type SkillConfig = ExecScriptParams['config'];
const MAX_EXECUTION_CONTEXTS = 32;

const base64ToFile = (base64: string, filename: string, mimeType: string) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new File([bytes], filename, { type: mimeType });
};

class DesktopSkillRuntimeService {
  private executionDirectoriesByContext = new Map<string, string>();
  private lastExecutionDirectory?: string;
  private registeredCleanupKeys = new Set<string>();

  private getContextKey(context?: SkillRuntimeContext) {
    return context?.operationId || context?.messageId;
  }

  private forgetExecutionDirectory(key: string) {
    const directory = this.executionDirectoriesByContext.get(key);

    this.executionDirectoriesByContext.delete(key);
    this.registeredCleanupKeys.delete(key);

    if (directory && this.lastExecutionDirectory === directory) {
      this.lastExecutionDirectory = undefined;
    }
  }

  private pruneExecutionDirectories() {
    while (this.executionDirectoriesByContext.size > MAX_EXECUTION_CONTEXTS) {
      const key = this.executionDirectoriesByContext.keys().next().value;
      if (!key) return;

      this.forgetExecutionDirectory(key);
    }
  }

  private rememberExecutionDirectory(directory: string | undefined, context?: SkillRuntimeContext) {
    this.lastExecutionDirectory = directory;

    const key = this.getContextKey(context);
    if (!key) return;

    if (!directory) {
      this.forgetExecutionDirectory(key);
      return;
    }

    this.executionDirectoriesByContext.set(key, directory);
    this.pruneExecutionDirectories();

    if (context?.registerAfterCompletion && !this.registeredCleanupKeys.has(key)) {
      this.registeredCleanupKeys.add(key);
      context.registerAfterCompletion(() => this.forgetExecutionDirectory(key));
    }
  }

  private resolveRememberedExecutionDirectory(context?: SkillRuntimeContext) {
    const key = this.getContextKey(context);

    return (key && this.executionDirectoriesByContext.get(key)) || this.lastExecutionDirectory;
  }

  private async prepareSkillDirectoryForSkill(skill?: {
    id: string;
    name: string;
    zipSha256?: string | null;
  }) {
    if (!skill?.zipSha256) return undefined;

    const zipUrl = await agentSkillService.getZipUrl(skill.id);
    if (!zipUrl.url) return undefined;

    const prepared = await localFileService.prepareSkillDirectory({
      url: zipUrl.url,
      zipSha256: skill.zipSha256,
    });

    if (!prepared.success) {
      throw new Error(prepared.error || `Failed to prepare local skill directory: ${skill.name}`);
    }

    return prepared.extractedDir;
  }

  private async resolveSkill(params: { id?: string; name?: string }) {
    const skillById = params.id ? await agentSkillService.getById(params.id) : undefined;
    return skillById ?? (params.name ? await agentSkillService.getByName(params.name) : undefined);
  }

  async resolveExecutionDirectory(
    config?: SkillConfig,
    context?: SkillRuntimeContext,
  ): Promise<string | undefined> {
    const skill = await this.resolveSkill({ id: config?.id, name: config?.name });
    const directory = await this.prepareSkillDirectoryForSkill(skill);
    this.rememberExecutionDirectory(directory, context);
    return directory;
  }

  async resolveReferenceFullPath(params: {
    path: string;
    skillId?: string;
    skillName?: string;
  }): Promise<string | undefined> {
    const skill = await this.resolveSkill({ id: params.skillId, name: params.skillName });
    if (!skill?.zipSha256) return undefined;

    const zipUrl = await agentSkillService.getZipUrl(skill.id);
    if (!zipUrl.url) return undefined;

    const resolved = await localFileService.resolveSkillResourcePath({
      path: params.path,
      url: zipUrl.url,
      zipSha256: skill.zipSha256,
    });

    if (!resolved.success) {
      throw new Error(
        resolved.error || `Failed to resolve skill resource path: ${skill.name}/${params.path}`,
      );
    }

    return resolved.fullPath;
  }

  async exportFile(
    path: string,
    filename: string,
    context?: SkillRuntimeContext,
  ): Promise<ExportFileResult> {
    const executionDirectory = this.resolveRememberedExecutionDirectory(context);

    if (!executionDirectory) {
      return {
        filename,
        success: false,
      };
    }

    const localFile = await localFileService.readFileAsBase64({
      baseDir: executionDirectory,
      path,
    });
    if (
      !localFile.success ||
      localFile.base64 === undefined ||
      !localFile.sha256 ||
      localFile.size === undefined
    ) {
      return {
        filename,
        success: false,
      };
    }

    const mimeType = localFile.mimeType || 'application/octet-stream';
    const file = base64ToFile(localFile.base64, filename, mimeType);
    const { data: metadata } = await uploadService.uploadFileToS3(file, {
      filename,
      sha256: localFile.sha256,
    });
    const storageKey = metadata.path;
    const record = await fileService.createFile({
      fileType: mimeType,
      metadata,
      name: filename,
      sha256: localFile.sha256,
      size: localFile.size,
      source: 'skill-export',
      storageKey,
    });

    return {
      fileId: record.id,
      filename,
      mimeType,
      size: localFile.size,
      success: true,
      url: record.url,
    };
  }
}

export const desktopSkillRuntimeService = new DesktopSkillRuntimeService();
