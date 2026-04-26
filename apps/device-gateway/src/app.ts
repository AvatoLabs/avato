import type { Context, Next } from 'hono';
import { Hono } from 'hono';

import {
  MAX_DEVICE_METADATA_FIELD_LENGTH,
  MAX_IDENTIFIER_FIELD_LENGTH,
  readJsonObjectBody,
  readRequiredStringField,
} from './request';
import type { Env } from './types';

const app = new Hono<{ Bindings: Env }>();

// ─── Health check ───
app.get('/health', (c) => c.text('OK'));

// ─── Auth middleware for service APIs ───
const serviceAuth = (): ((
  c: Context<{ Bindings: Env }>,
  next: Next,
) => Promise<Response | void>) => {
  return async (c, next) => {
    const serviceToken = c.env.SERVICE_TOKEN?.trim();
    if (!serviceToken) {
      return c.json({ error: 'SERVICE_TOKEN_NOT_CONFIGURED', success: false }, 503);
    }

    const authHeader = c.req.header('Authorization');
    if (authHeader !== `Bearer ${serviceToken}`) {
      return c.text('Unauthorized', 401);
    }
    await next();
  };
};

// ─── Desktop WebSocket connection ───
app.get('/ws', async (c) => {
  const userId = c.req.query('userId')?.trim();
  if (!userId) return c.text('Missing userId', 400);
  if (userId.length > MAX_IDENTIFIER_FIELD_LENGTH) return c.text('Invalid userId', 400);

  const deviceId = c.req.query('deviceId')?.trim();
  if (!deviceId) return c.text('Missing deviceId', 400);
  if (deviceId.length > MAX_IDENTIFIER_FIELD_LENGTH) return c.text('Invalid deviceId', 400);

  const hostname = c.req.query('hostname')?.trim();
  if (hostname && hostname.length > MAX_DEVICE_METADATA_FIELD_LENGTH) {
    return c.text('Invalid hostname', 400);
  }

  const platform = c.req.query('platform')?.trim();
  if (platform && platform.length > MAX_DEVICE_METADATA_FIELD_LENGTH) {
    return c.text('Invalid platform', 400);
  }

  const id = c.env.DEVICE_GATEWAY.idFromName(`user:${userId}`);
  const stub = c.env.DEVICE_GATEWAY.get(id);

  const headers = new Headers(c.req.raw.headers);
  headers.set('X-User-Id', userId);
  return stub.fetch(new Request(c.req.raw, { headers }));
});

// ─── Vercel Agent HTTP API ───
app.all('/api/device/*', serviceAuth(), async (c) => {
  const parsedBody = await readJsonObjectBody(c.req.raw.clone());
  if (!parsedBody.success) {
    return c.json({ error: parsedBody.error, success: false }, 400);
  }

  const userId = readRequiredStringField(parsedBody.data, 'userId');
  if (!userId.success) return c.json({ error: userId.error, success: false }, 400);

  const id = c.env.DEVICE_GATEWAY.idFromName(`user:${userId.data}`);
  const stub = c.env.DEVICE_GATEWAY.get(id);
  return stub.fetch(c.req.raw);
});

export default app;
