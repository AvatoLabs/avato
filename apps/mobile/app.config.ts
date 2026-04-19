import type { ExpoConfig } from 'expo/config';

const appJson = require('./app.json');

const stripTrailingSlash = (value: string) => value.replace(/\/+$/, '');
const parseBoolean = (value: string | undefined, fallback = false) => {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
};

const baseConfig = appJson.expo as ExpoConfig;
const otaServerUrl = stripTrailingSlash(
  process.env.AVATO_OTA_SERVER_URL?.trim() || 'http://8.217.101.26:3212',
);
const releaseChannel = process.env.AVATO_RELEASE_CHANNEL?.trim() || 'stable';
const updatesEnabled = parseBoolean(process.env.AVATO_UPDATES_ENABLED, false);
const allowUnsignedManifests = parseBoolean(process.env.AVATO_ALLOW_UNSIGNED_MANIFESTS, false);

const config: ExpoConfig = {
  ...baseConfig,
  runtimeVersion: {
    policy: 'fingerprint',
  },
  updates: {
    checkAutomatically: 'ON_ERROR_RECOVERY',
    codeSigningCertificate: './code-signing/certificate.pem',
    codeSigningMetadata: {
      alg: 'rsa-v1_5-sha256',
      keyid: 'main',
    },
    enabled: updatesEnabled,
    fallbackToCacheTimeout: 0,
    requestHeaders: {
      'expo-channel-name': releaseChannel,
    },
    url: `${otaServerUrl}/api/manifest`,
  },
  extra: {
    ...baseConfig.extra,
    ota: {
      allowUnsignedManifests,
      releaseChannel,
      serverUrl: otaServerUrl,
      updatesEnabled,
    },
  },
};

export default config;
