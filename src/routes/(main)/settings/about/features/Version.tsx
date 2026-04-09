import { BRANDING_NAME } from '@lobechat/business-const';
import {
  getElectronIpc,
  type UpdaterState,
  useWatchBroadcast,
} from '@lobechat/electron-client-ipc';
import { Block, Button, Flexbox, Tag } from '@lobehub/ui';
import { App } from 'antd';
import { createStaticStyles } from 'antd-style';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ProductLogo } from '@/components/Branding';
import { CHANGELOG_URL, GITHUB, MANUAL_UPGRADE_URL } from '@/const/url';
import { CURRENT_VERSION } from '@/const/version';
import { useNewVersion } from '@/features/User/UserPanel/useNewVersion';
import { autoUpdateService } from '@/services/electron/autoUpdate';
import { useGlobalStore } from '@/store/global';

const styles = createStaticStyles(({ css, cssVar }) => ({
  logo: css`
    border-radius: calc(${cssVar.borderRadiusLG} * 2);
  `,
}));

const Version = memo<{ mobile?: boolean }>(({ mobile }) => {
  const hasNewVersion = useNewVersion();
  const { message } = App.useApp();
  const [latestVersion, serverVersion, useCheckServerVersion] = useGlobalStore((s) => [
    s.latestVersion,
    s.serverVersion,
    s.useCheckServerVersion,
  ]);
  const { t } = useTranslation(['common', 'setting', 'electron']);

  useCheckServerVersion();

  const showServerVersion = serverVersion && serverVersion !== CURRENT_VERSION;
  const isDesktop = useMemo(() => !!getElectronIpc(), []);

  const [updaterState, setUpdaterState] = useState<UpdaterState>({ stage: 'idle' });
  const [buildChannel, setBuildChannel] = useState<string | null>(null);

  const handleUpdateActionError = useCallback(
    (action: string, error: unknown) => {
      console.error(`Failed to ${action}:`, error);
      message.error(t('updater.updateError', { ns: 'electron' }));
    },
    [message, t],
  );

  useEffect(() => {
    if (!isDesktop) return;
    void autoUpdateService.getUpdaterState().then(setUpdaterState).catch((error) => {
      console.error('Failed to fetch updater state:', error);
    });
  }, [isDesktop]);

  useEffect(() => {
    if (!isDesktop) return;
    void autoUpdateService.getBuildChannel().then(setBuildChannel).catch((error) => {
      console.error('Failed to fetch build channel:', error);
    });
  }, [isDesktop]);

  useWatchBroadcast('updaterStateChanged', (state: UpdaterState) => {
    setUpdaterState(state);
  });

  const renderUpdateButton = () => {
    if (!isDesktop) {
      if (hasNewVersion) {
        return (
          <Button
            block={mobile}
            href={MANUAL_UPGRADE_URL}
            style={{ flex: 1 }}
            target={'_blank'}
            type={'primary'}
          >
            {t('upgradeVersion.action')}
          </Button>
        );
      }
      return null;
    }

    const { stage, progress } = updaterState;

    switch (stage) {
      case 'checking': {
        return (
          <Button loading block={mobile}>
            {t('checkForUpdates')}
          </Button>
        );
      }
      case 'downloading': {
        const percent = progress ? Math.round(progress.percent) : 0;
        return (
          <Button loading block={mobile}>
            {t('downloadingUpdate', { percent })}
          </Button>
        );
      }
      case 'downloaded': {
        return (
          <Button
            block={mobile}
            type="primary"
            onClick={() => {
              void autoUpdateService.installNow().catch((error) => {
                handleUpdateActionError('install update', error);
              });
            }}
          >
            {t('restartToUpdate')}
          </Button>
        );
      }
      case 'latest': {
        return (
          <Button disabled block={mobile}>
            {t('alreadyUpToDate')}
          </Button>
        );
      }
      default: {
        return (
          <Button
            block={mobile}
            onClick={() => {
              void autoUpdateService.checkUpdate().catch((error) => {
                handleUpdateActionError('check for updates', error);
              });
            }}
          >
            {t('checkForUpdates')}
          </Button>
        );
      }
    }
  };

  return (
    <Flexbox
      align={mobile ? 'stretch' : 'center'}
      gap={16}
      horizontal={!mobile}
      justify={'space-between'}
      width={'100%'}
    >
      <Flexbox horizontal align={'center'} flex={'none'} gap={16}>
        <a href={GITHUB} rel="noreferrer" target="_blank">
          <Block
            clickable
            align={'center'}
            className={styles.logo}
            height={64}
            justify={'center'}
            width={64}
          >
            <ProductLogo size={52} />
          </Block>
        </a>
        <Flexbox align={'flex-start'} gap={6}>
          <div style={{ fontSize: 18, fontWeight: 'bolder' }}>{BRANDING_NAME}</div>
          <Flexbox gap={6} horizontal={!mobile}>
            <Tag>v{CURRENT_VERSION}</Tag>

            {buildChannel && buildChannel !== 'stable' && (
              <Tag color={'gold'}>
                {t(`setting:tab.beta.updateChannel.${buildChannel}`, {
                  defaultValue: buildChannel.charAt(0).toUpperCase() + buildChannel.slice(1),
                })}
              </Tag>
            )}
            {showServerVersion && (
              <Tag>{t('upgradeVersion.serverVersion', { version: `v${serverVersion}` })}</Tag>
            )}
            {hasNewVersion && (
              <Tag color={'info'}>
                {t('upgradeVersion.newVersion', { version: `v${latestVersion}` })}
              </Tag>
            )}
          </Flexbox>
        </Flexbox>
      </Flexbox>
      <Flexbox horizontal flex={mobile ? 1 : undefined} gap={8}>
        <Button block={mobile} href={CHANGELOG_URL} style={{ flex: 1 }} target={'_blank'}>
          {t('changelog')}
        </Button>
        {renderUpdateButton()}
      </Flexbox>
    </Flexbox>
  );
});

export default Version;
