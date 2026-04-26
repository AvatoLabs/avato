import { type StorageMode } from '@lobechat/electron-client-ipc';
import { StorageModeEnum } from '@lobechat/electron-client-ipc';
import { Button, Center, Flexbox, Input, stopPropagation } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { Server } from 'lucide-react';
import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ProductLogo } from '@/components/Branding';
import { useElectronStore } from '@/store/electron';
import { electronSyncSelectors } from '@/store/electron/selectors';
import {
  formatRemoteServerUrlForInput,
  normalizeRemoteServerUrl,
  validateRemoteServerUrl,
} from '@/utils/electron/remoteServerUrl';

import { Option } from './Option';

const styles = createStaticStyles(({ css, cssVar }) => {
  return {
    cardGroup: css`
      width: 400px; /* Increased width */
    `,
    container: css`
      overflow-y: auto;

      width: 100%;
      height: 100%;
      padding-block: 0 40px;
      padding-inline: 24px; /* Increased top padding */
    `,
    continueButton: css`
      width: 100%;
      margin-block-start: 40px;
    `,
    groupTitle: css`
      padding-inline-start: 4px; /* Align with card padding */
      font-size: 16px;
      font-weight: 500;
      color: ${cssVar.colorTextSecondary};
    `,
    header: css`
      text-align: center;
    `,
    inputError: css`
      margin-block-start: 8px;
      font-size: 12px;
      color: ${cssVar.colorError};
    `,
    modal: css`
      .ant-drawer-close {
        position: absolute;
        inset-block-start: 8px;
        inset-inline-end: 0;
      }
    `,
    selfHostedInput: css`
      margin-block-start: 12px;
    `,
    serverUrlInput: css`
      margin-block-start: 12px;
    `,
    selfHostedText: css`
      cursor: pointer;
      font-size: 14px;
      color: ${cssVar.colorTextTertiary};

      :hover {
        color: ${cssVar.colorTextSecondary};
      }
    `,
    title: css`
      margin-block: 16px 48px; /* Increased Spacing below title */
      font-size: 24px; /* Increased font size */
      font-weight: 600;
      color: ${cssVar.colorTextHeading};
    `,
  };
});

type RemoteStorageMode = Extract<StorageMode, 'cloud' | 'selfHost'>;

interface ConnectionModeProps {
  setWaiting: (waiting: boolean) => void;
}

const AvatoCloudIcon = memo(() => <ProductLogo size={24} />);

AvatoCloudIcon.displayName = 'AvatoCloudIcon';

const ConnectionMode = memo<ConnectionModeProps>(({ setWaiting }) => {
  const { t } = useTranslation(['electron', 'common']);
  const [urlError, setUrlError] = useState<string | undefined>();

  const connect = useElectronStore((s) => s.connectRemoteServer);
  const storageMode = useElectronStore(electronSyncSelectors.storageMode);
  const rawRemoteServerUrl = useElectronStore(electronSyncSelectors.rawRemoteServerUrl);

  const [selectedOption, setSelectedOption] = useState<RemoteStorageMode>(
    storageMode === StorageModeEnum.SelfHost ? StorageModeEnum.SelfHost : StorageModeEnum.Cloud,
  );
  const [serverUrl, setServerUrl] = useState(() =>
    formatRemoteServerUrlForInput(rawRemoteServerUrl),
  );

  const validateUrl = useCallback(
    (url: string, required = true) => {
      return validateRemoteServerUrl(url, {
        invalidMessage: t('remoteServer.invalidUrl'),
        required,
        requiredMessage: t('remoteServer.urlRequired'),
      });
    },
    [t],
  );

  const handleSelectOption = (option: RemoteStorageMode) => {
    setSelectedOption(option);
    setUrlError(validateUrl(serverUrl, option === StorageModeEnum.SelfHost));
  };

  const handleContinue = async () => {
    const normalizedServerUrl = normalizeRemoteServerUrl(serverUrl);
    const error = validateUrl(normalizedServerUrl, selectedOption === StorageModeEnum.SelfHost);
    setUrlError(error);

    if (error) {
      return;
    }

    // try to connect
    setWaiting(true);
    setServerUrl(formatRemoteServerUrlForInput(normalizedServerUrl));
    await connect({
      remoteServerUrl: normalizedServerUrl || undefined,
      storageMode: selectedOption,
    });
  };

  return (
    <Center className={styles.container}>
      <Flexbox align={'center'} gap={0}>
        <h1 className={styles.title}>{t('sync.mode.title')}</h1>
      </Flexbox>

      <Flexbox className={styles.cardGroup} gap={24}>
        <Flexbox gap={16}>
          <Flexbox horizontal align="center" justify="space-between">
            <div className={styles.groupTitle}>{t('sync.mode.cloudSync')}</div>
            <div
              className={styles.selfHostedText}
              onClick={() => handleSelectOption(StorageModeEnum.SelfHost)}
            >
              {t('sync.mode.useSelfHosted')}
            </div>
          </Flexbox>
          <Option
            description={t('sync.avatohubCloud.description')}
            icon={AvatoCloudIcon}
            isSelected={selectedOption === StorageModeEnum.Cloud}
            label={t('sync.avatohubCloud.title')}
            value={StorageModeEnum.Cloud}
            onClick={handleSelectOption}
          >
            {selectedOption === StorageModeEnum.Cloud && (
              <>
                <Input
                  className={styles.serverUrlInput}
                  placeholder={t('sync.avatohubCloud.serverUrl.placeholder')}
                  status={urlError ? 'error' : undefined}
                  value={serverUrl}
                  onClick={stopPropagation}
                  onChange={(e) => {
                    const newUrl = e.target.value;
                    setServerUrl(newUrl);
                    setUrlError(validateUrl(newUrl, false));
                  }}
                />
                {urlError && <div className={styles.inputError}>{urlError}</div>}
              </>
            )}
          </Option>
          {selectedOption === StorageModeEnum.SelfHost && (
            <Option
              description={t('sync.selfHosted.description')}
              icon={Server}
              isSelected={selectedOption === StorageModeEnum.SelfHost}
              label={t('sync.selfHosted.title')}
              value={StorageModeEnum.SelfHost}
              onClick={handleSelectOption}
            >
              {selectedOption === StorageModeEnum.SelfHost && (
                <>
                  <Input
                    autoFocus
                    className={styles.selfHostedInput}
                    placeholder="https://your-avato.com"
                    status={urlError ? 'error' : undefined}
                    value={serverUrl}
                    onClick={stopPropagation}
                    onChange={(e) => {
                      const newUrl = e.target.value;
                      setServerUrl(newUrl);
                      setUrlError(validateUrl(newUrl));
                    }}
                  />
                  {urlError && <div className={styles.inputError}>{urlError}</div>}
                </>
              )}
            </Option>
          )}
        </Flexbox>
      </Flexbox>

      <Button
        className={styles.continueButton}
        size="large"
        style={{ maxWidth: 400 }}
        type="primary"
        disabled={
          !selectedOption ||
          !!urlError ||
          (selectedOption === StorageModeEnum.SelfHost && !serverUrl.trim())
        }
        onClick={handleContinue}
      >
        {t('sync.continue')}
      </Button>
    </Center>
  );
});

export default ConnectionMode;
