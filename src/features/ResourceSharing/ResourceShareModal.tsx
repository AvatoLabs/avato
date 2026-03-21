'use client';

import { Button, copyToClipboard, Flexbox, Input, Select, Text } from '@lobehub/ui';
import { App } from 'antd';
import { memo, useState } from 'react';
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
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'editor' | 'viewer'>('viewer');
  const [username, setUsername] = useState('');

  const { data: permissions, mutate: mutatePermissions } = useSWR(
    ['resource-share-permissions', kind, id],
    () => lambdaClient.resourceShare.listResourcePermissions.query({ id, kind }),
    { revalidateOnFocus: false },
  );

  const { data: links, mutate: mutateLinks } = useSWR(
    ['resource-share-links', kind, id],
    () => lambdaClient.resourceShare.listResourceShareLinks.query({ id, kind }),
    { revalidateOnFocus: false },
  );

  const { data: access, mutate: mutateAccess } = useSWR(
    ['resource-share-explain', kind, id],
    () => lambdaClient.resourceShare.explainAccess.query({ id, kind }),
    { revalidateOnFocus: false },
  );

  const refresh = async () => {
    await Promise.all([mutatePermissions(), mutateLinks(), mutateAccess()]);
  };

  const handleGrant = async () => {
    if (!username.trim()) return;

    await lambdaClient.resourceShare.grantResourcePermission.mutate({
      id,
      kind,
      role,
      username: username.trim(),
    });

    setUsername('');
    await refresh();
    message.success(t('share.members.added'));
  };

  const handleCreateLink = async () => {
    const link = await lambdaClient.resourceShare.createResourceShareLink.mutate({
      expiresInDays,
      id,
      kind,
      password: password.trim() || undefined,
    });

    setLatestShareUrl(link.shareUrl);
    setPassword('');
    await refresh();
  };

  const handleCopyLink = async () => {
    if (!latestShareUrl) return;
    await copyToClipboard(latestShareUrl);
    message.success(t('share.links.copied'));
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
                    await lambdaClient.resourceShare.revokeResourcePermission.mutate({
                      permissionId: permission.id,
                    });
                    await refresh();
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

        {latestShareUrl && (
          <Flexbox
            gap={8}
            padding={12}
            style={{ border: '1px solid var(--ant-color-border-secondary)', borderRadius: 8 }}
          >
            <Text strong>{t('share.links.latest')}</Text>
            <Text style={{ wordBreak: 'break-all' }}>{latestShareUrl}</Text>
            <Button onClick={handleCopyLink}>{t('share.links.copy')}</Button>
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
                    await lambdaClient.resourceShare.disableResourceShareLink.mutate({
                      shareLinkId: link.id,
                    });
                    await refresh();
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
