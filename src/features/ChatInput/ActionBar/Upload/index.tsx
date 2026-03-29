import { featureFlagsSelectors, useServerConfigStore } from '@/store/serverConfig';

import ServerMode from './ServerMode';

const Upload = () => {
  const { enableSourceSet } = useServerConfigStore(featureFlagsSelectors);
  return enableSourceSet && <ServerMode />;
};

export default Upload;
