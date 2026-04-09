import { sha256 } from 'js-sha256';

const SKILL_PACKAGE_STORAGE_PREFIX = 'skills/packages';
const SKILL_RESOURCE_STORAGE_PREFIX = 'skills/source-files';

export const buildSkillZipStorageKey = (zipHash: string) => {
  const opaqueName = sha256(`skill-zip:${zipHash}`);

  return `${SKILL_PACKAGE_STORAGE_PREFIX}/${opaqueName.slice(0, 2)}/${opaqueName}.zip`;
};

export const getSkillZipStorageDirname = () => SKILL_PACKAGE_STORAGE_PREFIX;

export const buildSkillResourceStorageKey = (zipHash: string, opaqueFileName: string) => {
  const opaqueDir = sha256(`skill-resource:${zipHash}`);

  return `${SKILL_RESOURCE_STORAGE_PREFIX}/${opaqueDir.slice(0, 16)}/${opaqueFileName}`;
};

export const getSkillResourceStoragePrefix = () => SKILL_RESOURCE_STORAGE_PREFIX;
