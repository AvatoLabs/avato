const mobileAppConfig = require('../../app.json');

const expoConfig = mobileAppConfig?.expo ?? {};

export const APP_NAME = expoConfig.name ?? 'Avato';
export const APP_VERSION = expoConfig.version ?? '1.0.0';
