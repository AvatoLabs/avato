import * as dotenv from 'dotenv';
import dotenvExpand from 'dotenv-expand';

export const loadEnv = () => {
  dotenvExpand.expand(dotenv.config());

  const env = process.env.NODE_ENV || 'development';
  const explicitEnvFile = process.env.LOBE_ENV_FILE;

  if (explicitEnvFile) {
    dotenvExpand.expand(dotenv.config({ override: true, path: explicitEnvFile }));
  }

  dotenvExpand.expand(dotenv.config({ override: true, path: `.env.${env}` }));
  dotenvExpand.expand(dotenv.config({ override: true, path: `.env.${env}.local` }));
};
