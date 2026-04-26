import { BRANDING_LOGO_URL } from '@lobechat/business-const';
import type { MetaData } from '@lobechat/types';

export const DEFAULT_AVATAR = '/avatars/agent-default.svg';
export const DEFAULT_AGENT_BUILDER_AVATAR = '/avatars/agent-builder.svg';
export const DEFAULT_USER_AVATAR = '😀';
export const DEFAULT_SUPERVISOR_AVATAR = '🎙️';
export const DEFAULT_SUPERVISOR_ID = 'supervisor';
export const DEFAULT_BACKGROUND_COLOR = undefined;
export const DEFAULT_AGENT_META: MetaData = {};
export const DEFAULT_DOC_COPILOT_AVATAR = '/avatars/doc-copilot.svg';
export const DEFAULT_GROUP_AGENT_BUILDER_AVATAR = '/avatars/group-agent-builder.svg';
export const DEFAULT_INBOX_AVATAR = '/avatars/inbox-default.svg';
export const DEFAULT_USER_AVATAR_URL = BRANDING_LOGO_URL || '/icons/icon-192x192-transparent.png';

const LEGACY_BUILTIN_AVATAR_MAP: Record<string, string> = {
  '/avatars/agent-builder.png': DEFAULT_AGENT_BUILDER_AVATAR,
  '/avatars/agent-builder.svg': DEFAULT_AGENT_BUILDER_AVATAR,
  '/avatars/agent-default.png': DEFAULT_AVATAR,
  '/avatars/agent-default.svg': DEFAULT_AVATAR,
  '/avatars/doc-copilot.png': DEFAULT_DOC_COPILOT_AVATAR,
  '/avatars/doc-copilot.svg': DEFAULT_DOC_COPILOT_AVATAR,
  '/avatars/group-agent-builder.svg': DEFAULT_GROUP_AGENT_BUILDER_AVATAR,
  '/avatars/inbox-default.svg': DEFAULT_INBOX_AVATAR,
  '/avatars/lobe-ai.png': DEFAULT_INBOX_AVATAR,
};

export const normalizeBuiltinAvatar = (avatar?: null | string) =>
  avatar ? LEGACY_BUILTIN_AVATAR_MAP[avatar] || avatar : undefined;
