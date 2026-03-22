'use client';

import { Button, Checkbox, copyToClipboard, Flexbox, Input, Select, Text } from '@lobehub/ui';
import { App } from 'antd';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';

import { lambdaClient } from '@/libs/trpc/client';
import { type ResourceKind } from '@/types/resource';

interface ResourceShareModalProps {
  id: string;
  kind: ResourceKind;
  name: string;
}

const getPermissionRoleKey = (role: 'editor' | 'owner' | 'viewer') => {
  switch (role) {
    case 'editor': {
      return 'share.roles.editor' as const;
    }
    case 'owner': {
      return 'space.roles.owner' as const;
    }
    case 'viewer':
    default: {
      return 'share.roles.viewer' as const;
    }
  }
};

const ResourceShareModal = memo<ResourceShareModalProps>(({ id, kind, name }) => {
  const { t } = useTranslation('file');
  const { message } = App.useApp();
  const [expiresInDays, setExpiresInDays] = useState<1 | 7 | 30>(7);
  const [latestShareUrl, setLatestShareUrl] = useState<string | null>(null);
  const [latestFileDownloadUrl, setLatestFileDownloadUrl] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'editor' | 'viewer'>('viewer');
  const [username, setUsername] = useState('');
  const [canReshare, setCanReshare] = useState(false);

  // Single combined query — resolves resource once, runs all 3 in parallel server-side
  const { data, mutate } = useSWR(
    ['resource-share-info', kind, id],
    () => lambdaClient.resourceShare.getResourceShareInfo.query({ id, kind }),
    { revalidateOnFocus: false },
  );

  const permissions = data?.permissions;
  const links = data?.links;
  const access = data?.access;

  const caps = useMemo(() => {
    const set = new Set(access?.capabilities ?? []);
    return {
      canShareLink: set.has('share_link'),
      canShareMember: set.has('share_member'),
    };
  }, [access?.capabilities]);

  const refresh = async () => {
    await mutate();
  };

  const handleGrant = async () => {
    if (!username.trim()) return;

    try {
      await lambdaClient.resourceShare.grantResourcePermission.mutate({
        canReshare,
        id,
        kind,
        role,
        username: username.trim(),
      });

      setUsername('');
      setCanReshare(false);
      await refresh();
      message.success(t('share.members.added'));
    } catch (error: any) {
      const code = error?.data?.code;
      if (code === 'NOT_FOUND') {
        message.error(t('share.error.userNotFound'));
      } else if (code === 'FORBIDDEN') {
        message.error(t('share.error.forbidden'));
      } else {
        message.error(t('share.error.generic'));
      }
    }
  };

  const handleCreateLink = async () => {
    try {
      const link = await lambdaClient.resourceShare.createResourceShareLink.mutate({
        expiresInDays,
        id,
        kind,
        password: password.trim() || undefined,
      });

      setLatestShareUrl(link.shareUrl);
      setLatestFileDownloadUrl(link.fileShareDownloadUrl ?? null);
      setPassword('');
      await refresh();
    } catch (error: any) {
      const code = error?.data?.code;
      if (code === 'FORBIDDEN') {
        message.error(t('share.error.forbidden'));
      } else {
        message.error(t('share.error.generic'));
      }
    }
  };

  const handleCopyLink = async () => {
    if (!latestShareUrl) return;
    await copyToClipboard(latestShareUrl);
    message.success(t('share.links.copied'));
  };

  const handleCopyDirectDownload = async () => {
    if (!latestFileDownloadUrl) return;
    await copyToClipboard(latestFileDownloadUrl);
    message.success(t('share.links.directDownloadCopied'));
  };

  return (
    <Flexbox gap={16} paddingInline={8} style={{ paddingBottom: 8 }}>
      <Flexbox gap={4}>
        <Text as={'h3'}>{name}</Text>
        <Text type={'secondary'}>
          {access?.matchedBy
            ? t('share.accessSummary', {
                authzEpoch: access.authzEpoch,
                reason: access.reason || access.matchedBy,
              })
            : t('share.accessUnknown')}
        </Text>
      </Flexbox>

      <Flexbox gap={8}>
        <Text strong>{t('share.members.title')}</Text>
        {caps.canShareMember && (
          <Flexbox gap={8}>
            <Flexbox horizontal gap={8} wrap={'wrap'}>
              <Input
                placeholder={t('share.members.usernamePlaceholder')}
                style={{ flex: 1, minWidth: 220 }}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
              <Select
                style={{ minWidth: 140 }}
                value={role}
                options={[
                  { label: t('share.roles.viewer'), value: 'viewer' },
                  { label: t('share.roles.editor'), value: 'editor' },
                ]}
                onChange={(value) => setRole(value as 'editor' | 'viewer')}
              />
              <Button type={'primary'} onClick={handleGrant}>
                {t('share.members.add')}
              </Button>
            </Flexbox>
            <Checkbox
              checked={canReshare}
              onChange={(checked) => setCanReshare(checked as boolean)}
            >
              {t('share.members.canReshare')}
            </Checkbox>
          </Flexbox>
        )}
        <Flexbox gap={8}>
          {permissions?.length ? (
            permissions.map((permission) => (
              <Flexbox
                horizontal
                align={'center'}
                gap={12}
                justify={'space-between'}
                key={permission.id}
                padding={12}
                style={{ border: '1px solid var(--ant-color-border-secondary)', borderRadius: 8 }}
              >
                <Flexbox flex={1} gap={2}>
                  <Text strong>
                    {permission.subjectUsername || permission.subjectName || permission.subjectId}
                  </Text>
                  <Text fontSize={12} type={'secondary'}>
                    {t(getPermissionRoleKey(permission.role))}
                  </Text>
                </Flexbox>
                <Button
                  danger
                  onClick={async () => {
                    try {
                      await lambdaClient.resourceShare.revokeResourcePermission.mutate({
                        permissionId: permission.id,
                      });
                      await refresh();
                    } catch (error: any) {
                      const code = error?.data?.code;
                      if (code === 'FORBIDDEN') {
                        message.error(t('share.error.forbidden'));
                      } else {
                        message.error(t('share.error.generic'));
                      }
                    }
                  }}
                >
                  {t('share.members.revoke')}
                </Button>
              </Flexbox>
            ))
          ) : (
            <Text type={'secondary'}>{t('share.members.empty')}</Text>
          )}
        </Flexbox>
      </Flexbox>

      <Flexbox gap={8}>
        <Text strong>{t('share.links.title')}</Text>
        {caps.canShareLink && (
          <Flexbox horizontal gap={8} wrap={'wrap'}>
            <Select
              style={{ minWidth: 160 }}
              value={expiresInDays}
              options={[
                { label: t('share.links.expiry.1'), value: 1 },
                { label: t('share.links.expiry.7'), value: 7 },
                { label: t('share.links.expiry.30'), value: 30 },
              ]}
              onChange={(value) => setExpiresInDays(value as 1 | 7 | 30)}
            />
            <Input
              placeholder={t('share.links.passwordPlaceholder')}
              style={{ flex: 1, minWidth: 220 }}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <Button type={'primary'} onClick={handleCreateLink}>
              {t('share.links.create')}
            </Button>
          </Flexbox>
        )}

        {latestShareUrl && (
          <Flexbox
            gap={8}
            padding={12}
            style={{ border: '1px solid var(--ant-color-border-secondary)', borderRadius: 8 }}
          >
            <Text strong>{t('share.links.latest')}</Text>
            <Text style={{ wordBreak: 'break-all' }}>{latestShareUrl}</Text>
            <Button onClick={handleCopyLink}>{t('share.links.copy')}</Button>
            {latestFileDownloadUrl && (
              <Flexbox gap={6}>
                <Text fontSize={12} type={'secondary'}>
                  {t('share.links.directDownloadHint')}
                </Text>
                <Text style={{ wordBreak: 'break-all' }}>{latestFileDownloadUrl}</Text>
                <Button onClick={handleCopyDirectDownload}>
                  {t('share.links.copyDirectDownload')}
                </Button>
              </Flexbox>
            )}
          </Flexbox>
        )}

        <Text fontSize={12} type={'secondary'}>
          {t('share.links.note')}
        </Text>

        <Flexbox gap={8}>
          {links?.length ? (
            links.map((link) => (
              <Flexbox
                horizontal
                align={'center'}
                gap={12}
                justify={'space-between'}
                key={link.id}
                padding={12}
                style={{ border: '1px solid var(--ant-color-border-secondary)', borderRadius: 8 }}
              >
                <Flexbox flex={1} gap={2}>
                  <Text strong>{link.id}</Text>
                  <Text fontSize={12} type={'secondary'}>
                    {t('share.links.expiresAt', { date: link.expiresAt.toLocaleString() })}
                  </Text>
                </Flexbox>
                <Button
                  danger
                  disabled={!!link.disabledAt}
                  onClick={async () => {
                    try {
                      await lambdaClient.resourceShare.disableResourceShareLink.mutate({
                        shareLinkId: link.id,
                      });
                      await refresh();
                    } catch (error: any) {
                      const code = error?.data?.code;
                      if (code === 'FORBIDDEN') {
                        message.error(t('share.error.forbidden'));
                      } else {
                        message.error(t('share.error.generic'));
                      }
                    }
                  }}
                >
                  {link.disabledAt ? t('share.links.disabled') : t('share.links.disable')}
                </Button>
              </Flexbox>
            ))
          ) : (
            <Text type={'secondary'}>{t('share.links.empty')}</Text>
          )}
        </Flexbox>
      </Flexbox>
    </Flexbox>
  );
});

ResourceShareModal.displayName = 'ResourceShareModal';

export default ResourceShareModal;
