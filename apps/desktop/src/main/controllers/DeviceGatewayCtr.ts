import os from 'node:os';
import path from 'node:path';

import type {
  ConnectionStatus,
  DeviceSystemInfo,
  GatewayClientLogger,
  SystemInfoRequestMessage,
  ToolCallRequestMessage,
} from '@lobechat/device-gateway-client';
import { GatewayClient } from '@lobechat/device-gateway-client';
import type {
  DeviceGatewayConfig,
  DeviceGatewayResult,
  DeviceGatewayStatus,
  NetworkProxySettings,
} from '@lobechat/electron-client-ipc';
import { app as electronApp } from 'electron';
import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import superjson from 'superjson';

import { DEVICE_GATEWAY_URL } from '@/const/env';
import { defaultProxySettings } from '@/const/store';
import { ProxyUrlBuilder } from '@/modules/networkProxy';
import { createLogger } from '@/utils/logger';

import type { MCPClientParams } from '../libs/mcp/types';
import { ControllerModule, IpcMethod } from './index';
import LocalFileCtr from './LocalFileCtr';
import McpCtr from './McpCtr';
import RemoteServerConfigCtr from './RemoteServerConfigCtr';
import ShellCommandCtr from './ShellCommandCtr';

const logger = createLogger('controllers:DeviceGatewayCtr');

const LOCAL_SYSTEM_IDENTIFIER = 'lobe-local-system';
const MCP_IDENTIFIER = 'lobe-mcp';
const SKILLS_IDENTIFIER = 'lobe-skills';
const SKILL_EXEC_SCRIPT = 'execScript';
const SKILL_EXPORT_FILE = 'exportFile';
const MCP_CALL_TOOL = 'callTool';
const GATEWAY_START_AUTH_TIMEOUT = 15_000;
const MAX_GATEWAY_TOOL_RESPONSE_CONTENT_LENGTH = 5_000_000;
const MAX_SKILL_EXECUTION_CONTEXTS = 32;
const REMOTE_TOOLS_DISABLED_ERROR = 'REMOTE_TOOLS_DISABLED';

interface ToolCallResult {
  content: string;
  error?: string;
  success: boolean;
}

interface ExecScriptParams {
  command: string;
  config?: {
    description?: string;
    id?: string;
    name?: string;
  };
  description?: string;
  executionContextId?: string;
  timeout?: number;
  zipSha256?: string;
  zipUrl?: string;
}

interface ExportFileParams {
  executionContextId?: string;
  filename: string;
  path: string;
  uploadUrl: string;
}

interface StartAgentOptions {
  suppressMissingRemoteConfigError?: boolean;
}

const normalizeGatewayUrl = (url?: string) => {
  const value = url?.trim();
  return value ? value.replace(/\/+$/, '') : undefined;
};

const hasConfigField = (
  config: DeviceGatewayConfig | undefined,
  field: keyof DeviceGatewayConfig,
) => !!config && Object.prototype.hasOwnProperty.call(config, field);

const mergeDeviceGatewayConfig = (
  current: DeviceGatewayConfig,
  patch: DeviceGatewayConfig,
): DeviceGatewayConfig => {
  const next: DeviceGatewayConfig = {
    ...current,
    ...patch,
  };

  if (hasConfigField(patch, 'gatewayUrl')) {
    const gatewayUrl = normalizeGatewayUrl(patch.gatewayUrl);
    if (gatewayUrl) {
      next.gatewayUrl = gatewayUrl;
    } else {
      delete next.gatewayUrl;
    }
  }

  return next;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === 'object' && !Array.isArray(value);
};

const isLocalOrPrivateMCPUrl = (value: string) => {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;

    const hostname = url.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname.endsWith('.localhost')) return true;
    if (hostname === '::1' || hostname === '[::1]') return true;
    if (hostname === '0.0.0.0') return true;

    const parts = hostname.split('.').map((part) => Number(part));
    if (
      parts.length !== 4 ||
      parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
    ) {
      return false;
    }

    const [a, b] = parts;
    return a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  } catch {
    return false;
  }
};

const decodeJwtPayload = (token: string): Record<string, unknown> | undefined => {
  const payload = token.split('.')[1];
  if (!payload) return undefined;

  try {
    const normalized = payload.replaceAll('-', '+').replaceAll('_', '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as Record<string, unknown>;
  } catch (error) {
    logger.warn('Failed to decode gateway token payload', error);
    return undefined;
  }
};

export default class DeviceGatewayCtr extends ControllerModule {
  static override readonly groupName = 'deviceGateway';

  private client: GatewayClient | null = null;
  private connectionStatus: ConnectionStatus = 'disconnected';
  private lastConnectedAt?: string;
  private lastError?: string;
  private authExpiredRefreshPromise?: Promise<void>;
  private authFailureRefreshAttempted = false;
  private lastSkillExecutionDirectory?: string;
  private skillExecutionDirectoriesByContext = new Map<string, string>();
  private userId?: string;

  private get localFileCtr() {
    return this.app.getController(LocalFileCtr);
  }

  private get remoteServerConfigCtr() {
    return this.app.getController(RemoteServerConfigCtr);
  }

  private get mcpCtr() {
    return this.app.getController(McpCtr);
  }

  private get shellCommandCtr() {
    return this.app.getController(ShellCommandCtr);
  }

  afterAppReady() {
    const config = this.getConfig();
    if (config.enabled === false) return;

    this.startAgentInternal(undefined, { suppressMissingRemoteConfigError: true }).catch(
      (error) => {
        this.lastError = error instanceof Error ? error.message : String(error);
        logger.warn('Failed to auto-start device gateway agent', error);
        this.broadcastStatus();
      },
    );
  }

  @IpcMethod()
  async getAgentStatus(): Promise<DeviceGatewayStatus> {
    return this.getStatus();
  }

  @IpcMethod()
  async setAgentConfig(config: DeviceGatewayConfig): Promise<DeviceGatewayResult> {
    const current = this.getConfig();
    const next = mergeDeviceGatewayConfig(current, config);

    this.app.storeManager.set('deviceGateway', next);

    if (next.enabled === false) {
      await this.stopAgent();
    } else if (
      config.enabled !== undefined ||
      hasConfigField(config, 'gatewayUrl') ||
      config.deviceId !== undefined
    ) {
      await this.startAgent();
    } else {
      this.client?.setAllowRemoteTools(next.allowRemoteTools === true);
      this.broadcastStatus();
    }

    return { status: this.getStatus(), success: !this.lastError };
  }

  @IpcMethod()
  async startAgent(config?: DeviceGatewayConfig): Promise<DeviceGatewayResult> {
    return this.startAgentInternal(config);
  }

  private async startAgentInternal(
    config?: DeviceGatewayConfig,
    options: StartAgentOptions = {},
  ): Promise<DeviceGatewayResult> {
    if (config) {
      this.app.storeManager.set(
        'deviceGateway',
        mergeDeviceGatewayConfig(this.getConfig(), {
          ...config,
          enabled: true,
        }),
      );
    }

    const storedConfig = this.getConfig();
    const remoteConfig = await this.remoteServerConfigCtr.getRemoteServerConfig();

    if (!(await this.remoteServerConfigCtr.isRemoteServerConfigured(remoteConfig))) {
      const error = 'Remote server sync is not active or configured';
      this.lastError = options.suppressMissingRemoteConfigError ? undefined : error;
      this.broadcastStatus();
      return { error, status: this.getStatus(), success: false };
    }

    if (this.remoteServerConfigCtr.isTokenExpiringSoon(5 * 60 * 1000)) {
      const refreshed = await this.remoteServerConfigCtr.refreshAccessToken();
      if (!refreshed.success) {
        this.lastError = refreshed.error || 'Failed to refresh access token';
        this.broadcastStatus();
        return { error: this.lastError, status: this.getStatus(), success: false };
      }
    }

    const token = await this.remoteServerConfigCtr.getAccessToken();
    if (!token) {
      this.lastError = 'Missing remote server access token';
      this.broadcastStatus();
      return { error: this.lastError, status: this.getStatus(), success: false };
    }

    const decoded = decodeJwtPayload(token);
    const tokenUserId = typeof decoded?.sub === 'string' ? decoded.sub : undefined;
    if (!tokenUserId) {
      this.lastError = 'Unable to resolve user id from access token';
      this.broadcastStatus();
      return { error: this.lastError, status: this.getStatus(), success: false };
    }

    const gatewayUrl = normalizeGatewayUrl(storedConfig.gatewayUrl) || DEVICE_GATEWAY_URL;
    const deviceId = storedConfig.deviceId;

    await this.disconnectClient();

    this.userId = tokenUserId;
    this.lastError = undefined;

    const client = new GatewayClient({
      allowRemoteTools: storedConfig.allowRemoteTools === true,
      deviceId,
      gatewayUrl,
      logger: this.createGatewayLogger(),
      token,
      userId: tokenUserId,
      webSocketAgent: this.createGatewayWebSocketAgent(gatewayUrl),
    });

    this.bindClientEvents(client);
    this.client = client;

    if (!deviceId) {
      const nextConfig: DeviceGatewayConfig = {
        ...storedConfig,
        deviceId: client.currentDeviceId,
        enabled: true,
      };

      if (storedConfig.gatewayUrl) nextConfig.gatewayUrl = gatewayUrl;

      this.app.storeManager.set('deviceGateway', nextConfig);
    }

    try {
      await client.connect({ timeoutMs: GATEWAY_START_AUTH_TIMEOUT, waitForAuth: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.lastError = message;
      this.connectionStatus = 'disconnected';
      await this.disconnectClient();
      this.broadcastStatus();
      return { error: message, status: this.getStatus(), success: false };
    }

    this.broadcastStatus();

    return { status: this.getStatus(), success: true };
  }

  @IpcMethod()
  async stopAgent(): Promise<DeviceGatewayResult> {
    this.app.storeManager.set('deviceGateway', { ...this.getConfig(), enabled: false });
    await this.disconnectClient();
    this.connectionStatus = 'disconnected';
    this.broadcastStatus();

    return { status: this.getStatus(), success: true };
  }

  async disconnectForRemoteServerReset() {
    await this.disconnectClient();
    this.connectionStatus = 'disconnected';
    this.lastConnectedAt = undefined;
    this.lastError = undefined;
    this.userId = undefined;
    this.broadcastStatus();
  }

  private getConfig(): DeviceGatewayConfig {
    return this.app.storeManager.get('deviceGateway', {
      allowRemoteTools: false,
      enabled: true,
    });
  }

  private getNetworkProxyConfig(): NetworkProxySettings {
    return this.app.storeManager.get('networkProxy', defaultProxySettings) as NetworkProxySettings;
  }

  private getStatus(): DeviceGatewayStatus {
    const config = this.getConfig();

    return {
      allowRemoteTools: config.allowRemoteTools === true,
      connectionStatus: this.client?.connectionStatus ?? this.connectionStatus,
      deviceId: this.client?.currentDeviceId ?? config.deviceId,
      enabled: config.enabled !== false,
      gatewayUrl: normalizeGatewayUrl(config.gatewayUrl) || DEVICE_GATEWAY_URL,
      lastConnectedAt: this.lastConnectedAt,
      lastError: this.lastError,
      userId: this.userId,
    };
  }

  private bindClientEvents(client: GatewayClient) {
    client.on('status_changed', (status) => {
      this.connectionStatus = status;
      this.broadcastStatus();
    });

    client.on('connected', () => {
      this.lastConnectedAt = new Date().toISOString();
      this.lastError = undefined;
      this.authFailureRefreshAttempted = false;
      this.broadcastStatus();
    });

    client.on('auth_failed', (reason) => {
      this.lastError = reason;
      this.broadcastStatus();
      if (!this.shouldRefreshAfterAuthFailure(reason)) return;

      this.authFailureRefreshAttempted = true;
      this.restartAfterAuthExpired().catch((error) => {
        this.lastError = error instanceof Error ? error.message : String(error);
        this.broadcastStatus();
      });
    });

    client.on('auth_expired', () => {
      this.restartAfterAuthExpired().catch((error) => {
        this.lastError = error instanceof Error ? error.message : String(error);
        this.broadcastStatus();
      });
    });

    client.on('error', (error) => {
      this.lastError = error.message;
      this.broadcastStatus();
    });

    client.on('system_info_request', (request) => {
      this.handleSystemInfoRequest(client, request);
    });

    client.on('tool_call_request', (request) => {
      this.handleToolCallRequest(client, request).catch((error) => {
        logger.error('Unhandled gateway tool call error', error);
        client.sendToolCallResponse({
          requestId: request.requestId,
          result: {
            content: '',
            error: error instanceof Error ? error.message : String(error),
            success: false,
          },
        });
      });
    });
  }

  private async restartAfterAuthExpired() {
    this.authExpiredRefreshPromise ||= this.restartAfterAuthExpiredInternal().finally(() => {
      this.authExpiredRefreshPromise = undefined;
    });

    return this.authExpiredRefreshPromise;
  }

  private shouldRefreshAfterAuthFailure(reason: string) {
    if (!this.lastConnectedAt) return false;
    if (this.authFailureRefreshAttempted) return false;
    if (this.getConfig().enabled === false) return false;

    const normalizedReason = reason.toLowerCase();
    return (
      normalizedReason.includes('expired') ||
      normalizedReason.includes('timestamp') ||
      /(?:^|[^a-z])exp(?:[^a-z]|$)/.test(normalizedReason)
    );
  }

  private async restartAfterAuthExpiredInternal() {
    const refreshed = await this.remoteServerConfigCtr.refreshAccessToken();
    if (!refreshed.success) {
      throw new Error(refreshed.error || 'Failed to refresh access token');
    }

    if (this.getConfig().enabled === false) return;

    await this.startAgent();
  }

  private async disconnectClient() {
    if (!this.client) return;

    const client = this.client;
    this.client = null;
    await client.disconnect();
  }

  private handleSystemInfoRequest(client: GatewayClient, request: SystemInfoRequestMessage) {
    if (!this.isRemoteToolsAllowed()) {
      client.sendSystemInfoResponse({
        requestId: request.requestId,
        result: {
          error: REMOTE_TOOLS_DISABLED_ERROR,
          success: false,
        },
      });
      return;
    }

    client.sendSystemInfoResponse({
      requestId: request.requestId,
      result: {
        success: true,
        systemInfo: this.collectSystemInfo(),
      },
    });
  }

  private async handleToolCallRequest(client: GatewayClient, request: ToolCallRequestMessage) {
    const result = await this.executeToolCall(request.toolCall);

    client.sendToolCallResponse({
      requestId: request.requestId,
      result,
    });
  }

  private async executeToolCall(toolCall: {
    apiName: string;
    arguments: string;
    identifier: string;
  }): Promise<ToolCallResult> {
    if (!this.isRemoteToolsAllowed()) {
      return {
        content: 'Remote desktop tool execution is disabled on this device',
        error: REMOTE_TOOLS_DISABLED_ERROR,
        success: false,
      };
    }

    try {
      const args = this.parseToolArguments(toolCall.arguments);
      let result: unknown;

      if (toolCall.identifier === LOCAL_SYSTEM_IDENTIFIER) {
        result = await this.executeLocalSystemTool(toolCall.apiName, args);
      } else if (toolCall.identifier === MCP_IDENTIFIER) {
        result = await this.executeMCPTool(toolCall.apiName, args);
      } else if (toolCall.identifier === SKILLS_IDENTIFIER) {
        result = await this.executeSkillsTool(toolCall.apiName, args);
      } else {
        return {
          content: '',
          error: `Unsupported device tool: ${toolCall.identifier}/${toolCall.apiName}`,
          success: false,
        };
      }

      return this.buildToolCallResult(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Device tool call failed: ${toolCall.identifier}/${toolCall.apiName}`, error);
      return { content: '', error: message, success: false };
    }
  }

  private buildToolCallResult(result: unknown): ToolCallResult {
    const content = typeof result === 'string' ? result : JSON.stringify(result) || '';
    if (content.length > MAX_GATEWAY_TOOL_RESPONSE_CONTENT_LENGTH) {
      return {
        content: 'Device response is too large',
        error: 'DEVICE_RESPONSE_TOO_LARGE',
        success: false,
      };
    }

    if (isRecord(result) && typeof result.success === 'boolean') {
      return {
        content,
        error: typeof result.error === 'string' ? result.error : undefined,
        success: result.success,
      };
    }

    return { content, success: true };
  }

  private parseToolArguments(rawArguments: string): Record<string, unknown> {
    const args = rawArguments ? (JSON.parse(rawArguments) as unknown) : {};
    if (!isRecord(args)) {
      throw new Error('Tool arguments must be a JSON object');
    }

    return args;
  }

  private executeLocalSystemTool(apiName: string, args: Record<string, unknown>): Promise<unknown> {
    const localFileCtr = this.localFileCtr;
    const shellCommandCtr = this.shellCommandCtr;

    const handlers: Record<string, () => Promise<unknown>> = {
      editLocalFile: () => localFileCtr.handleEditFile(args as any),
      getCommandOutput: () => shellCommandCtr.handleGetCommandOutput(args as any),
      globLocalFiles: () => localFileCtr.handleGlobFiles(args as any),
      grepContent: () => localFileCtr.handleGrepContent(args as any),
      killCommand: () => shellCommandCtr.handleKillCommand(args as any),
      listLocalFiles: () => localFileCtr.listLocalFiles(args as any),
      moveLocalFiles: () => localFileCtr.handleMoveFiles(args as any),
      readLocalFile: () => localFileCtr.readFile(args as any),
      readLocalFiles: () => localFileCtr.readFiles(args as any),
      renameLocalFile: () => localFileCtr.handleRenameFile(args as any),
      runCommand: () => shellCommandCtr.handleRunCommand(args as any),
      searchLocalFiles: () => localFileCtr.handleLocalFilesSearch(args as any),
      writeLocalFile: () => localFileCtr.handleWriteFile(args as any),
    };

    const handler = handlers[apiName];
    if (!handler) {
      throw new Error(`Unsupported Local System API: ${apiName}`);
    }

    return handler();
  }

  private async executeMCPTool(apiName: string, args: Record<string, unknown>): Promise<unknown> {
    if (apiName !== MCP_CALL_TOOL) {
      throw new Error(`Unsupported MCP API: ${apiName}`);
    }

    const toolName = this.readOptionalString(args, 'toolName');
    if (!toolName) {
      throw new Error('Missing MCP tool name');
    }

    const params = this.parseMCPClientParams(args.params);
    const payload = superjson.serialize({
      args: args.args,
      env: this.readOptionalStringRecord(args.env),
      params,
      toolName,
    });

    const serializedResult = await this.mcpCtr.callTool(payload as any);
    return superjson.deserialize(serializedResult as any);
  }

  private parseMCPClientParams(value: unknown): MCPClientParams {
    if (!isRecord(value)) {
      throw new Error('Missing MCP client params');
    }

    const type = this.readOptionalString(value, 'type');
    const name = this.readOptionalString(value, 'name');
    if (!name) {
      throw new Error('Missing MCP client name');
    }

    if (type === 'http') {
      const url = this.readOptionalString(value, 'url');
      if (!url) {
        throw new Error('Missing MCP HTTP url');
      }
      if (!isLocalOrPrivateMCPUrl(url)) {
        throw new Error('Remote MCP HTTP url must be local or private');
      }

      return {
        auth: isRecord(value.auth) ? (value.auth as any) : undefined,
        headers: this.readOptionalStringRecord(value.headers),
        name,
        type: 'http',
        url,
      };
    }

    if (type === 'stdio') {
      const command = this.readOptionalString(value, 'command');
      if (!command) {
        throw new Error('Missing MCP stdio command');
      }

      const rawArgs = Array.isArray(value.args) ? value.args : [];
      const commandArgs = rawArgs.filter((arg): arg is string => typeof arg === 'string');

      return {
        args: commandArgs,
        command,
        env: this.readOptionalStringRecord(value.env),
        name,
        type: 'stdio',
      };
    }

    throw new Error(`Unsupported MCP client type: ${type || 'unknown'}`);
  }

  private async executeSkillsTool(
    apiName: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    if (apiName === SKILL_EXEC_SCRIPT) {
      return this.executeSkillScript(args);
    }

    if (apiName === SKILL_EXPORT_FILE) {
      return this.executeSkillExportFile(args);
    }

    throw new Error(`Unsupported Skills API: ${apiName}`);
  }

  private async executeSkillScript(args: Record<string, unknown>): Promise<unknown> {
    const params = this.parseExecScriptParams(args);

    let cwd: string | undefined;
    if (params.zipUrl && params.zipSha256) {
      const prepared = await this.localFileCtr.handlePrepareSkillDirectory({
        url: params.zipUrl,
        zipSha256: params.zipSha256,
      });

      if (!prepared.success) {
        throw new Error(prepared.error || 'Failed to prepare skill directory');
      }

      cwd = prepared.extractedDir;
    }

    this.rememberSkillExecutionDirectory(cwd, params.executionContextId);

    return this.shellCommandCtr.handleRunCommand({
      command: params.command,
      cwd,
      description: params.description || params.config?.description,
      timeout: params.timeout,
    });
  }

  private async executeSkillExportFile(args: Record<string, unknown>): Promise<unknown> {
    const params = this.parseExportFileParams(args);
    const baseDir = this.resolveSkillExecutionDirectory(params.executionContextId);

    if (!baseDir) {
      return {
        error: 'No skill execution directory is available for export',
        filename: params.filename,
        success: false,
      };
    }

    const localFile = await this.localFileCtr.handleReadFileAsBase64({
      baseDir,
      path: params.path,
    });

    if (!localFile.success || localFile.base64 === undefined) {
      return {
        error: localFile.error || 'Failed to read exported file',
        filename: params.filename,
        success: false,
      };
    }

    const uploadUrl = this.parseUploadUrl(params.uploadUrl);
    const mimeType = localFile.mimeType || 'application/octet-stream';
    const buffer = Buffer.from(localFile.base64, 'base64');
    const response = await fetch(uploadUrl, {
      body: new Blob([buffer], { type: mimeType }),
      headers: { 'content-type': mimeType },
      method: 'PUT',
    });

    if (!response.ok) {
      return {
        error: `Failed to upload exported file: ${response.status} ${response.statusText}`,
        filename: params.filename,
        success: false,
      };
    }

    return {
      filename: params.filename,
      mimeType,
      path: localFile.path,
      sha256: localFile.sha256,
      size: localFile.size,
      success: true,
    };
  }

  private parseExecScriptParams(args: Record<string, unknown>): ExecScriptParams {
    const command = this.readOptionalString(args, 'command');
    if (!command) {
      throw new Error('Missing command for skill execution');
    }

    const params: ExecScriptParams = { command };
    const config = this.parseExecScriptConfig(args.config);

    if (config) params.config = config;

    const description = this.readOptionalString(args, 'description');
    if (description) params.description = description;

    const executionContextId = this.readOptionalString(args, 'executionContextId');
    if (executionContextId) params.executionContextId = executionContextId;

    const timeout =
      typeof args.timeout === 'number' && Number.isFinite(args.timeout) ? args.timeout : undefined;
    if (timeout !== undefined) params.timeout = timeout;

    const zipSha256 =
      this.readOptionalString(args, 'zipSha256') ?? this.readOptionalString(args, 'zipHash');
    if (zipSha256) params.zipSha256 = zipSha256;

    const zipUrl = this.readOptionalString(args, 'zipUrl');
    if (zipUrl) params.zipUrl = zipUrl;

    return params;
  }

  private parseExportFileParams(args: Record<string, unknown>): ExportFileParams {
    const filePath = this.readOptionalString(args, 'path');
    if (!filePath) {
      throw new Error('Missing path for skill file export');
    }

    const filename = this.readOptionalString(args, 'filename');
    if (!filename) {
      throw new Error('Missing filename for skill file export');
    }

    const uploadUrl = this.readOptionalString(args, 'uploadUrl');
    if (!uploadUrl) {
      throw new Error('Missing uploadUrl for skill file export');
    }

    return {
      executionContextId: this.readOptionalString(args, 'executionContextId'),
      filename,
      path: filePath,
      uploadUrl,
    };
  }

  private parseUploadUrl(uploadUrl: string) {
    let url: URL;
    try {
      url = new URL(uploadUrl);
    } catch (error) {
      throw new Error('Invalid uploadUrl for skill file export', { cause: error });
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('Only HTTP(S) upload URLs are supported');
    }

    return url.toString();
  }

  private rememberSkillExecutionDirectory(directory: string | undefined, contextId?: string) {
    this.lastSkillExecutionDirectory = directory;

    if (!contextId) return;

    if (!directory) {
      this.skillExecutionDirectoriesByContext.delete(contextId);
      return;
    }

    this.skillExecutionDirectoriesByContext.set(contextId, directory);
    while (this.skillExecutionDirectoriesByContext.size > MAX_SKILL_EXECUTION_CONTEXTS) {
      const oldestContextId = this.skillExecutionDirectoriesByContext.keys().next().value;
      if (!oldestContextId) return;

      this.skillExecutionDirectoriesByContext.delete(oldestContextId);
    }
  }

  private resolveSkillExecutionDirectory(contextId?: string) {
    return (
      (contextId ? this.skillExecutionDirectoriesByContext.get(contextId) : undefined) ||
      this.lastSkillExecutionDirectory
    );
  }

  private parseExecScriptConfig(value: unknown): ExecScriptParams['config'] {
    if (!isRecord(value)) return undefined;

    const config: NonNullable<ExecScriptParams['config']> = {};
    const description = this.readOptionalString(value, 'description');
    if (description) config.description = description;

    const id = this.readOptionalString(value, 'id');
    if (id) config.id = id;

    const name = this.readOptionalString(value, 'name');
    if (name) config.name = name;

    return Object.keys(config).length > 0 ? config : undefined;
  }

  private readOptionalString(data: Record<string, unknown>, key: string): string | undefined {
    const value = data[key];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }

  private readOptionalStringRecord(value: unknown): Record<string, string> | undefined {
    if (!isRecord(value)) return undefined;

    const entries = Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    );

    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
  }

  private collectSystemInfo(): DeviceSystemInfo {
    const home = electronApp.getPath('home');
    const userData = electronApp.getPath('userData');
    const videosDir = process.platform === 'linux' ? 'Videos' : 'Movies';

    return {
      arch: os.arch(),
      desktopPath: electronApp.getPath('desktop'),
      documentsPath: electronApp.getPath('documents'),
      downloadsPath: electronApp.getPath('downloads'),
      homePath: home,
      musicPath: electronApp.getPath('music'),
      picturesPath: electronApp.getPath('pictures'),
      userDataPath: userData,
      videosPath: path.join(home, videosDir),
      workingDirectory: process.cwd(),
    };
  }

  private isRemoteToolsAllowed() {
    return this.getConfig().allowRemoteTools === true;
  }

  private broadcastStatus() {
    this.app.browserManager.broadcastToAllWindows('deviceGatewayStatusChanged', this.getStatus());
  }

  private createGatewayLogger(): GatewayClientLogger {
    return {
      debug: (msg, ...args) => logger.debug(msg, ...args),
      error: (msg, ...args) => logger.error(msg, ...args),
      info: (msg, ...args) => logger.info(msg, ...args),
      warn: (msg, ...args) => logger.warn(msg, ...args),
    };
  }

  private createGatewayWebSocketAgent(gatewayUrl: string) {
    const proxyConfig = this.getNetworkProxyConfig();
    if (!proxyConfig.enableProxy || !proxyConfig.proxyServer) return undefined;

    if (proxyConfig.proxyType === 'socks5') {
      logger.warn(
        'Device Gateway WebSocket proxy does not support socks5 yet; falling back direct',
      );
      return undefined;
    }

    const proxyUrl = ProxyUrlBuilder.build(proxyConfig);
    const gatewayProtocol = new URL(gatewayUrl).protocol;

    return gatewayProtocol === 'https:' || gatewayProtocol === 'wss:'
      ? new HttpsProxyAgent(proxyUrl)
      : new HttpProxyAgent(proxyUrl);
  }
}
