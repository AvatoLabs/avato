'use client';

import { ActionIcon, Avatar, Block, Button, Flexbox, Icon, Input, Select, Text } from '@lobehub/ui';
import { App } from 'antd';
import { CrownIcon, Trash2Icon, UserRoundPlusIcon } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import useSWR from 'swr';

import Loading from '@/components/Loading/BrandTextLoading';
import { lambdaClient } from '@/libs/trpc/client';

import { buildSpaceRootPath } from './paths';

const SpaceMembersPage = memo(() => {
  const { t } = useTranslation('file');
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const { spaceId } = useParams<{ spaceId: string }>();
  const [memberRole, setMemberRole] = useState<'admin' | 'editor' | 'viewer'>('viewer');
  const [username, setUsername] = useState('');

  const {
    data: space,
    isLoading: spaceLoading,
    mutate: mutateSpace,
  } = useSWR(
    spaceId ? ['resource-space-detail', spaceId] : null,
    () => lambdaClient.space.getSpace.query({ id: spaceId! }),
    { revalidateOnFocus: false },
  );

  const canManage = space?.membershipRole === 'owner' || space?.membershipRole === 'admin';
  const isOwner = space?.membershipRole === 'owner';

  const {
    data: members,
    isLoading: membersLoading,
    mutate: mutateMembers,
  } = useSWR(
    space?.kind === 'team' && spaceId ? ['resource-space-members', spaceId] : null,
    () => lambdaClient.space.listSpaceMembers.query({ spaceId: spaceId! }),
    { revalidateOnFocus: false },
  );

  const roleOptions = useMemo(
    () => [
      { label: t('space.roles.admin'), value: 'admin' },
      { label: t('space.roles.editor'), value: 'editor' },
      { label: t('space.roles.viewer'), value: 'viewer' },
    ],
    [t],
  );

  const refresh = async () => {
    await Promise.all([mutateSpace(), mutateMembers()]);
  };

  if (spaceLoading || !space) {
    return (
      <Flexbox align={'center'} height={'100%'} justify={'center'}>
        <Loading debugId="space-members" />
      </Flexbox>
    );
  }

  const handleAddMember = async () => {
    if (!spaceId || !username.trim() || !canManage) return;

    const user = await lambdaClient.user.lookupUserByUsername.query({
      username: username.trim(),
    });

    if (!user?.id) {
      message.error(t('space.members.userNotFound'));
      return;
    }

    await lambdaClient.space.addSpaceMemberByUsername.mutate({
      role: memberRole,
      spaceId,
      username: username.trim(),
    });

    setUsername('');
    await refresh();
    message.success(t('space.members.added'));
  };

  const handleUpdateRole = async (userId: string, role: 'admin' | 'editor' | 'viewer') => {
    if (!spaceId || !canManage) return;

    await lambdaClient.space.updateSpaceMemberRole.mutate({
      role,
      spaceId,
      userId,
    });

    await refresh();
  };

  const handleRemoveMember = async (userId: string) => {
    if (!spaceId || !canManage) return;

    modal.confirm({
      okButtonProps: { danger: true },
      onOk: async () => {
        await lambdaClient.space.removeSpaceMember.mutate({ spaceId, userId });
        await refresh();
      },
      title: t('space.members.removeConfirm'),
    });
  };

  const handleTransferOwnership = async (userId: string) => {
    if (!spaceId || !isOwner) return;

    modal.confirm({
      onOk: async () => {
        await lambdaClient.space.transferSpaceOwnership.mutate({ spaceId, userId });
        await refresh();
      },
      title: t('space.members.transferConfirm'),
    });
  };

  return (
    <Flexbox gap={16} padding={24} width={'100%'}>
      <Flexbox gap={4}>
        <Text as={'h2'}>{t('space.members.title')}</Text>
        <Text type={'secondary'}>
          {space.kind === 'team'
            ? t('space.members.teamSubtitle')
            : t('space.members.personalSubtitle')}
        </Text>
      </Flexbox>

      {space.kind === 'team' ? (
        <Block padding={16} variant={'outlined'}>
          <Flexbox gap={12}>
            <Text strong>{t('space.members.title')}</Text>

            {canManage ? (
              <Flexbox horizontal gap={8} wrap={'wrap'}>
                <Input
                  placeholder={t('space.members.usernamePlaceholder')}
                  style={{ flex: 1, minWidth: 220 }}
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                />
                <Select
                  options={roleOptions}
                  style={{ minWidth: 140 }}
                  value={memberRole}
                  onChange={(value) => setMemberRole(value as 'admin' | 'editor' | 'viewer')}
                />
                <Button icon={UserRoundPlusIcon} type={'primary'} onClick={handleAddMember}>
                  {t('space.members.add')}
                </Button>
              </Flexbox>
            ) : (
              <Text type={'secondary'}>{t('space.settings.readOnly')}</Text>
            )}

            {membersLoading ? (
              <Loading debugId="space-members-list" />
            ) : (
              <Flexbox gap={8}>
                {members?.map((member) => (
                  <Block
                    horizontal
                    align={'center'}
                    gap={12}
                    key={member.userId}
                    padding={12}
                    variant={'outlined'}
                  >
                    <Avatar
                      alt={member.username || member.fullName || member.userId}
                      avatar={member.avatar}
                    />
                    <Flexbox flex={1} gap={2} style={{ overflow: 'hidden' }}>
                      <Text ellipsis strong>
                        {member.fullName || member.username || member.userId}
                      </Text>
                      <Text ellipsis fontSize={12} type={'secondary'}>
                        @{member.username || member.userId}
                      </Text>
                    </Flexbox>
                    {member.role === 'owner' ? (
                      <Flexbox horizontal align={'center'} gap={6}>
                        <Icon icon={CrownIcon} />
                        <Text>{t('space.roles.owner')}</Text>
                      </Flexbox>
                    ) : canManage ? (
                      <Flexbox horizontal align={'center'} gap={8}>
                        <Select
                          options={roleOptions}
                          style={{ minWidth: 140 }}
                          value={member.role}
                          onChange={(value) =>
                            handleUpdateRole(member.userId, value as 'admin' | 'editor' | 'viewer')
                          }
                        />
                        {isOwner && (
                          <Button onClick={() => handleTransferOwnership(member.userId)}>
                            {t('space.members.transfer')}
                          </Button>
                        )}
                        <ActionIcon
                          icon={Trash2Icon}
                          title={t('space.members.remove')}
                          onClick={() => handleRemoveMember(member.userId)}
                        />
                      </Flexbox>
                    ) : (
                      <Text>{t(`space.roles.${member.role}`)}</Text>
                    )}
                  </Block>
                ))}
              </Flexbox>
            )}
          </Flexbox>
        </Block>
      ) : null}

      <Button onClick={() => navigate(buildSpaceRootPath(space.id))}>
        {t('space.settings.back')}
      </Button>
    </Flexbox>
  );
});

SpaceMembersPage.displayName = 'SpaceMembersPage';

export default SpaceMembersPage;
