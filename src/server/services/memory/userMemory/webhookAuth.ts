import { isValidInternalServiceAuth } from '@/server/utils/internalServiceAuth';

export interface ValidateWebhookRequestAuthParams {
  expectedHeaders?: Record<string, string>;
  nodeEnv?: string;
  requestHeaders: Headers;
}

export interface WebhookAuthFailure {
  error: string;
  status: 403 | 503;
}

export const validateWebhookRequestAuth = ({
  expectedHeaders,
  nodeEnv = process.env.NODE_ENV,
  requestHeaders,
}: ValidateWebhookRequestAuthParams): WebhookAuthFailure | undefined => {
  if (isValidInternalServiceAuth(requestHeaders.get('authorization'))) {
    return undefined;
  }

  const hasConfiguredHeaders = !!expectedHeaders && Object.keys(expectedHeaders).length > 0;

  if (!hasConfiguredHeaders) {
    if (nodeEnv === 'production') {
      return {
        error: 'Webhook authentication headers must be configured in production.',
        status: 503,
      };
    }

    return undefined;
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
