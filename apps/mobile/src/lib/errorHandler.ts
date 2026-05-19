/**
 * errorHandler — Classifies errors into user-friendly categories.
 */

export type ErrorType = 'network' | 'auth' | 'server' | 'timeout' | 'provider_busy' | 'unknown';

interface ClassifiedError {
  /** i18n key suitable for toast display */
  messageKey:
    | 'errorNetwork'
    | 'errorAuth'
    | 'errorServer'
    | 'errorTimeout'
    | 'errorProviderOverloaded'
    | 'errorUnknown';
  type: ErrorType;
}

export function classifyError(err: unknown): ClassifiedError {
  const message = err instanceof Error ? err.message : String(err ?? '');

  if (/overloaded|engine_overloaded_error/i.test(message)) {
    return { type: 'provider_busy', messageKey: 'errorProviderOverloaded' };
  }

  if (
    /\b401\b|user not found|unauthorized|forbidden|invalid token|token expired|insert into "agents"[\s\S]*user_id|foreign key[\s\S]*user_id/i.test(
      message,
    )
  ) {
    return { type: 'auth', messageKey: 'errorAuth' };
  }

  if (err instanceof TypeError && /network request failed/i.test(err.message)) {
    return { type: 'network', messageKey: 'errorNetwork' };
  }

  if (err && typeof err === 'object') {
    const status = (err as any).status ?? (err as any).statusCode;
    if (status === 401 || status === 403) {
      return { type: 'auth', messageKey: 'errorAuth' };
    }
    if (typeof status === 'number' && status >= 500 && status < 600) {
      return { type: 'server', messageKey: 'errorServer' };
    }
    if ((err as any).code === 'TIMEOUT' || (err as any).name === 'AbortError') {
      return { type: 'timeout', messageKey: 'errorTimeout' };
    }
  }

  return { type: 'unknown', messageKey: 'errorUnknown' };
}
