import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import os from 'node:os';

import WebSocket from 'ws';

import type {
  ClientMessage,
  ConnectionStatus,
  GatewayClientEvents,
  SystemInfoRequestMessage,
  SystemInfoResponseMessage,
  ToolCallRequestMessage,
  ToolCallResponseMessage,
} from './types';

// ─── Constants ───

const DEFAULT_GATEWAY_URL = 'https://device-gateway.lobehub.com';
const HEARTBEAT_INTERVAL = 30_000; // 30s
const INITIAL_RECONNECT_DELAY = 1000; // 1s
const MAX_RECONNECT_DELAY = 30_000; // 30s
const DEFAULT_AUTH_TIMEOUT = 15_000; // 15s
const normalizeGatewayUrl = (url: string) => url.replace(/\/+$/, '');
const redactWsUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    parsed.search = '';
    return parsed.toString();
  } catch {
    return '<invalid gateway url>';
  }
};

const isRecord = (data: unknown): data is Record<string, unknown> => {
  return !!data && typeof data === 'object' && !Array.isArray(data);
};

const isToolCallRequestMessage = (message: unknown): message is ToolCallRequestMessage => {
  if (!isRecord(message)) return false;

  const toolCall = message.toolCall;
  if (!isRecord(toolCall)) return false;

  return (
    message.type === 'tool_call_request' &&
    typeof message.requestId === 'string' &&
    message.requestId.length > 0 &&
    typeof toolCall.apiName === 'string' &&
    toolCall.apiName.length > 0 &&
    typeof toolCall.arguments === 'string' &&
    typeof toolCall.identifier === 'string' &&
    toolCall.identifier.length > 0
  );
};

const isSystemInfoRequestMessage = (message: unknown): message is SystemInfoRequestMessage => {
  if (!isRecord(message)) return false;

  return (
    message.type === 'system_info_request' &&
    typeof message.requestId === 'string' &&
    message.requestId.length > 0
  );
};

// ─── Logger Interface ───

export interface GatewayClientLogger {
  debug: (msg: string, ...args: unknown[]) => void;
  error: (msg: string, ...args: unknown[]) => void;
  info: (msg: string, ...args: unknown[]) => void;
  warn: (msg: string, ...args: unknown[]) => void;
}

const noopLogger: GatewayClientLogger = {
  debug: () => {},
  error: () => {},
  info: () => {},
  warn: () => {},
};

export interface GatewayClientOptions {
  allowRemoteTools?: boolean;
  /** Auto-reconnect on disconnection (default: true) */
  autoReconnect?: boolean;
  deviceId?: string;
  gatewayUrl?: string;
  logger?: GatewayClientLogger;
  token: string;
  userId?: string;
}

export interface GatewayClientConnectOptions {
  timeoutMs?: number;
  waitForAuth?: boolean;
}

export class GatewayClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = INITIAL_RECONNECT_DELAY;
  private status: ConnectionStatus = 'disconnected';
  private intentionalDisconnect = false;
  private deviceId: string;
  private gatewayUrl: string;
  private token: string;
  private userId?: string;
  private logger: GatewayClientLogger;
  private autoReconnect: boolean;
  private allowRemoteTools: boolean;

  constructor(options: GatewayClientOptions) {
    super();
    this.token = options.token;
    this.gatewayUrl = normalizeGatewayUrl(options.gatewayUrl || DEFAULT_GATEWAY_URL);
    this.deviceId = options.deviceId || randomUUID();
    this.userId = options.userId;
    this.logger = options.logger || noopLogger;
    this.autoReconnect = options.autoReconnect ?? true;
    this.allowRemoteTools = options.allowRemoteTools === true;
  }

  // ─── Public API ───

  get connectionStatus(): ConnectionStatus {
    return this.status;
  }

  get currentDeviceId(): string {
    return this.deviceId;
  }

  override on<K extends keyof GatewayClientEvents>(
    event: K,
    listener: GatewayClientEvents[K],
  ): this {
    return super.on(event, listener);
  }

  override emit<K extends keyof GatewayClientEvents>(
    event: K,
    ...args: Parameters<GatewayClientEvents[K]>
  ): boolean {
    return super.emit(event, ...args);
  }

  async connect(options: GatewayClientConnectOptions = {}): Promise<void> {
    if (this.status === 'connected') {
      return;
    }

    if (this.status === 'connecting' || this.status === 'authenticating') {
      if (options.waitForAuth) {
        await this.waitForAuthentication(options.timeoutMs);
      }
      return;
    }

    this.intentionalDisconnect = false;

    const authWaiter = options.waitForAuth
      ? this.waitForAuthentication(options.timeoutMs)
      : undefined;

    this.doConnect();

    await authWaiter;
  }

  async disconnect(): Promise<void> {
    this.intentionalDisconnect = true;
    this.cleanup();
    this.setStatus('disconnected');
  }

  sendToolCallResponse(response: Omit<ToolCallResponseMessage, 'type'>): void {
    this.sendMessage({
      ...response,
      type: 'tool_call_response',
    });
  }

  sendSystemInfoResponse(response: Omit<SystemInfoResponseMessage, 'type'>): void {
    this.sendMessage({
      ...response,
      type: 'system_info_response',
    });
  }

  setAllowRemoteTools(allowRemoteTools: boolean): void {
    this.allowRemoteTools = allowRemoteTools;
    if (this.status === 'connected') {
      this.sendHeartbeat();
    }
  }

  // ─── Connection Logic ───

  private doConnect() {
    this.clearReconnectTimer();

    this.setStatus('connecting');

    try {
      const wsUrl = this.buildWsUrl();
      this.logger.debug(`Connecting to: ${redactWsUrl(wsUrl)}`);

      const ws = new WebSocket(wsUrl);

      ws.on('open', this.handleOpen);
      ws.on('message', this.handleMessage);
      ws.on('close', this.handleClose);
      ws.on('error', this.handleError);

      this.ws = ws;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const normalizedError = error instanceof Error ? error : new Error(msg);
      this.logger.error('Failed to create WebSocket:', msg);
      this.emitError(normalizedError);
      this.setStatus('disconnected');
      if (this.autoReconnect) {
        this.scheduleReconnect();
      } else {
        this.emit('disconnected');
      }
    }
  }

  private buildWsUrl(): string {
    const url = new URL(this.gatewayUrl);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = `${url.pathname.replace(/\/+$/, '')}/ws`;
    url.search = '';

    const params = new URLSearchParams({
      allowRemoteTools: String(this.allowRemoteTools),
      deviceId: this.deviceId,
      hostname: os.hostname(),
      platform: process.platform,
    });

    // Service token mode: pass userId in query
    if (this.userId) {
      params.set('userId', this.userId);
    }

    url.search = params.toString();
    return url.toString();
  }

  // ─── WebSocket Event Handlers ───

  private handleOpen = () => {
    this.logger.info('WebSocket connected, sending auth...');
    this.reconnectDelay = INITIAL_RECONNECT_DELAY;
    this.setStatus('authenticating');

    // Send token as first message instead of in URL
    this.sendMessage({ type: 'auth', token: this.token });
  };

  private handleMessage = (data: WebSocket.Data) => {
    try {
      const message = JSON.parse(String(data)) as unknown;
      if (!isRecord(message) || typeof message.type !== 'string') {
        this.logger.warn('Invalid gateway message shape');
        return;
      }

      switch (message.type) {
        case 'auth_success': {
          this.logger.info('Authentication successful');
          this.setStatus('connected');
          this.startHeartbeat();
          this.emit('connected');
          break;
        }

        case 'auth_failed': {
          const reason =
            typeof message.reason === 'string' && message.reason.length > 0
              ? message.reason
              : 'Unknown reason';
          this.logger.error(`Authentication failed: ${reason}`);
          this.emit('auth_failed', reason);
          this.disconnect();
          break;
        }

        case 'heartbeat_ack': {
          this.emit('heartbeat_ack');
          break;
        }

        case 'tool_call_request': {
          if (!isToolCallRequestMessage(message)) {
            this.logger.warn('Invalid tool_call_request message shape');
            break;
          }
          this.emit('tool_call_request', message);
          break;
        }

        case 'system_info_request': {
          if (!isSystemInfoRequestMessage(message)) {
            this.logger.warn('Invalid system_info_request message shape');
            break;
          }
          this.emit('system_info_request', message);
          break;
        }

        case 'auth_expired': {
          this.logger.warn('Received auth_expired from gateway');
          this.emit('auth_expired');
          void this.disconnect();
          break;
        }

        default: {
          this.logger.warn('Unknown message type:', message.type);
        }
      }
    } catch (error) {
      this.logger.error('Failed to parse WebSocket message:', error as string);
    }
  };

  private handleClose = (code: number, reason: Buffer) => {
    this.logger.info(`WebSocket closed: code=${code} reason=${reason.toString()}`);
    this.stopHeartbeat();
    this.ws = null;

    if (!this.intentionalDisconnect && this.autoReconnect) {
      this.setStatus('reconnecting');
      this.scheduleReconnect();
    } else {
      this.setStatus('disconnected');
      this.emit('disconnected');
    }
  };

  private handleError = (error: Error) => {
    this.logger.error('WebSocket error:', error.message);
    this.emitError(error);
  };

  // ─── Heartbeat ───

  private startHeartbeat() {
    this.stopHeartbeat();
    this.sendHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, HEARTBEAT_INTERVAL);
  }

  private sendHeartbeat() {
    this.sendMessage({ allowRemoteTools: this.allowRemoteTools, type: 'heartbeat' });
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // ─── Reconnection (exponential backoff) ───

  private scheduleReconnect() {
    this.clearReconnectTimer();

    const delay = this.reconnectDelay;
    this.logger.info(`Scheduling reconnect in ${delay}ms`);
    this.emit('reconnecting', delay);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.logger.info('Attempting reconnect');
      this.doConnect();
    }, delay);

    // Exponential backoff: 1s → 2s → 4s → 8s → ... → 30s
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, MAX_RECONNECT_DELAY);
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // ─── Status ───

  private setStatus(status: ConnectionStatus) {
    if (this.status === status) return;

    this.status = status;
    this.emit('status_changed', status);
  }

  // ─── Helpers ───

  private sendMessage(data: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(data));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn('Failed to send WebSocket message:', message);
        this.emitError(error instanceof Error ? error : new Error(message));
      }
    }
  }

  private emitError(error: Error) {
    if (this.listenerCount('error') === 0) return;
    this.emit('error', error);
  }

  private waitForAuthentication(timeoutMs = DEFAULT_AUTH_TIMEOUT): Promise<void> {
    if (this.status === 'connected') return Promise.resolve();

    return new Promise((resolve, reject) => {
      let settled = false;

      const cleanup = () => {
        clearTimeout(timeout);
        this.removeListener('connected', handleConnected);
        this.removeListener('auth_failed', handleAuthFailed);
        this.removeListener('disconnected', handleDisconnected);
        this.removeListener('error', handleError);
        this.removeListener('reconnecting', handleReconnecting);
      };

      const resolveOnce = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      };

      const rejectOnce = (error: Error) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      };

      const handleConnected = () => resolveOnce();
      const handleAuthFailed = (reason: string) =>
        rejectOnce(new Error(reason || 'Device Gateway authentication failed'));
      const handleDisconnected = () =>
        rejectOnce(new Error('Device Gateway disconnected before authentication'));
      const handleError = (error: Error) => rejectOnce(error);
      const handleReconnecting = () =>
        rejectOnce(new Error('Device Gateway reconnecting before authentication'));

      const timeout = setTimeout(() => {
        rejectOnce(new Error(`Device Gateway authentication timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.on('connected', handleConnected);
      this.on('auth_failed', handleAuthFailed);
      this.on('disconnected', handleDisconnected);
      this.on('error', handleError);
      this.on('reconnecting', handleReconnecting);
    });
  }

  private closeWebSocket() {
    if (this.ws) {
      this.ws.removeAllListeners();

      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close(1000, 'Client disconnect');
      }
      this.ws = null;
    }
  }

  private cleanup() {
    this.stopHeartbeat();
    this.clearReconnectTimer();
    this.closeWebSocket();
  }
}
