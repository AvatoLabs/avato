import { afterEach, describe, expect, it } from 'vitest';

import { validateWebhookRequestAuth } from './webhookAuth';

const originalKeyVaultsSecret = process.env.KEY_VAULTS_SECRET;

afterEach(() => {
  if (originalKeyVaultsSecret === undefined) {
    delete process.env.KEY_VAULTS_SECRET;
  } else {
    process.env.KEY_VAULTS_SECRET = originalKeyVaultsSecret;
  }
});

describe('validateWebhookRequestAuth', () => {
  it('allows requests without configured headers outside production', () => {
    const result = validateWebhookRequestAuth({
      expectedHeaders: undefined,
      nodeEnv: 'development',
      requestHeaders: new Headers(),
    });

    expect(result).toBeUndefined();
  });

  it('rejects requests when production webhook auth is not configured', () => {
    const result = validateWebhookRequestAuth({
      expectedHeaders: undefined,
      nodeEnv: 'production',
      requestHeaders: new Headers(),
    });

    expect(result).toEqual({
      error: 'Webhook authentication headers must be configured in production.',
      status: 503,
    });
  });

  it('allows requests with valid internal service auth in production', () => {
    process.env.KEY_VAULTS_SECRET = 'internal-secret';

    const result = validateWebhookRequestAuth({
      expectedHeaders: undefined,
      nodeEnv: 'production',
      requestHeaders: new Headers({ Authorization: 'Bearer internal-secret' }),
    });

    expect(result).toBeUndefined();
  });

  it('rejects requests with missing configured headers', () => {
    const result = validateWebhookRequestAuth({
      expectedHeaders: { 'x-memory-secret': 'secret' },
      nodeEnv: 'production',
      requestHeaders: new Headers(),
    });

    expect(result).toEqual({
      error: "Unauthorized: Missing or invalid header 'x-memory-secret'",
      status: 403,
    });
  });

  it('accepts requests with matching configured headers', () => {
    const result = validateWebhookRequestAuth({
      expectedHeaders: { 'x-memory-secret': 'secret' },
      nodeEnv: 'production',
      requestHeaders: new Headers({ 'x-memory-secret': 'secret' }),
    });

    expect(result).toBeUndefined();
  });
});
