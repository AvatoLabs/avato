import { safeParseJSON } from '@lobechat/utils';

export interface SafeJSONResponse<T> {
  data?: T;
  responseText: string;
}

export const getResponseErrorMessage = (responseText: string, fallback: string): string => {
  if (!responseText) return fallback;

  const parsed = safeParseJSON<{ error?: string; message?: string }>(responseText);

  if (parsed?.message) return parsed.message;
  if (parsed?.error) return parsed.error;

  return responseText;
};

export const readJSONResponse = async <T>(response: Response): Promise<SafeJSONResponse<T>> => {
  const responseText = await response.text();

  return {
    data: safeParseJSON<T>(responseText),
    responseText,
  };
};
