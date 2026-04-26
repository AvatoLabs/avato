import { isValidInternalServiceAuth } from '@/server/utils/internalServiceAuth';

export interface ValidateWebhookRequestAuthParams {
  allowInsecureDev?: boolean;
  expectedHeaders?: Record<string, string>;
  nodeEnv?: string;
  requestHeaders: Headers;
}

export interface WebhookAuthFailure {
  error: string;
  status: 403 | 503;
}

export const validateWebhookRequestAuth = ({
  allowInsecureDev = false,
  expectedHeaders,
  nodeEnv = process.env.NODE_ENV,
  requestHeaders,
}: ValidateWebhookRequestAuthParams): WebhookAuthFailure | undefined => {
  if (isValidInternalServiceAuth(requestHeaders.get('authorization'))) {
    return undefined;
  }

  const hasConfiguredHeaders = !!expectedHeaders && Object.keys(expectedHeaders).length > 0;

  if (!hasConfiguredHeaders) {
    if (nodeEnv !== 'production' && allowInsecureDev) {
      return undefined;
    }

    return {
      error:
        nodeEnv === 'production'
          ? 'Webhook authentication must be configured in production.'
          : 'Webhook authentication must be configured, or MEMORY_USER_MEMORY_WEBHOOK_ALLOW_INSECURE_DEV=true must be set for local development.',
      status: 503,
    };
  }

  for (const [key, value] of Object.entries(expectedHeaders)) {
    const headerValue = requestHeaders.get(key);
    if (headerValue !== value) {
      return {
        error: `Unauthorized: Missing or invalid header '${key}'`,
        status: 403,
      };
    }
  }

  return undefined;
};
