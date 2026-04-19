import * as Updates from 'expo-updates';

const isEnabled = () => !__DEV__ && Updates.isEnabled;

export const syncOtaUpdateOnLaunch = async () => {
  if (!isEnabled()) return false;

  try {
    const update = await Updates.checkForUpdateAsync();
    if (!update.isAvailable) return false;

    const fetched = await Updates.fetchUpdateAsync();
    if (!fetched.isNew && !fetched.isRollBackToEmbedded) return false;

    await Updates.reloadAsync();
    return true;
  } catch (error) {
    console.warn('[OTA] failed to sync update on launch:', error);
    return false;
  }
};
