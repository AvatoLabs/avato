import bcrypt from 'bcryptjs';

import { appEnv } from '@/envs/app';

export const CONTENT_SHARE_EXPIRY_OPTIONS = [1, 7, 30] as const;

interface ContentShareLinkRecord {
  passwordHash?: string | null;
}

interface ContentShareLinkResolver<TLink extends ContentShareLinkRecord> {
  resolveShareLinkByToken: (token: string) => Promise<TLink | null | undefined>;
}

export type ContentShareAccessResult<TLink extends ContentShareLinkRecord> =
  | { link: TLink; status: 'ok' }
  | { status: 'missing_password' | 'not_found' };

export const resolveContentShareExpiresAt = (expiresInDays: number) => {
  return new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
};

export const normalizeContentSharePassword = (password?: string | null) => {
  const normalized = password?.trim();
  return normalized || undefined;
};

export const buildContentShareUrls = (params: {
  kind: 'document' | 'file' | 'source_set';
  token: string;
}) => {
  const shareUrl = `${appEnv.APP_URL}/share/r/${params.token}`;

  return {
    fileShareDownloadUrl:
      params.kind === 'file' ? `${appEnv.APP_URL}/share/f/${params.token}` : undefined,
    shareUrl,
  };
};

export const resolveContentShareAccess = async <TLink extends ContentShareLinkRecord>({
  contentModel,
  password,
  token,
}: {
  contentModel: ContentShareLinkResolver<TLink>;
  password?: string | null;
  token: string;
}): Promise<ContentShareAccessResult<TLink>> => {
  const trimmedToken = token.trim();
  if (!trimmedToken) return { status: 'not_found' };

  const link = await contentModel.resolveShareLinkByToken(trimmedToken);
  if (!link) return { status: 'not_found' };

  if (!link.passwordHash) return { link, status: 'ok' };

  const normalizedPassword = normalizeContentSharePassword(password);
  if (!normalizedPassword) return { status: 'missing_password' };

  const isValid = await bcrypt.compare(normalizedPassword, link.passwordHash);
  if (!isValid) return { status: 'not_found' };

  return { link, status: 'ok' };
};
