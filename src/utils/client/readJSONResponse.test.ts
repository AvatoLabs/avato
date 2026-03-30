import { describe, expect, it } from 'vitest';

import { getResponseErrorMessage, readJSONResponse } from './readJSONResponse';

describe('readJSONResponse', () => {
  it('should parse JSON responses', async () => {
    const response = new Response(JSON.stringify({ exists: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });

    const result = await readJSONResponse<{ exists: boolean }>(response);

    expect(result.data).toEqual({ exists: true });
    expect(result.responseText).toBe('{"exists":true}');
  });

  it('should return raw text when response is not valid JSON', async () => {
    const response = new Response('Internal Server Error', { status: 500 });

    const result = await readJSONResponse<{ exists: boolean }>(response);

    expect(result.data).toBeUndefined();
    expect(result.responseText).toBe('Internal Server Error');
  });
});

describe('getResponseErrorMessage', () => {
  it('should prefer message from JSON payload', () => {
    expect(
      getResponseErrorMessage(
        JSON.stringify({
          error: 'fallback',
          message: 'Detailed error',
        }),
        'Unknown error',
      ),
    ).toBe('Detailed error');
  });

  it('should fall back to raw text for non JSON payloads', () => {
    expect(getResponseErrorMessage('Internal Server Error', 'Unknown error')).toBe(
      'Internal Server Error',
    );
  });
});
