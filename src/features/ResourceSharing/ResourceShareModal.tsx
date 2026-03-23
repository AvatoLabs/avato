'use client';

import { Button, copyToClipboard, Flexbox, Input, Select, Tag, Text } from '@lobehub/ui';
import { TRPCClientError } from '@trpc/client';
import { Alert, App, Switch } from 'antd';
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
  if (role === 'editor') {
    return 'share.roles.editor' as const;
  }

  if (role === 'owner') {
    return 'space.roles.owner' as const;
  }

  return 'share.roles.viewer' as const;
};

const getTRPCError = (error: unknown) => {
  if (error instanceof TRPCClientError) return error;
  return null;
};

const isForbiddenError = (error: TRPCClientError<any> | null) => error?.data?.code === 'FORBIDDEN';

const ResourceShareModal = memo<ResourceShareModalProps>(({ id, kind, name }) => {
  const { t } = useTranslation('file');
  const { message } = App.useApp();
  const [expiresInDays, setExpiresInDays] = useState<1 | 7 | 30>(7);
  const [latestShareUrl, setLatestShareUrl] = useState<string | null>(null);
  const [latestFileDownloadUrl, setLatestFileDownloadUrl] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'editor' | 'owner' | 'viewer'>('viewer');
  const [username, setUsername] = useState('');
  const [permissionExpiresAt, setPermissionExpiresAt] = useState('');
  const [canReshare, setCanReshare] = useState(false);
  const [inheritsToChildren, setInheritsToChildren] = useState(true);
  const [granting, setGranting] = useState(false);
  const [creatingLink, setCreatingLink] = useState(false);
  const [revokingPermissionId, setRevokingPermissionId] = useState<string | null>(null);
  const [disablingLinkId, setDisablingLinkId] = useState<string | null>(null);

  const {
    data: permissions,
    error: permissionsError,
    isLoading: permissionsLoading,
    mutate: mutatePermissions,
  } = useSWR(
    ['resource-share-permissions', kind, id],
    () => lambdaClient.resourceShare.listResourcePermissions.query({ id, kind }),
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    },
  );

  const {
    data: links,
    error: linksError,
    isLoading: linksLoading,
    mutate: mutateLinks,
  } = useSWR(
    ['resource-share-links', kind, id],
    () => lambdaClient.resourceShare.listResourceShareLinks.query({ id, kind }),
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    },
  );

  const {
    data: access,
    isLoading: accessLoading,
    mutate: mutateAccess,
  } = useSWR(
    ['resource-share-explain', kind, id],
    () => lambdaClient.resourceShare.explainAccess.query({ id, kind }),
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    },
  );

  const permissionTRPCError = getTRPCError(permissionsError);
  const linkTRPCError = getTRPCError(linksError);
  const membersUnavailable = isForbiddenError(permissionTRPCError);
  const linksUnavailable = isForbiddenError(linkTRPCError);
  const membersLoadError = !!permissionsError && !membersUnavailable;
  const linksLoadError = !!linksError && !linksUnavailable;
  const noManageSections = membersUnavailable && linksUnavailable;

  const refresh = async () => {
    await Promise.allSettled([mutatePermissions(), mutateLinks(), mutateAccess()]);
  };

  const getErrorMessage = (error: unknown) => {
    const trpcError = getTRPCError(error);
    if (!trpcError) return t('share.manage.actionFailed');

    switch (trpcError.message) {
      case 'RESOURCE_ACCESS_DENIED':
      case 'SPACE_ACCESS_DENIED': {
        return t('share.manage.noAccess');
      }
      case 'RESOURCE_RESHARE_DENIED': {
        return t('share.manage.delegateDenied');
      }
      case 'USER_NOT_FOUND': {
        return t('space.members.userNotFound');
      }
      default: {
        return t('share.manage.actionFailed');
      }
    }
  };

  const handleGrant = async () => {
    if (!username.trim()) return;

    const resolvedExpiresAt = permissionExpiresAt ? new Date(permissionExpiresAt) : undefined;
    if (resolvedExpiresAt && Number.isNaN(resolvedExpiresAt.getTime())) {
      message.error(t('share.members.invalidExpiry'));
      return;
    }

    setGranting(true);

    try {
      await lambdaClient.resourceShare.grantResourcePermission.mutate({
        canReshare: role === 'editor' && canReshare,
        expiresAt: resolvedExpiresAt,
        id,
        inheritsToChildren,
        kind,
        role,
        username: username.trim(),
      });

      setUsername('');
      await refresh();
      message.success(t('share.members.added'));
    } catch (error) {
      message.error(getErrorMessage(error));
    } finally {
      setGranting(false);
    }
  };

  const handleCreateLink = async () => {
    setCreatingLink(true);

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
      message.success(t('share.links.created'));
    } catch (error) {
      message.error(getErrorMessage(error));
    } finally {
      setCreatingLink(false);
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

  const retryMembers = () => {
    void mutatePermissions().catch(() => undefined);
  };

  const retryLinks = () => {
    void mutateLinks().catch(() => undefined);
  };

  return (
    <Flexbox gap={16} paddingInline={8} style={{ paddingBottom: 8 }}>
      <Flexbox gap={4}>
        <Text as={'h3'}>{name}</Text>
        <Text type={'secondary'}>
          {accessLoading
            ? t('share.loading')
            : access?.matchedBy
              ? t('share.accessSummary', {
                  authzEpoch: access.authzEpoch,
                  reason: access.reason || access.matchedBy,
                })
              : t('share.accessUnknown')}
        </Text>
      </Flexbox>

      {noManageSections && <Alert showIcon message={t('share.manage.unavailable')} type={'info'} />}

      <Flexbox gap={8}>
        <Text strong>{t('share.members.title')}</Text>

        {membersUnavailable ? (
          <Alert showIcon message={t('share.members.unavailable')} type={'info'} />
        ) : membersLoadError ? (
          <Flexbox gap={8}>
            <Text type={'secondary'}>{t('share.members.loadError')}</Text>
            <Button onClick={retryMembers}>{t('share.manage.retry')}</Button>
          </Flexbox>
        ) : (
          <>
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
                  { label: t('space.roles.owner'), value: 'owner' },
                ]}
                onChange={(value) => setRole(value as 'editor' | 'owner' | 'viewer')}
              />
              <Button
                disabled={!username.trim()}
                loading={granting}
                type={'primary'}
                onClick={handleGrant}
              >
                {t('share.members.add')}
              </Button>
            </Flexbox>

            <Flexbox horizontal align={'flex-end'} gap={8} wrap={'wrap'}>
              <Flexbox gap={4} style={{ flex: 1, minWidth: 240 }}>
                <Text fontSize={12} type={'secondary'}>
                  {t('share.members.expiresAtLabel')}
                </Text>
                <Input
                  placeholder={t('share.members.expiresAtPlaceholder')}
                  style={{ minWidth: 220 }}
                  type="datetime-local"
                  value={permissionExpiresAt}
                  onChange={(event) => setPermissionExpiresAt(event.target.value)}
                />
              </Flexbox>
              <Button disabled={!permissionExpiresAt} onClick={() => setPermissionExpiresAt('')}>
                {t('share.members.clearExpiry')}
              </Button>
            </Flexbox>

            <Flexbox gap={8}>
              <Flexbox horizontal align={'center'} gap={8} wrap={'wrap'}>
                <Switch
                  checked={role === 'editor' && canReshare}
                  disabled={role !== 'editor'}
                  onChange={setCanReshare}
                />
                <Text>{t('share.members.canReshare')}</Text>
              </Flexbox>
              <Flexbox horizontal align={'center'} gap={8} wrap={'wrap'}>
                <Switch checked={inheritsToChildren} onChange={setInheritsToChildren} />
                <Text>{t('share.members.inheritsToChildren')}</Text>
              </Flexbox>
            </Flexbox>

            <Text fontSize={12} type={'secondary'}>
              {role === 'editor'
                ? t('share.members.canReshareHint')
                : t('share.members.canReshareHintDisabled')}
            </Text>

            <Flexbox gap={8}>
              {permissionsLoading ? (
                <Text type={'secondary'}>{t('share.loading')}</Text>
              ) : permissions?.length ? (
                permissions.map((permission) => (
                  <Flexbox
                    horizontal
                    align={'center'}
                    gap={12}
                    justify={'space-between'}
                    key={permission.id}
                    padding={12}
                    style={{
                      border: '1px solid var(--ant-color-border-secondary)',
                      borderRadius: 8,
                    }}
                  >
                    <Flexbox flex={1} gap={6}>
                      <Text strong>
                        {permission.subjectUsername ||
                          permission.subjectName ||
                          permission.subjectId}
                      </Text>
                      <Flexbox horizontal gap={8} wrap={'wrap'}>
                        <Tag size={'small'}>{t(getPermissionRoleKey(permission.role))}</Tag>
                        {permission.role === 'editor' && permission.canReshare && (
                          <Tag size={'small'}>{t('share.members.canReshareEnabled')}</Tag>
                        )}
                        <Tag size={'small'}>
                          {permission.inheritsToChildren
                            ? t('share.members.inheritsEnabled')
                            : t('share.members.inheritsDisabled')}
                        </Tag>
                        <Tag size={'small'}>
                          {permission.expiresAt
                            ? t('share.members.expiresAtValue', {
                                date: permission.expiresAt.toLocaleString(),
                              })
                            : t('share.members.noExpiry')}
                        </Tag>
                      </Flexbox>
                    </Flexbox>
                    <Button
                      danger
                      loading={revokingPermissionId === permission.id}
                      onClick={async () => {
                        setRevokingPermissionId(permission.id);

                        try {
                          await lambdaClient.resourceShare.revokeResourcePermission.mutate({
                            permissionId: permission.id,
                          });
                          await refresh();
                          message.success(t('share.members.revoked'));
                        } catch (error) {
                          message.error(getErrorMessage(error));
                        } finally {
                          setRevokingPermissionId(null);
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
          </>
        )}
      </Flexbox>

      <Flexbox gap={8}>
        <Text strong>{t('share.links.title')}</Text>

        {linksUnavailable ? (
          <Alert showIcon message={t('share.links.unavailable')} type={'info'} />
        ) : linksLoadError ? (
          <Flexbox gap={8}>
            <Text type={'secondary'}>{t('share.links.loadError')}</Text>
            <Button onClick={retryLinks}>{t('share.manage.retry')}</Button>
          </Flexbox>
        ) : (
          <>
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
              <Button loading={creatingLink} type={'primary'} onClick={handleCreateLink}>
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
              {linksLoading ? (
                <Text type={'secondary'}>{t('share.loading')}</Text>
              ) : links?.length ? (
                links.map((link) => (
                  <Flexbox
                    horizontal
                    align={'center'}
                    gap={12}
                    justify={'space-between'}
                    key={link.id}
                    padding={12}
                    style={{
                      border: '1px solid var(--ant-color-border-secondary)',
                      borderRadius: 8,
                    }}
                  >
                    <Flexbox flex={1} gap={6}>
                      <Text strong>{link.id}</Text>
                      <Flexbox horizontal gap={8} wrap={'wrap'}>
                        <Tag size={'small'}>
                          {t('share.links.expiresAt', { date: link.expiresAt.toLocaleString() })}
                        </Tag>
                        {link.disabledAt && (
                          <Tag color={'default'} size={'small'}>
                            {t('share.links.disabled')}
                          </Tag>
                        )}
                      </Flexbox>
                    </Flexbox>
                    <Button
                      danger
                      disabled={!!link.disabledAt}
                      loading={disablingLinkId === link.id}
                      onClick={async () => {
                        setDisablingLinkId(link.id);

                        try {
                          await lambdaClient.resourceShare.disableResourceShareLink.mutate({
                            shareLinkId: link.id,
                          });
                          await refresh();
                          message.success(t('share.links.disabledSuccess'));
                        } catch (error) {
                          message.error(getErrorMessage(error));
                        } finally {
                          setDisablingLinkId(null);
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
          </>
        )}
      </Flexbox>
    </Flexbox>
  );
});

ResourceShareModal.displayName = 'ResourceShareModal';

export default ResourceShareModal;
