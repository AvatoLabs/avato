import { describe, expect, it } from 'vitest';

import {
  isRecord,
  MAX_IDENTIFIER_FIELD_LENGTH,
  MAX_JSON_BODY_LENGTH,
  MAX_RPC_TIMEOUT,
  MAX_TOOL_ARGUMENTS_LENGTH,
  readJsonObjectBody,
  readRequiredStringField,
  readToolCallField,
  resolveRpcTimeout,
} from './request';

describe('device gateway request helpers', () => {
  describe('isRecord', () => {
    it('accepts plain JSON objects and rejects arrays/null/primitives', () => {
      expect(isRecord({ success: true })).toBe(true);
      expect(isRecord([])).toBe(false);
      expect(isRecord(null)).toBe(false);
      expect(isRecord('ok')).toBe(false);
    });
  });

  describe('readJsonObjectBody', () => {
    it('parses JSON object bodies', async () => {
      const result = await readJsonObjectBody(
        new Request('https://gateway.test/api/device/status', {
          body: JSON.stringify({ userId: 'user-1' }),
          method: 'POST',
        }),
      );

      expect(result).toEqual({
        data: { userId: 'user-1' },
        success: true,
      });
    });

    it('rejects malformed JSON bodies', async () => {
      const result = await readJsonObjectBody(
        new Request('https://gateway.test/api/device/status', {
          body: '{',
          method: 'POST',
        }),
      );

      expect(result).toEqual({ error: 'INVALID_JSON_BODY', success: false });
    });

    it('rejects non-object JSON bodies', async () => {
      const result = await readJsonObjectBody(
        new Request('https://gateway.test/api/device/status', {
          body: JSON.stringify(['user-1']),
          method: 'POST',
        }),
      );

      expect(result).toEqual({ error: 'INVALID_JSON_BODY', success: false });
    });

    it('rejects oversized JSON bodies before parsing', async () => {
      const result = await readJsonObjectBody(
        new Request('https://gateway.test/api/device/status', {
          body: 'x'.repeat(MAX_JSON_BODY_LENGTH + 1),
          method: 'POST',
        }),
      );

      expect(result).toEqual({ error: 'JSON_BODY_TOO_LARGE', success: false });
    });
  });

  describe('readRequiredStringField', () => {
    it('reads present string fields', () => {
      expect(readRequiredStringField({ userId: ' user-1 ' }, 'userId')).toEqual({
        data: 'user-1',
        success: true,
      });
    });

    it('rejects missing string fields', () => {
      expect(readRequiredStringField({ userId: '' }, 'userId')).toEqual({
        error: 'MISSING_USERID',
        success: false,
      });
      expect(readRequiredStringField({ userId: '   ' }, 'userId')).toEqual({
        error: 'MISSING_USERID',
        success: false,
      });
    });

    it('rejects oversized string fields', () => {
      expect(
        readRequiredStringField({ userId: 'u'.repeat(MAX_IDENTIFIER_FIELD_LENGTH + 1) }, 'userId'),
      ).toEqual({
        error: 'USERID_TOO_LONG',
        success: false,
      });
    });
  });

  describe('readToolCallField', () => {
    it('reads valid tool call payloads', () => {
      expect(
        readToolCallField({
          toolCall: {
            apiName: ' runCommand ',
            arguments: '',
            identifier: ' lobe-local-system ',
          },
        }),
      ).toEqual({
        data: {
          apiName: 'runCommand',
          arguments: '',
          identifier: 'lobe-local-system',
        },
        success: true,
      });
    });

    it('rejects missing or malformed tool calls', () => {
      expect(readToolCallField({})).toEqual({
        error: 'INVALID_TOOL_CALL',
        success: false,
      });
      expect(
        readToolCallField({
          toolCall: {
            apiName: 'runCommand',
            identifier: 'lobe-local-system',
          },
        }),
      ).toEqual({
        error: 'INVALID_TOOL_CALL',
        success: false,
      });
      expect(
        readToolCallField({
          toolCall: {
            apiName: '',
            arguments: '{}',
            identifier: 'lobe-local-system',
          },
        }),
      ).toEqual({
        error: 'INVALID_TOOL_CALL',
        success: false,
      });
    });

    it('rejects oversized tool call fields and arguments', () => {
      expect(
        readToolCallField({
          toolCall: {
            apiName: 'a'.repeat(MAX_IDENTIFIER_FIELD_LENGTH + 1),
            arguments: '{}',
            identifier: 'lobe-local-system',
          },
        }),
      ).toEqual({
        error: 'TOOL_CALL_FIELD_TOO_LONG',
        success: false,
      });

      expect(
        readToolCallField({
          toolCall: {
            apiName: 'runCommand',
            arguments: 'x'.repeat(MAX_TOOL_ARGUMENTS_LENGTH + 1),
            identifier: 'lobe-local-system',
          },
        }),
      ).toEqual({
        error: 'TOOL_ARGUMENTS_TOO_LARGE',
        success: false,
      });
    });
  });

  describe('resolveRpcTimeout', () => {
    it('uses the default timeout when input is missing or invalid', () => {
      expect(resolveRpcTimeout(undefined, 30_000)).toBe(30_000);
      expect(resolveRpcTimeout(Number.NaN, 30_000)).toBe(30_000);
    });

    it('clamps timeout into the supported RPC window', () => {
      expect(resolveRpcTimeout(20, 30_000)).toBe(1000);
      expect(resolveRpcTimeout(MAX_RPC_TIMEOUT + 1, 30_000)).toBe(MAX_RPC_TIMEOUT);
    });
  });
});
