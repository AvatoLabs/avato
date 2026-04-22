'use client';

import {
  type DeviceGatewayConnectionStatus,
  type DeviceGatewayStatus,
  useWatchBroadcast,
} from '@lobechat/electron-client-ipc';
import { type FormGroupItemType, type FormItemProps } from '@lobehub/ui';
import { Button, CopyButton, Flexbox, Form, Icon, Skeleton, Tag, Text, Tooltip } from '@lobehub/ui';
import { Switch } from 'antd';
import { CheckCircle2, Loader2Icon, RefreshCw, Unplug, XCircle } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { FORM_STYLE } from '@/const/layoutTokens';
import { desktopDeviceGatewayService } from '@/services/electron/deviceGateway';

const runningStatuses = new Set<DeviceGatewayConnectionStatus>([
  'authenticating',
  'connecting',
  'reconnecting',
]);

interface StatusDisplayProps {
  status?: DeviceGatewayStatus;
}

const StatusDisplay = memo<StatusDisplayProps>(({ status }) => {
  const { t } = useTranslation('setting');

  if (!status) {
    return (
      <Flexbox horizontal align="center" gap={8}>
        <Icon color="var(--ant-color-text-quaternary)" icon={XCircle} size={16} />
        <Text type="secondary">{t('deviceGateway.status.unknown')}</Text>
      </Flexbox>
    );
  }

  if (runningStatuses.has(status.connectionStatus)) {
    return (
      <Flexbox horizontal align="center" gap={8}>
        <Icon spin icon={Loader2Icon} size={16} style={{ opacity: 0.65 }} />
        <Text type="secondary">{t(`deviceGateway.status.${status.connectionStatus}`)}</Text>
      </Flexbox>
    );
  }

  if (status.connectionStatus === 'connected') {
    return (
      <Flexbox horizontal align="center" gap={8}>
        <Icon color="var(--ant-color-success)" icon={CheckCircle2} size={16} />
        <Text type="success">{t('deviceGateway.status.connected')}</Text>
        {status.lastConnectedAt && (
          <Tag color="success" style={{ marginInlineStart: 4 }}>
            {new Date(status.lastConnectedAt).toLocaleString()}
          </Tag>
        )}
      </Flexbox>
    );
  }

  return (
    <Flexbox horizontal align="center" gap={8}>
      <Icon color="var(--ant-color-text-quaternary)" icon={Unplug} size={16} />
      <Text type="secondary">{t('deviceGateway.status.disconnected')}</Text>
    </Flexbox>
  );
});

const InlineValue = memo<{ value?: string }>(({ value }) => {
  const { t } = useTranslation('setting');

  if (!value) {
    return <Text type="secondary">{t('deviceGateway.value.empty')}</Text>;
  }

  return (
    <Tooltip title={value}>
      <Flexbox horizontal align="center" gap={4} style={{ maxWidth: 360 }}>
        <Text ellipsis style={{ fontSize: 13 }} type="secondary">
          {value}
        </Text>
        <CopyButton content={value} size="small" />
      </Flexbox>
    </Tooltip>
  );
});

const DeviceGatewaySection = memo(() => {
  const { t } = useTranslation('setting');
  const [status, setStatus] = useState<DeviceGatewayStatus>();
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const refreshStatus = useCallback(async () => {
    try {
      const next = await desktopDeviceGatewayService.getAgentStatus();
      setStatus(next);
    } catch (error) {
      setStatus({
        allowRemoteTools: false,
        connectionStatus: 'disconnected',
        enabled: false,
        lastError: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useWatchBroadcast('deviceGatewayStatusChanged', (next) => {
    setStatus(next);
    setLoading(false);
  });

  const handleToggle = useCallback(async (enabled: boolean) => {
    setUpdating(true);
    try {
      const result = enabled
        ? await desktopDeviceGatewayService.startAgent()
        : await desktopDeviceGatewayService.stopAgent();
      setStatus(result.status);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus((current) => ({
        allowRemoteTools: current?.allowRemoteTools ?? false,
        connectionStatus: 'disconnected',
        deviceId: current?.deviceId,
        enabled: current?.enabled ?? false,
        gatewayUrl: current?.gatewayUrl,
        lastConnectedAt: current?.lastConnectedAt,
        lastError: message,
        userId: current?.userId,
      }));
    } finally {
      setUpdating(false);
    }
  }, []);

  const handleRemoteToolsToggle = useCallback(async (allowRemoteTools: boolean) => {
    setUpdating(true);
    try {
      const result = await desktopDeviceGatewayService.setAgentConfig({ allowRemoteTools });
      setStatus(result.status);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus((current) => ({
        allowRemoteTools: current?.allowRemoteTools ?? false,
        connectionStatus: current?.connectionStatus ?? 'disconnected',
        deviceId: current?.deviceId,
        enabled: current?.enabled ?? false,
        gatewayUrl: current?.gatewayUrl,
        lastConnectedAt: current?.lastConnectedAt,
        lastError: message,
        userId: current?.userId,
      }));
    } finally {
      setUpdating(false);
    }
  }, []);

  const formItems = useMemo<FormGroupItemType[]>(() => {
    const children: FormItemProps[] = [
      {
        children: (
          <Switch checked={status?.enabled ?? false} loading={updating} onChange={handleToggle} />
        ),
        desc: t('deviceGateway.enabled.desc'),
        label: t('deviceGateway.enabled.title'),
        minWidth: undefined,
      },
      {
        children: <StatusDisplay status={status} />,
        desc: t('deviceGateway.connection.desc'),
        label: t('deviceGateway.connection.title'),
        minWidth: undefined,
      },
      {
        children: (
          <Switch
            checked={status?.allowRemoteTools ?? false}
            disabled={!status?.enabled}
            loading={updating}
            onChange={handleRemoteToolsToggle}
          />
        ),
        desc: t('deviceGateway.allowRemoteTools.desc'),
        label: t('deviceGateway.allowRemoteTools.title'),
        minWidth: undefined,
      },
      {
        children: <InlineValue value={status?.deviceId} />,
        desc: t('deviceGateway.deviceId.desc'),
        label: t('deviceGateway.deviceId.title'),
        minWidth: undefined,
      },
      {
        children: <InlineValue value={status?.gatewayUrl} />,
        desc: t('deviceGateway.gatewayUrl.desc'),
        label: t('deviceGateway.gatewayUrl.title'),
        minWidth: undefined,
      },
    ];

    if (status?.lastError) {
      children.push({
        children: (
          <Tooltip title={status.lastError}>
            <Text ellipsis style={{ color: 'var(--ant-color-error)', maxWidth: 360 }}>
              {status.lastError}
            </Text>
          </Tooltip>
        ),
        desc: t('deviceGateway.lastError.desc'),
        label: t('deviceGateway.lastError.title'),
        minWidth: undefined,
      });
    }

    return [
      {
        children,
        desc: t('deviceGateway.desc'),
        title: t('deviceGateway.title'),
      },
    ];
  }, [handleRemoteToolsToggle, handleToggle, status, t, updating]);

  if (loading) {
    return <Skeleton active paragraph={{ rows: 5 }} title={false} />;
  }

  return (
    <Form
      collapsible={false}
      items={formItems}
      itemsType={'group'}
      variant={'filled'}
      footer={
        <Flexbox horizontal align="center" justify="flex-end" style={{ marginBlockStart: 8 }}>
          <Button icon={<Icon icon={RefreshCw} />} onClick={() => void refreshStatus()}>
            {t('deviceGateway.refresh')}
          </Button>
        </Flexbox>
      }
      {...FORM_STYLE}
    />
  );
});

export default DeviceGatewaySection;
