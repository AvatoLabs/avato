'use client';

import {
  Avatar,
  Block,
  Button,
  Collapse,
  copyToClipboard,
  Flexbox,
  Input,
  SearchBar,
  Select,
  Tag,
  Text,
} from '@lobehub/ui';
import { TRPCClientError } from '@trpc/client';
import { useDebounce } from 'ahooks';
import { Alert, App, Switch } from 'antd';
import { memo, useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';

import { lambdaClient } from '@/libs/trpc/client';
import { type ContentKind, type ContentPermissionItem } from '@/types/content';

interface ResourceShareModalProps {
  id: string;
  kind: ContentKind;
  name: string;
}

interface MemberSearchResult {
  avatar?: string | null;
  fullName?: string | null;
  id: string;
  username?: string | null;
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

const getPermissionLabel = (permission: ContentPermissionItem) =>
  permission.subjectName || permission.subjectUsername || permission.subjectId;

const getPermissionSubLabel = (permission: ContentPermissionItem) =>
  permission.subjectUsername ? `@${permission.subjectUsername}` : permission.subjectId;

const getMemberLabel = (member: MemberSearchResult) =>
  member.fullName || member.username || member.id;

const getMemberSubLabel = (member: MemberSearchResult) => `@${member.username || member.id}`;

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
  const [permissionExpiresAt, setPermissionExpiresAt] = useState('');
  const [canReshare, setCanReshare] = useState(false);
  const [inheritsToChildren, setInheritsToChildren] = useState(true);
  const [granting, setGranting] = useState(false);
  const [creatingLink, setCreatingLink] = useState(false);
  const [revokingPermissionId, setRevokingPermissionId] = useState<string | null>(null);
  const [disablingLinkId, setDisablingLinkId] = useState<string | null>(null);
  const [memberQuery, setMemberQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState<MemberSearchResult | null>(null);
  const [memberFilter, setMemberFilter] = useState('');

  const debouncedMemberQuery = useDebounce(memberQuery.trim(), { wait: 250 });
  const deferredMemberFilter = useDeferredValue(memberFilter);

  const {
    data: permissions,
    error: permissionsError,
    isLoading: permissionsLoading,
    mutate: mutatePermissions,
  } = useSWR(
    ['resource-share-permissions', kind, id],
    () => lambdaClient.contentShare.listContentPermissions.query({ id, kind }),
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
    () => lambdaClient.contentShare.listContentShareLinks.query({ id, kind }),
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
    ['content-share-explain', kind, id],
    () => lambdaClient.contentShare.explainContentAccess.query({ id, kind }),
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

  const {
    data: searchedMembers,
    error: searchMembersError,
    isLoading: searchMembersLoading,
  } = useSWR(
    !membersUnavailable && debouncedMemberQuery
      ? ['resource-share-member-search', debouncedMemberQuery]
      : null,
    () => lambdaClient.user.searchUsers.query({ keyword: debouncedMemberQuery, limit: 8 }),
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    },
  );

  const exactMatchedMember =
    searchedMembers?.find(
      (member) => member.username?.toLowerCase() === debouncedMemberQuery.toLowerCase(),
    ) || null;
  const activeMember = selectedMember || exactMatchedMember;
  const grantedMemberIds = new Set(permissions?.map((permission) => permission.subjectId) || []);

  const filteredPermissions =
    permissions?.filter((permission) => {
      const keyword = deferredMemberFilter.trim().toLowerCase();
      if (!keyword) return true;

      return [
        permission.subjectId,
        permission.subjectName,
        permission.subjectUsername,
        t(getPermissionRoleKey(permission.role)),
      ].some((value) => value?.toLowerCase().includes(keyword));
    }) || [];

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
    if (!activeMember?.username) return;

    const resolvedExpiresAt = permissionExpiresAt ? new Date(permissionExpiresAt) : undefined;
    if (resolvedExpiresAt && Number.isNaN(resolvedExpiresAt.getTime())) {
      message.error(t('share.members.invalidExpiry'));
      return;
    }

    setGranting(true);

    try {
      await lambdaClient.contentShare.grantContentPermission.mutate({
        canReshare: role === 'editor' && canReshare,
        expiresAt: resolvedExpiresAt,
        id,
        inheritsToChildren,
        kind,
        role,
        username: activeMember.username,
      });

      setMemberQuery('');
      setSelectedMember(null);
      setPermissionExpiresAt('');
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
      const link = await lambdaClient.contentShare.createContentShareLink.mutate({
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
      <Block padding={16} variant={'outlined'}>
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
      </Block>

      {noManageSections && <Alert showIcon message={t('share.manage.unavailable')} type={'info'} />}

      <Block padding={16} variant={'outlined'}>
        <Flexbox gap={12}>
          <Flexbox gap={4}>
            <Text strong>{t('share.members.title')}</Text>
            <Text type={'secondary'}>{t('share.members.subtitle')}</Text>
          </Flexbox>

          {membersUnavailable ? (
            <Alert showIcon message={t('share.members.unavailable')} type={'info'} />
          ) : membersLoadError ? (
            <Flexbox gap={8}>
              <Text type={'secondary'}>{t('share.members.loadError')}</Text>
              <Button onClick={retryMembers}>{t('share.manage.retry')}</Button>
            </Flexbox>
          ) : (
            <Flexbox gap={12}>
              <Flexbox gap={8}>
                <SearchBar
                  allowClear
                  placeholder={t('share.members.usernamePlaceholder')}
                  value={memberQuery}
                  variant="outlined"
                  onInputChange={(value) => {
                    const nextValue = value || '';

                    setMemberQuery(nextValue);

                    if (selectedMember && nextValue.trim() !== selectedMember.username) {
                      setSelectedMember(null);
                    }
                  }}
                  onSearch={(value) => {
                    setMemberQuery(value);

                    if (selectedMember && value.trim() !== selectedMember.username) {
                      setSelectedMember(null);
                    }
                  }}
                />
                <Text fontSize={12} type={'secondary'}>
                  {t('share.members.searchHint')}
                </Text>
              </Flexbox>

              {searchMembersError && (
                <Alert showIcon message={t('share.members.searchFailed')} type={'error'} />
              )}

              {!!debouncedMemberQuery && (
                <Flexbox gap={8}>
                  <Text strong>{t('share.members.searchResultsTitle')}</Text>
                  {searchMembersLoading ? (
                    <Text type={'secondary'}>{t('share.members.searching')}</Text>
                  ) : searchedMembers?.length ? (
                    <Flexbox gap={8}>
                      {searchedMembers.map((member) => {
                        const isActive = activeMember?.id === member.id;
                        const isGranted = grantedMemberIds.has(member.id);

                        return (
                          <Block
                            horizontal
                            align={'center'}
                            gap={12}
                            key={member.id}
                            padding={12}
                            variant={'outlined'}
                          >
                            <Avatar alt={getMemberLabel(member)} avatar={member.avatar} />
                            <Flexbox flex={1} gap={4} style={{ minWidth: 0 }}>
                              <Flexbox gap={2} style={{ minWidth: 0 }}>
                                <Text ellipsis strong>
                                  {getMemberLabel(member)}
                                </Text>
                                <Text ellipsis fontSize={12} type={'secondary'}>
                                  {getMemberSubLabel(member)}
                                </Text>
                              </Flexbox>
                              <Flexbox horizontal gap={8} wrap={'wrap'}>
                                {isActive && (
                                  <Tag size={'small'}>{t('share.members.selected')}</Tag>
                                )}
                                {isGranted && (
                                  <Tag color={'default'} size={'small'}>
                                    {t('share.members.alreadyGranted')}
                                  </Tag>
                                )}
                              </Flexbox>
                            </Flexbox>
                            <Button
                              type={isActive ? 'default' : 'primary'}
                              onClick={() => {
                                setSelectedMember(member);
                                setMemberQuery(member.username || '');
                              }}
                            >
                              {isActive ? t('share.members.selected') : t('share.members.select')}
                            </Button>
                          </Block>
                        );
                      })}
                    </Flexbox>
                  ) : (
                    <Text type={'secondary'}>{t('share.members.searchEmpty')}</Text>
                  )}
                </Flexbox>
              )}

              {activeMember && (
                <Block padding={12} variant={'outlined'}>
                  <Flexbox horizontal align={'center'} gap={12}>
                    <Avatar alt={getMemberLabel(activeMember)} avatar={activeMember.avatar} />
                    <Flexbox flex={1} gap={2} style={{ minWidth: 0 }}>
                      <Text ellipsis strong>
                        {getMemberLabel(activeMember)}
                      </Text>
                      <Text ellipsis fontSize={12} type={'secondary'}>
                        {getMemberSubLabel(activeMember)}
                      </Text>
                    </Flexbox>
                    <Tag size={'small'}>{t('share.members.selected')}</Tag>
                  </Flexbox>
                </Block>
              )}

              <Flexbox horizontal gap={8} wrap={'wrap'}>
                <Select
                  style={{ minWidth: 180 }}
                  value={role}
                  options={[
                    { label: t('share.roles.viewer'), value: 'viewer' },
                    { label: t('share.roles.editor'), value: 'editor' },
                    { label: t('space.roles.owner'), value: 'owner' },
                  ]}
                  onChange={(value) => setRole(value as 'editor' | 'owner' | 'viewer')}
                />
                <Button
                  disabled={!activeMember?.username}
                  loading={granting}
                  type={'primary'}
                  onClick={handleGrant}
                >
                  {t('share.members.add')}
                </Button>
              </Flexbox>

              <Collapse
                defaultActiveKey={[]}
                expandIconPlacement={'end'}
                variant={'outlined'}
                items={[
                  {
                    children: (
                      <Flexbox gap={12}>
                        <Flexbox horizontal gap={8} wrap={'wrap'}>
                          <Input
                            placeholder={t('share.members.expiresAtPlaceholder')}
                            style={{ flex: 1, minWidth: 260 }}
                            type="datetime-local"
                            value={permissionExpiresAt}
                            onChange={(event) => setPermissionExpiresAt(event.target.value)}
                          />
                          <Button
                            disabled={!permissionExpiresAt}
                            onClick={() => setPermissionExpiresAt('')}
                          >
                            {t('share.members.clearExpiry')}
                          </Button>
                        </Flexbox>

                        <Block padding={12} variant={'outlined'}>
                          <Flexbox gap={10}>
                            <Flexbox
                              horizontal
                              align={'center'}
                              gap={12}
                              justify={'space-between'}
                              wrap={'wrap'}
                            >
                              <Flexbox gap={2} style={{ minWidth: 240 }}>
                                <Text>{t('share.members.canReshare')}</Text>
                                <Text fontSize={12} type={'secondary'}>
                                  {role === 'editor'
                                    ? t('share.members.canReshareHint')
                                    : t('share.members.canReshareHintDisabled')}
                                </Text>
                              </Flexbox>
                              <Switch
                                checked={role === 'editor' && canReshare}
                                disabled={role !== 'editor'}
                                onChange={setCanReshare}
                              />
                            </Flexbox>

                            <Flexbox
                              horizontal
                              align={'center'}
                              gap={12}
                              justify={'space-between'}
                              wrap={'wrap'}
                            >
                              <Flexbox gap={2} style={{ minWidth: 240 }}>
                                <Text>{t('share.members.inheritsToChildren')}</Text>
                                <Text fontSize={12} type={'secondary'}>
                                  {t('share.members.inheritsHint')}
                                </Text>
                              </Flexbox>
                              <Switch
                                checked={inheritsToChildren}
                                onChange={setInheritsToChildren}
                              />
                            </Flexbox>
                          </Flexbox>
                        </Block>
                      </Flexbox>
                    ),
                    key: 'advanced',
                    label: t('share.members.advancedTitle'),
                  },
                ]}
              />

              <Collapse
                defaultActiveKey={[]}
                expandIconPlacement={'end'}
                variant={'outlined'}
                items={[
                  {
                    children: (
                      <Flexbox gap={8}>
                        {!!permissions?.length && (
                          <SearchBar
                            allowClear
                            placeholder={t('share.members.filterPlaceholder')}
                            value={memberFilter}
                            variant="outlined"
                            onInputChange={(value) => setMemberFilter(value || '')}
                            onSearch={(value) => setMemberFilter(value)}
                          />
                        )}

                        {permissionsLoading ? (
                          <Text type={'secondary'}>{t('share.loading')}</Text>
                        ) : permissions?.length ? (
                          filteredPermissions.length ? (
                            <Flexbox gap={8}>
                              {filteredPermissions.map((permission) => (
                                <Block
                                  horizontal
                                  align={'center'}
                                  gap={12}
                                  key={permission.id}
                                  padding={12}
                                  variant={'outlined'}
                                >
                                  <Avatar
                                    alt={getPermissionLabel(permission)}
                                    avatar={permission.subjectAvatar}
                                  />
                                  <Flexbox flex={1} gap={6} style={{ minWidth: 0 }}>
                                    <Flexbox gap={2} style={{ minWidth: 0 }}>
                                      <Text ellipsis strong>
                                        {getPermissionLabel(permission)}
                                      </Text>
                                      <Text ellipsis fontSize={12} type={'secondary'}>
                                        {getPermissionSubLabel(permission)}
                                      </Text>
                                    </Flexbox>
                                    <Flexbox horizontal gap={8} wrap={'wrap'}>
                                      <Tag size={'small'}>
                                        {t(getPermissionRoleKey(permission.role))}
                                      </Tag>
                                      {permission.role === 'editor' && permission.canReshare && (
                                        <Tag size={'small'}>
                                          {t('share.members.canReshareEnabled')}
                                        </Tag>
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
                                        await lambdaClient.contentShare.revokeContentPermission.mutate(
                                          {
                                            permissionId: permission.id,
                                          },
                                        );
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
                                </Block>
                              ))}
                            </Flexbox>
                          ) : (
                            <Text type={'secondary'}>{t('share.members.filterEmpty')}</Text>
                          )
                        ) : (
                          <Text type={'secondary'}>{t('share.members.empty')}</Text>
                        )}
                      </Flexbox>
                    ),
                    key: 'granted-members',
                    label: `${t('share.members.currentTitle')} (${permissions?.length || 0})`,
                  },
                ]}
              />
            </Flexbox>
          )}
        </Flexbox>
      </Block>

      {linksUnavailable ? (
        <Alert showIcon message={t('share.links.unavailable')} type={'info'} />
      ) : linksLoadError ? (
        <Flexbox gap={8}>
          <Text type={'secondary'}>{t('share.links.loadError')}</Text>
          <Button onClick={retryLinks}>{t('share.manage.retry')}</Button>
        </Flexbox>
      ) : (
        <Collapse
          defaultActiveKey={[]}
          expandIconPlacement={'end'}
          variant={'outlined'}
          items={[
            {
              children: (
                <Flexbox gap={12} padding={16}>
                  <Text type={'secondary'}>{t('share.links.subtitle')}</Text>

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
                      style={{ flex: 1, minWidth: 240 }}
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                    <Button loading={creatingLink} type={'primary'} onClick={handleCreateLink}>
                      {t('share.links.create')}
                    </Button>
                  </Flexbox>

                  {latestShareUrl && (
                    <Block padding={12} variant={'outlined'}>
                      <Flexbox gap={8}>
                        <Text strong>{t('share.links.latest')}</Text>
                        <Text style={{ wordBreak: 'break-all' }}>{latestShareUrl}</Text>
                        <Flexbox horizontal gap={8} wrap={'wrap'}>
                          <Button onClick={handleCopyLink}>{t('share.links.copy')}</Button>
                          {latestFileDownloadUrl && (
                            <Button onClick={handleCopyDirectDownload}>
                              {t('share.links.copyDirectDownload')}
                            </Button>
                          )}
                        </Flexbox>
                        {latestFileDownloadUrl && (
                          <Flexbox gap={6}>
                            <Text fontSize={12} type={'secondary'}>
                              {t('share.links.directDownloadHint')}
                            </Text>
                            <Text style={{ wordBreak: 'break-all' }}>{latestFileDownloadUrl}</Text>
                          </Flexbox>
                        )}
                      </Flexbox>
                    </Block>
                  )}

                  <Text fontSize={12} type={'secondary'}>
                    {t('share.links.note')}
                  </Text>

                  <Text strong>{t('share.links.currentTitle')}</Text>

                  {linksLoading ? (
                    <Text type={'secondary'}>{t('share.loading')}</Text>
                  ) : links?.length ? (
                    <Flexbox gap={8}>
                      {links.map((link) => (
                        <Block
                          horizontal
                          align={'center'}
                          gap={12}
                          key={link.id}
                          padding={12}
                          variant={'outlined'}
                        >
                          <Flexbox flex={1} gap={6} style={{ minWidth: 0 }}>
                            <Text strong>
                              {link.createdAt
                                ? t('share.links.createdAt', {
                                    date: new Date(link.createdAt).toLocaleString(),
                                  })
                                : link.id}
                            </Text>
                            <Flexbox horizontal gap={8} wrap={'wrap'}>
                              <Tag size={'small'}>
                                {t('share.links.expiresAt', {
                                  date: link.expiresAt.toLocaleString(),
                                })}
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
                                await lambdaClient.contentShare.disableContentShareLink.mutate({
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
                        </Block>
                      ))}
                    </Flexbox>
                  ) : (
                    <Text type={'secondary'}>{t('share.links.empty')}</Text>
                  )}
                </Flexbox>
              ),
              key: 'links',
              label: `${t('share.links.title')} (${links?.length || 0})`,
            },
          ]}
        />
      )}
    </Flexbox>
  );
});

ResourceShareModal.displayName = 'ResourceShareModal';

export default ResourceShareModal;
