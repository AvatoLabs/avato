const MIN_RPC_TIMEOUT = 1000;
export const MAX_IDENTIFIER_FIELD_LENGTH = 512;
export const MAX_DEVICE_METADATA_FIELD_LENGTH = 256;
export const MAX_JSON_BODY_LENGTH = 2_500_000;
export const MAX_TOOL_ARGUMENTS_LENGTH = 2_000_000;
export const MAX_RPC_TIMEOUT = 600_000;

interface JsonBodySuccess<T> {
  data: T;
  success: true;
}

interface JsonBodyFailure {
  error: string;
  success: false;
}

export type JsonBodyResult<T> = JsonBodyFailure | JsonBodySuccess<T>;

export interface ToolCallPayload {
  apiName: string;
  arguments: string;
  identifier: string;
}

export const isRecord = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === 'object' && !Array.isArray(value);
};

export async function readJsonObjectBody<T extends Record<string, unknown>>(
  request: Request,
): Promise<JsonBodyResult<T>> {
  try {
    const contentLength = Number(request.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > MAX_JSON_BODY_LENGTH) {
      return { error: 'JSON_BODY_TOO_LARGE', success: false };
    }

    const text = await request.text();
    if (text.length > MAX_JSON_BODY_LENGTH) {
      return { error: 'JSON_BODY_TOO_LARGE', success: false };
    }

    const data = JSON.parse(text) as unknown;

    if (!isRecord(data)) {
      return { error: 'INVALID_JSON_BODY', success: false };
    }

    return { data: data as T, success: true };
  } catch {
    return { error: 'INVALID_JSON_BODY', success: false };
  }
}

export function readOptionalStringField(
  body: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = body[key];
  if (typeof value !== 'string') return undefined;

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

export function readRequiredStringField(
  body: Record<string, unknown>,
  key: string,
): JsonBodyResult<string> {
  const value = readOptionalStringField(body, key);
  if (value && value.length > MAX_IDENTIFIER_FIELD_LENGTH) {
    return { error: `${key.toUpperCase()}_TOO_LONG`, success: false };
  }

  return value
    ? { data: value, success: true }
    : { error: `MISSING_${key.toUpperCase()}`, success: false };
}

export function readToolCallField(
  body: Record<string, unknown>,
  key = 'toolCall',
): JsonBodyResult<ToolCallPayload> {
  const value = body[key];
  if (!isRecord(value)) {
    return { error: 'INVALID_TOOL_CALL', success: false };
  }

  const apiName = value.apiName;
  const args = value.arguments;
  const identifier = value.identifier;
  const normalizedApiName = typeof apiName === 'string' ? apiName.trim() : '';
  const normalizedIdentifier = typeof identifier === 'string' ? identifier.trim() : '';

  if (
    normalizedApiName.length === 0 ||
    typeof args !== 'string' ||
    normalizedIdentifier.length === 0
  ) {
    return { error: 'INVALID_TOOL_CALL', success: false };
  }

  if (
    normalizedApiName.length > MAX_IDENTIFIER_FIELD_LENGTH ||
    normalizedIdentifier.length > MAX_IDENTIFIER_FIELD_LENGTH
  ) {
    return { error: 'TOOL_CALL_FIELD_TOO_LONG', success: false };
  }

  if (args.length > MAX_TOOL_ARGUMENTS_LENGTH) {
    return { error: 'TOOL_ARGUMENTS_TOO_LARGE', success: false };
  }

  return {
    data: {
      apiName: normalizedApiName,
      arguments: args,
      identifier: normalizedIdentifier,
    },
    success: true,
  };
}

export function resolveRpcTimeout(value: unknown, defaultTimeout: number): number {
  const rawTimeout = typeof value === 'number' ? value : defaultTimeout;

  if (!Number.isFinite(rawTimeout)) return defaultTimeout;

  const timeout = Math.trunc(rawTimeout);
  return Math.min(Math.max(timeout, MIN_RPC_TIMEOUT), MAX_RPC_TIMEOUT);
}
