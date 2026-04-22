import { DurableObject } from 'cloudflare:workers';
import { Hono } from 'hono';

import { verifyDesktopToken } from './auth';
import {
  decodeWebSocketMessage,
  isActiveAuthenticatedDeviceAttachment,
  isServiceTokenDeviceAuthEnabled,
  normalizeDeviceRpcResult,
  resolveNextDeviceAlarm,
  resolveRemoteToolTarget,
  shouldReplaceAuthenticatedDeviceSocket,
  toPublicDeviceAttachment,
} from './device';
import {
  isRecord,
  MAX_DEVICE_METADATA_FIELD_LENGTH,
  MAX_IDENTIFIER_FIELD_LENGTH,
  readJsonObjectBody,
  readOptionalStringField,
  readToolCallField,
  resolveRpcTimeout,
} from './request';
import type { DeviceAttachment, Env } from './types';

const AUTH_TIMEOUT = 10_000; // 10s to authenticate after connect
const HEARTBEAT_TIMEOUT = 90_000; // 90s without heartbeat → close
const MAX_CONNECTIONS_PER_USER = 32;
const MAX_UNAUTHENTICATED_CONNECTIONS_PER_USER = 8;
const MAX_PENDING_REQUESTS = 128;
const SYSTEM_INFO_TIMEOUT = 10_000;
const TOOL_CALL_TIMEOUT = 30_000;

export class DeviceGatewayDO extends DurableObject<Env> {
  private pendingRequests = new Map<
    string,
    {
      reject: (error: Error) => void;
      resolve: (result: unknown) => void;
      targetWs: WebSocket;
      timer: ReturnType<typeof setTimeout>;
    }
  >();

  private router = new Hono()
    .post('/api/device/status', async () => {
      const sockets = this.getAuthenticatedSockets();
      return Response.json({
        deviceCount: sockets.length,
        online: sockets.length > 0,
      });
    })
    .post('/api/device/tool-call', async (c) => {
      return this.handleToolCall(c.req.raw);
    })
    .post('/api/device/system-info', async (c) => {
      return this.handleSystemInfo(c.req.raw);
    })
    .post('/api/device/devices', async () => {
      const sockets = this.getAuthenticatedSockets();
      const devices = sockets.map((ws) =>
        toPublicDeviceAttachment(ws.deserializeAttachment() as DeviceAttachment),
      );
      return Response.json({ devices });
    });

  async fetch(request: Request): Promise<Response> {
    // ─── WebSocket upgrade (from Desktop) ───
    if (request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
      return this.handleWebSocketUpgrade(request);
    }

    // ─── HTTP API routes ───
    return this.router.fetch(request);
  }

  // ─── Hibernation Handlers ───

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    let data: Record<string, unknown>;
    const rawMessage = decodeWebSocketMessage(message);
    if (!rawMessage) {
      ws.close(1009, 'Message too large');
      return;
    }

    try {
      const parsed = JSON.parse(rawMessage) as unknown;
      if (!isRecord(parsed)) throw new Error('Invalid JSON message shape');
      data = parsed;
    } catch {
      ws.close(1003, 'Invalid JSON message');
      return;
    }

    const att = ws.deserializeAttachment() as DeviceAttachment;

    // ─── Auth message handling ───
    if (data.type === 'auth') {
      if (att.authenticated) return; // Already authenticated, ignore

      try {
        const token = typeof data.token === 'string' ? data.token : undefined;
        if (!token) throw new Error('Missing token');

        const routeUserId = att.routeUserId;
        if (!routeUserId) throw new Error('Missing userId');

        let verifiedUserId: string;

        if (
          token === this.env.SERVICE_TOKEN &&
          isServiceTokenDeviceAuthEnabled(this.env.ALLOW_SERVICE_TOKEN_DEVICE_AUTH)
        ) {
          // Service token auth (for CLI debugging)
          verifiedUserId = routeUserId;
        } else {
          // JWT auth (normal desktop flow)
          const result = await verifyDesktopToken(this.env, token);
          verifiedUserId = result.userId;
          att.authExpiresAt = result.expiresAt;
        }

        // Verify userId matches the DO routing and any previously authenticated owner.
        if (verifiedUserId !== routeUserId) {
          throw new Error('userId mismatch');
        }

        const storedUserId = await this.ctx.storage.get<string>('_userId');
        if (storedUserId && verifiedUserId !== storedUserId) {
          throw new Error('userId mismatch');
        }
        await this.ctx.storage.put('_userId', verifiedUserId);

        // Mark as authenticated
        att.authenticated = true;
        att.authDeadline = undefined;
        ws.serializeAttachment(att);

        this.closeStaleDeviceSockets(ws, att.deviceId);

        ws.send(JSON.stringify({ type: 'auth_success' }));

        await this.scheduleNextConnectionCheck();
      } catch (err) {
        const reason = err instanceof Error ? err.message : 'Authentication failed';
        ws.send(JSON.stringify({ reason, type: 'auth_failed' }));
        ws.close(1008, reason);
      }
      return;
    }

    // ─── Reject unauthenticated messages ───
    if (!att.authenticated) return;

    // ─── Business messages (authenticated only) ───
    if (data.type === 'tool_call_response' || data.type === 'system_info_response') {
      const requestId = typeof data.requestId === 'string' ? data.requestId : undefined;
      if (!requestId) return;

      const pending = requestId ? this.pendingRequests.get(requestId) : undefined;
      if (pending) {
        if (pending.targetWs !== ws) return;

        clearTimeout(pending.timer);
        pending.resolve(normalizeDeviceRpcResult(data.result));
        this.pendingRequests.delete(requestId);
      }
    }

    if (data.type === 'heartbeat') {
      if (typeof data.allowRemoteTools === 'boolean') {
        att.allowRemoteTools = data.allowRemoteTools;
      }
      att.lastHeartbeat = Date.now();
      ws.serializeAttachment(att);
      ws.send(JSON.stringify({ type: 'heartbeat_ack' }));
    }
  }

  async webSocketClose(ws: WebSocket, _code: number) {
    this.rejectPendingRequestsForSocket(ws, new Error('DEVICE_DISCONNECTED'));
  }

  async webSocketError(ws: WebSocket, _error: unknown) {
    this.rejectPendingRequestsForSocket(ws, new Error('DEVICE_ERROR'));
    ws.close(1011, 'Internal error');
  }

  // ─── Heartbeat Timeout ───

  async alarm() {
    const now = Date.now();
    const closedSockets = new Set<WebSocket>();

    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() as DeviceAttachment;

      // Auth timeout: close unauthenticated connections past deadline
      if (!att.authenticated && att.authDeadline && now > att.authDeadline) {
        ws.send(JSON.stringify({ reason: 'Authentication timeout', type: 'auth_failed' }));
        ws.close(1008, 'Authentication timeout');
        closedSockets.add(ws);
        continue;
      }

      // Heartbeat timeout: only for authenticated connections
      if (att.authenticated && now - att.lastHeartbeat > HEARTBEAT_TIMEOUT) {
        this.rejectPendingRequestsForSocket(ws, new Error('HEARTBEAT_TIMEOUT'));
        ws.close(1000, 'Heartbeat timeout');
        closedSockets.add(ws);
        continue;
      }

      if (att.authenticated && att.authExpiresAt && now >= att.authExpiresAt) {
        this.rejectPendingRequestsForSocket(ws, new Error('AUTH_EXPIRED'));
        ws.send(JSON.stringify({ type: 'auth_expired' }));
        ws.close(1008, 'Authentication expired');
        closedSockets.add(ws);
      }
    }

    // Keep alarm running while there are active connections
    const remaining = this.ctx.getWebSockets().filter((ws) => !closedSockets.has(ws));
    if (remaining.length > 0) {
      await this.scheduleNextConnectionCheck(remaining);
    }
  }

  // ─── WebSocket Upgrade ───

  private async handleWebSocketUpgrade(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const routeUserId = request.headers.get('X-User-Id')?.trim();
    if (!routeUserId || routeUserId.length > MAX_IDENTIFIER_FIELD_LENGTH) {
      return new Response('Invalid userId', { status: 400 });
    }

    const deviceId = url.searchParams.get('deviceId')?.trim();
    if (!deviceId || deviceId.length > MAX_IDENTIFIER_FIELD_LENGTH) {
      return new Response('Invalid deviceId', { status: 400 });
    }

    const hostname = url.searchParams.get('hostname')?.trim() || '';
    const platform = url.searchParams.get('platform')?.trim() || '';
    const allowRemoteTools = url.searchParams.get('allowRemoteTools') === 'true';
    if (hostname.length > MAX_DEVICE_METADATA_FIELD_LENGTH) {
      return new Response('Invalid hostname', { status: 400 });
    }
    if (platform.length > MAX_DEVICE_METADATA_FIELD_LENGTH) {
      return new Response('Invalid platform', { status: 400 });
    }

    this.closeExcessUnauthenticatedSockets();
    if (this.ctx.getWebSockets().length >= MAX_CONNECTIONS_PER_USER) {
      return new Response('Too many device connections', { status: 429 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.ctx.acceptWebSocket(server);

    const now = Date.now();
    server.serializeAttachment({
      allowRemoteTools,
      authDeadline: now + AUTH_TIMEOUT,
      authenticated: false,
      connectedAt: now,
      deviceId,
      hostname,
      lastHeartbeat: now,
      platform,
      routeUserId,
    } satisfies DeviceAttachment);

    await this.scheduleNextConnectionCheck();

    return new Response(null, { status: 101, webSocket: client });
  }

  private async scheduleNextConnectionCheck(sockets = this.ctx.getWebSockets()) {
    const now = Date.now();
    const attachments = sockets.map((ws) => ws.deserializeAttachment() as DeviceAttachment);
    const nextAlarm = resolveNextDeviceAlarm(attachments, {
      heartbeatTimeout: HEARTBEAT_TIMEOUT,
      now,
    });

    if (nextAlarm) {
      await this.ctx.storage.setAlarm(nextAlarm);
    }
  }

  // ─── Helpers ───

  private getAuthenticatedSockets(): WebSocket[] {
    const now = Date.now();

    return this.ctx.getWebSockets().filter((ws) => {
      const att = ws.deserializeAttachment() as DeviceAttachment;
      return isActiveAuthenticatedDeviceAttachment(att, now);
    });
  }

  private closeStaleDeviceSockets(currentWs: WebSocket, deviceId: string) {
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === currentWs) continue;

      const att = ws.deserializeAttachment() as DeviceAttachment;
      if (shouldReplaceAuthenticatedDeviceSocket(att, deviceId)) {
        this.rejectPendingRequestsForSocket(ws, new Error('DEVICE_REPLACED'));
        ws.close(1000, 'Replaced by new connection');
      }
    }
  }

  private closeExcessUnauthenticatedSockets() {
    const unauthenticatedSockets = this.ctx
      .getWebSockets()
      .filter((ws) => {
        const att = ws.deserializeAttachment() as DeviceAttachment;
        return !att.authenticated;
      })
      .sort((a, b) => {
        const aAtt = a.deserializeAttachment() as DeviceAttachment;
        const bAtt = b.deserializeAttachment() as DeviceAttachment;
        return aAtt.connectedAt - bAtt.connectedAt;
      });

    const excessCount =
      unauthenticatedSockets.length - MAX_UNAUTHENTICATED_CONNECTIONS_PER_USER + 1;
    if (excessCount <= 0) return;

    for (const ws of unauthenticatedSockets.slice(0, excessCount)) {
      ws.close(1008, 'Too many unauthenticated connections');
    }
  }

  // ─── System Info RPC ───

  private async handleSystemInfo(request: Request): Promise<Response> {
    const sockets = this.getAuthenticatedSockets();
    if (sockets.length === 0) {
      return Response.json({ error: 'DEVICE_OFFLINE', success: false }, { status: 503 });
    }

    const parsedBody = await readJsonObjectBody(request);
    if (!parsedBody.success) {
      return Response.json({ error: parsedBody.error, success: false }, { status: 400 });
    }

    const deviceId = readOptionalStringField(parsedBody.data, 'deviceId');
    if (deviceId && deviceId.length > MAX_IDENTIFIER_FIELD_LENGTH) {
      return Response.json({ error: 'DEVICE_ID_TOO_LONG', success: false }, { status: 400 });
    }

    const timeout = resolveRpcTimeout(parsedBody.data.timeout, SYSTEM_INFO_TIMEOUT);
    const requestId = crypto.randomUUID();

    const target = resolveRemoteToolTarget(sockets, deviceId);
    if (target.type === 'not_found') {
      return Response.json({ error: 'DEVICE_NOT_FOUND', success: false }, { status: 503 });
    }
    if (target.type === 'remote_tools_disabled') {
      return Response.json({ error: 'REMOTE_TOOLS_DISABLED', success: false }, { status: 403 });
    }

    try {
      const result = await this.requestDevice(target.socket, requestId, timeout, {
        requestId,
        type: 'system_info_request',
      });

      if (!isRecord(result)) {
        return Response.json({ error: 'INVALID_DEVICE_RESPONSE', success: false }, { status: 502 });
      }

      return Response.json({ success: true, ...result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isTimeout = message === 'TIMEOUT';
      const isTooManyPending = message === 'TOO_MANY_PENDING_REQUESTS';

      return Response.json(
        {
          error: message,
          success: false,
        },
        { status: isTimeout ? 504 : isTooManyPending ? 429 : 502 },
      );
    }
  }

  // ─── Tool Call RPC ───

  private async handleToolCall(request: Request): Promise<Response> {
    const sockets = this.getAuthenticatedSockets();
    if (sockets.length === 0) {
      return Response.json(
        { content: '桌面设备不在线', error: 'DEVICE_OFFLINE', success: false },
        { status: 503 },
      );
    }

    const parsedBody = await readJsonObjectBody(request);
    if (!parsedBody.success) {
      return Response.json(
        { content: '', error: parsedBody.error, success: false },
        { status: 400 },
      );
    }

    const deviceId = readOptionalStringField(parsedBody.data, 'deviceId');
    if (deviceId && deviceId.length > MAX_IDENTIFIER_FIELD_LENGTH) {
      return Response.json(
        { content: '', error: 'DEVICE_ID_TOO_LONG', success: false },
        { status: 400 },
      );
    }

    const timeout = resolveRpcTimeout(parsedBody.data.timeout, TOOL_CALL_TIMEOUT);
    const toolCall = readToolCallField(parsedBody.data);
    if (!toolCall.success) {
      return Response.json({ content: '', error: toolCall.error, success: false }, { status: 400 });
    }
    const requestId = crypto.randomUUID();

    // Select target device (specified > first remote-tool-enabled device)
    const target = resolveRemoteToolTarget(sockets, deviceId);
    if (target.type === 'not_found') {
      return Response.json({ error: 'DEVICE_NOT_FOUND', success: false }, { status: 503 });
    }
    if (target.type === 'remote_tools_disabled') {
      return Response.json(
        {
          content: 'Remote desktop tool execution is disabled on this device',
          error: 'REMOTE_TOOLS_DISABLED',
          success: false,
        },
        { status: 403 },
      );
    }

    try {
      const result = await this.requestDevice(target.socket, requestId, timeout, {
        requestId,
        toolCall: toolCall.data,
        type: 'tool_call_request',
      });

      if (!isRecord(result)) {
        return Response.json(
          { content: '', error: 'INVALID_DEVICE_RESPONSE', success: false },
          { status: 502 },
        );
      }

      return Response.json({ success: true, ...result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isTimeout = message === 'TIMEOUT';
      const isTooManyPending = message === 'TOO_MANY_PENDING_REQUESTS';

      return Response.json(
        {
          content: isTimeout
            ? `工具调用超时（${timeout / 1000}s）`
            : isTooManyPending
              ? '设备调用繁忙，请稍后重试'
              : '工具调用发送失败',
          error: message,
          success: false,
        },
        { status: isTimeout ? 504 : isTooManyPending ? 429 : 502 },
      );
    }
  }

  private async requestDevice(
    targetWs: WebSocket,
    requestId: string,
    timeout: number,
    payload: Record<string, unknown>,
  ): Promise<unknown> {
    if (this.pendingRequests.size >= MAX_PENDING_REQUESTS) {
      throw new Error('TOO_MANY_PENDING_REQUESTS');
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('TIMEOUT'));
      }, timeout);

      this.pendingRequests.set(requestId, { reject, resolve, targetWs, timer });

      try {
        targetWs.send(JSON.stringify(payload));
      } catch (error) {
        clearTimeout(timer);
        this.pendingRequests.delete(requestId);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  private rejectPendingRequestsForSocket(targetWs: WebSocket, error: Error) {
    for (const [requestId, pending] of this.pendingRequests) {
      if (pending.targetWs !== targetWs) continue;

      clearTimeout(pending.timer);
      this.pendingRequests.delete(requestId);
      pending.reject(error);
    }
  }
}
