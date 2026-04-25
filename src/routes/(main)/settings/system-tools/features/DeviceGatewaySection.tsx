'use client';

import {
  type DeviceGatewayConnectionStatus,
  type DeviceGatewayStatus,
  useWatchBroadcast,
} from '@lobechat/electron-client-ipc';
import { type FormGroupItemType, type FormItemProps } from '@lobehub/ui';
import {
  Button,
  CopyButton,
  Flexbox,
  Form,
  Icon,
  Input,
  Skeleton,
  Tag,
  Text,
  Tooltip,
} from '@lobehub/ui';
import { Switch } from 'antd';
import {
  CheckCircle2,
  Loader2Icon,
  RefreshCw,
  RotateCcw,
  Save,
  Unplug,
  XCircle,
} from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { FORM_STYLE } from '@/const/layoutTokens';
import { desktopDeviceGatewayService } from '@/services/electron/deviceGateway';

const runningStatuses = new Set<DeviceGatewayConnectionStatus>([
  'authenticating',
  'connecting',
  'reconnecting',
]);

const normalizeGatewayUrlInput = (value?: string) => value?.trim().replace(/\/+$/, '') || '';
const normalizeGatewayProxyUrlInput = (value?: string) => {
  const trimmed = value?.trim() || '';
  if (!trimmed) return '';

  const normalized = trimmed.includes('://') ? trimmed : `http://${trimmed}`;
  return normalized.replace(/\/+$/, '');
};

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
  const [gatewayProxyUrlInput, setGatewayProxyUrlInput] = useState('');
  const [gatewayUrlInput, setGatewayUrlInput] = useState('');

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

  useEffect(() => {
    setGatewayUrlInput(status?.gatewayUrl ?? '');
  }, [status?.gatewayUrl]);

  useEffect(() => {
    setGatewayProxyUrlInput(status?.gatewayProxyUrl ?? '');
  }, [status?.gatewayProxyUrl]);

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
        gatewayProxyUrl: current?.gatewayProxyUrl,
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
        gatewayProxyUrl: current?.gatewayProxyUrl,
        gatewayUrl: current?.gatewayUrl,
        lastConnectedAt: current?.lastConnectedAt,
        lastError: message,
        userId: current?.userId,
      }));
    } finally {
      setUpdating(false);
    }
  }, []);

  const gatewayUrlDirty = useMemo(
    () =>
      normalizeGatewayUrlInput(gatewayUrlInput) !== normalizeGatewayUrlInput(status?.gatewayUrl),
    [gatewayUrlInput, status?.gatewayUrl],
  );

  const gatewayProxyUrlDirty = useMemo(
    () =>
      normalizeGatewayProxyUrlInput(gatewayProxyUrlInput) !==
      normalizeGatewayProxyUrlInput(status?.gatewayProxyUrl),
    [gatewayProxyUrlInput, status?.gatewayProxyUrl],
  );

  const applyGatewayUrlConfig = useCallback(async (gatewayUrl: string) => {
    setUpdating(true);
    try {
      const result = await desktopDeviceGatewayService.setAgentConfig({
        gatewayUrl: normalizeGatewayUrlInput(gatewayUrl),
      });
      setStatus(result.status);
      setGatewayUrlInput(result.status.gatewayUrl ?? '');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus((current) => ({
        allowRemoteTools: current?.allowRemoteTools ?? false,
        connectionStatus: current?.connectionStatus ?? 'disconnected',
        deviceId: current?.deviceId,
        enabled: current?.enabled ?? false,
        gatewayProxyUrl: current?.gatewayProxyUrl,
        gatewayUrl: current?.gatewayUrl,
        lastConnectedAt: current?.lastConnectedAt,
        lastError: message,
        userId: current?.userId,
      }));
    } finally {
      setUpdating(false);
    }
  }, []);

  const handleGatewayUrlSave = useCallback(async () => {
    await applyGatewayUrlConfig(gatewayUrlInput);
  }, [applyGatewayUrlConfig, gatewayUrlInput]);

  const handleGatewayUrlReset = useCallback(async () => {
    await applyGatewayUrlConfig('');
  }, [applyGatewayUrlConfig]);

  const applyGatewayProxyUrlConfig = useCallback(async (gatewayProxyUrl: string) => {
    setUpdating(true);
    try {
      const result = await desktopDeviceGatewayService.setAgentConfig({
        gatewayProxyUrl: normalizeGatewayProxyUrlInput(gatewayProxyUrl),
      });
      setStatus(result.status);
      setGatewayProxyUrlInput(result.status.gatewayProxyUrl ?? '');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus((current) => ({
        allowRemoteTools: current?.allowRemoteTools ?? false,
        connectionStatus: current?.connectionStatus ?? 'disconnected',
        deviceId: current?.deviceId,
        enabled: current?.enabled ?? false,
        gatewayProxyUrl: current?.gatewayProxyUrl,
        gatewayUrl: current?.gatewayUrl,
        lastConnectedAt: current?.lastConnectedAt,
        lastError: message,
        userId: current?.userId,
      }));
    } finally {
      setUpdating(false);
    }
  }, []);

  const handleGatewayProxyUrlSave = useCallback(async () => {
    await applyGatewayProxyUrlConfig(gatewayProxyUrlInput);
  }, [applyGatewayProxyUrlConfig, gatewayProxyUrlInput]);

  const handleGatewayProxyUrlReset = useCallback(async () => {
    await applyGatewayProxyUrlConfig('');
  }, [applyGatewayProxyUrlConfig]);

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
        children: (
          <Flexbox gap={8} style={{ maxWidth: 520, width: '100%' }}>
            <Flexbox horizontal align="center" gap={6}>
              <Input
                aria-label={t('deviceGateway.gatewayUrl.title')}
                disabled={updating}
                placeholder={t('deviceGateway.gatewayUrl.placeholder')}
                style={{ flex: 1, minWidth: 0 }}
                value={gatewayUrlInput}
                variant={'filled'}
                onChange={(event) => setGatewayUrlInput(event.target.value)}
                onPressEnter={() => void handleGatewayUrlSave()}
              />
              {status?.gatewayUrl && <CopyButton content={status.gatewayUrl} size="small" />}
            </Flexbox>
            <Flexbox horizontal align="center" gap={8} justify="flex-end">
              <Button
                disabled={!gatewayUrlDirty || updating}
                icon={<Icon icon={Save} />}
                loading={updating && gatewayUrlDirty}
                size="small"
                onClick={() => void handleGatewayUrlSave()}
              >
                {t('deviceGateway.gatewayUrl.save')}
              </Button>
              <Button
                disabled={updating || !status?.gatewayUrl}
                icon={<Icon icon={RotateCcw} />}
                size="small"
                onClick={() => void handleGatewayUrlReset()}
              >
                {t('deviceGateway.gatewayUrl.reset')}
              </Button>
            </Flexbox>
          </Flexbox>
        ),
        desc: t('deviceGateway.gatewayUrl.desc'),
        label: t('deviceGateway.gatewayUrl.title'),
        minWidth: undefined,
      },
      {
        children: (
          <Flexbox gap={8} style={{ maxWidth: 520, width: '100%' }}>
            <Flexbox horizontal align="center" gap={6}>
              <Input
                aria-label={t('deviceGateway.gatewayProxyUrl.title')}
                disabled={updating}
                placeholder={t('deviceGateway.gatewayProxyUrl.placeholder')}
                style={{ flex: 1, minWidth: 0 }}
                value={gatewayProxyUrlInput}
                variant={'filled'}
                onChange={(event) => setGatewayProxyUrlInput(event.target.value)}
                onPressEnter={() => void handleGatewayProxyUrlSave()}
              />
              {status?.gatewayProxyUrl && (
                <CopyButton content={status.gatewayProxyUrl} size="small" />
              )}
            </Flexbox>
            <Flexbox horizontal align="center" gap={8} justify="flex-end">
              <Button
                disabled={!gatewayProxyUrlDirty || updating}
                icon={<Icon icon={Save} />}
                loading={updating && gatewayProxyUrlDirty}
                size="small"
                onClick={() => void handleGatewayProxyUrlSave()}
              >
                {t('deviceGateway.gatewayProxyUrl.save')}
              </Button>
              <Button
                disabled={updating || !status?.gatewayProxyUrl}
                icon={<Icon icon={RotateCcw} />}
                size="small"
                onClick={() => void handleGatewayProxyUrlReset()}
              >
                {t('deviceGateway.gatewayProxyUrl.reset')}
              </Button>
            </Flexbox>
          </Flexbox>
        ),
        desc: t('deviceGateway.gatewayProxyUrl.desc'),
        label: t('deviceGateway.gatewayProxyUrl.title'),
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
  }, [
    gatewayProxyUrlDirty,
    gatewayProxyUrlInput,
    gatewayUrlDirty,
    gatewayUrlInput,
    handleGatewayProxyUrlReset,
    handleGatewayProxyUrlSave,
    handleGatewayUrlReset,
    handleGatewayUrlSave,
    handleRemoteToolsToggle,
    handleToggle,
    status,
    t,
    updating,
  ]);

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
