import urlJoin from 'url-join';

const isDev = process.env.NODE_ENV === 'development';

export const OFFICIAL_URL = process.env.NEXT_PUBLIC_OFFICIAL_URL || 'https://avato.turingmesh.com';
export const OFFICIAL_SITE = process.env.NEXT_PUBLIC_OFFICIAL_SITE || OFFICIAL_URL;
export const OFFICIAL_DOMAIN = new URL(OFFICIAL_SITE).hostname;

export const OG_URL = '/og/og.webp?v=1';

export const GITHUB = 'https://github.com/AvatoLabs/avatohub';
export const GITHUB_ISSUES = urlJoin(GITHUB, 'issues/new/choose');
export const CHANGELOG = urlJoin(GITHUB, 'releases');

export const DOCUMENTS = urlJoin(OFFICIAL_SITE, '/docs');
export const USAGE_DOCUMENTS = urlJoin(DOCUMENTS, '/usage');
export const SELF_HOSTING_DOCUMENTS = urlJoin(DOCUMENTS, '/self-hosting');
export const DATABASE_SELF_HOSTING_URL = urlJoin(SELF_HOSTING_DOCUMENTS, '/server-database');

// use this for the link
export const DOCUMENTS_REFER_URL = `${DOCUMENTS}?utm_source=chat_preview`;

export const WIKI_PLUGIN_GUIDE = urlJoin(USAGE_DOCUMENTS, '/plugins/development');
export const MANUAL_UPGRADE_URL = urlJoin(SELF_HOSTING_DOCUMENTS, '/advanced/upstream-sync');

export const BLOG = urlJoin(OFFICIAL_SITE, 'blog');

export const ABOUT = OFFICIAL_SITE;
export const FEEDBACK = GITHUB_ISSUES;
export const PRIVACY_URL = GITHUB;
export const TERMS_URL = GITHUB;

export const PLUGINS_INDEX_URL =
  process.env.NEXT_PUBLIC_PLUGINS_INDEX_URL || urlJoin(OFFICIAL_SITE, '/plugins');

export const MORE_MODEL_PROVIDER_REQUEST_URL = GITHUB_ISSUES;

export const MORE_FILE_PREVIEW_REQUEST_URL = GITHUB_ISSUES;

export const AGENTS_INDEX_GITHUB =
  process.env.NEXT_PUBLIC_AGENTS_INDEX_GITHUB || urlJoin(GITHUB, 'tree/main');
export const AGENTS_INDEX_GITHUB_ISSUE = urlJoin(AGENTS_INDEX_GITHUB, 'issues/new');
export const AGENTS_OFFICIAL_URL = urlJoin(OFFICIAL_SITE, '/agent');

export const SESSION_CHAT_URL = (agentId: string, mobile?: boolean) => {
  if (mobile) return `/agent/${agentId}`;
  return `/agent/${agentId}`;
};

export const AGENT_PROFILE_URL = (agentId: string) => `/agent/${agentId}/profile`;

export const GROUP_CHAT_URL = (groupId: string) => `/group/${groupId}`;

export const imageUrl = (filename: string) => `/images/${filename}`;

export const LOBE_URL_IMPORT_NAME = 'settings';

export const RELEASES_URL = urlJoin(GITHUB, 'releases');

export const mailTo = (email: string) => `mailto:${email}`;

export const AES_GCM_URL = 'https://datatracker.ietf.org/doc/html/draft-ietf-avt-srtp-aes-gcm-01';
export const BASE_PROVIDER_DOC_URL = urlJoin(USAGE_DOCUMENTS, '/providers');
export const SITEMAP_BASE_URL = isDev ? '/sitemap.xml/' : 'sitemap';
export const CHANGELOG_URL = urlJoin(GITHUB, 'releases');

export const DOWNLOAD_URL = {
  android: urlJoin(OFFICIAL_SITE, '/downloads/android'),
  default: urlJoin(OFFICIAL_SITE, '/downloads'),
  ios: urlJoin(OFFICIAL_SITE, '/downloads/ios'),
} as const;
