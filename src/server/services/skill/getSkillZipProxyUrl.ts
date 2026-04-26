import { appEnv } from '@/envs/app';

const buildSkillZipProxyPath = (id: string) => `/skills/${encodeURIComponent(id)}/zip`;

export const getSkillZipProxyUrl = (id: string, options?: { internal?: boolean }) => {
  const baseUrl = options?.internal ? appEnv.INTERNAL_APP_URL || appEnv.APP_URL : appEnv.APP_URL;

  return new URL(buildSkillZipProxyPath(id), baseUrl).toString();
};
