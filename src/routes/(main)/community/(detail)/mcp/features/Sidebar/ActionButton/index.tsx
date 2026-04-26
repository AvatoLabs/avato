'use client';

import { Button, Flexbox, Icon } from '@lobehub/ui';
import { App } from 'antd';
import { createStaticStyles } from 'antd-style';
import { Trash2Icon } from 'lucide-react';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import MCPInstallProgress from '@/features/MCP/MCPInstallProgress';
import { useDetailContext } from '@/features/MCPPluginDetail/DetailProvider';
import { useMarketAuth } from '@/layout/AuthProvider/MarketAuth';
import { pluginSelectors } from '@/store/tool/slices/plugin/selectors';
import { useToolStore } from '@/store/tool/store';

const styles = createStaticStyles(({ css }) => ({
  button: css`
    button {
      width: 100%;
    }
  `,
}));

const ActionButton = memo(() => {
  const { t } = useTranslation(['discover', 'plugin']);
  const { message } = App.useApp();
  const detailContext = useDetailContext();
  const { identifier, haveCloudEndpoint } = detailContext;
  const [isLoading, setIsLoading] = useState(false);
  const { isAuthenticated, isLoading: isAuthLoading, signIn } = useMarketAuth();

  const [installed, installMCPPlugin, uninstallMCPPlugin] = useToolStore((s) => [
    pluginSelectors.isPluginInstalled(identifier!)(s),
    s.installMCPPlugin,
    s.uninstallMCPPlugin,
  ]);

  // Check if this is a cloud MCP plugin
  const isCloudMcp = haveCloudEndpoint;

  const installPlugin = async () => {
    if (!identifier) return;

    // If this is a cloud MCP and user is not authenticated, request authorization first
    if (isCloudMcp && !isAuthenticated) {
      try {
        await signIn();
      } catch (error) {
        console.error('MCP install sign-in failed:', error);
        message.error(t('store.actions.installFailed', { ns: 'plugin' }));
        return;
      }
    }

    // Proceed with installation
    setIsLoading(true);
    try {
      await installMCPPlugin(identifier);
    } catch (error) {
      console.error('Failed to install MCP plugin:', error);
      message.error(t('store.actions.installFailed', { ns: 'plugin' }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleUninstall = async () => {
    setIsLoading(true);
    try {
      await uninstallMCPPlugin(identifier!);
    } catch (error) {
      console.error('Failed to uninstall MCP plugin:', error);
      message.error(t('store.actions.uninstallFailed', { ns: 'plugin' }));
    } finally {
      setIsLoading(false);
    }
  };

  const buttonLoading = isLoading || isAuthLoading;

  return installed ? (
    <Flexbox horizontal gap={8}>
      <Button
        block
        className={styles.button}
        disabled={buttonLoading}
        size={'large'}
        type={'default'}
      >
        {t('plugins.installed')}
      </Button>

      <Button
        icon={<Icon icon={Trash2Icon} size={20} />}
        loading={buttonLoading}
        size={'large'}
        style={{ minWidth: 45 }}
        styles={{
          icon: { height: 20 },
        }}
        onClick={handleUninstall}
      />
    </Flexbox>
  ) : (
    <>
      <Button
        block
        className={styles.button}
        loading={buttonLoading}
        size={'large'}
        type={'primary'}
        onClick={installPlugin}
      >
        {t('plugins.install')}
      </Button>
      <MCPInstallProgress identifier={identifier!} />
    </>
  );
});

export default ActionButton;
