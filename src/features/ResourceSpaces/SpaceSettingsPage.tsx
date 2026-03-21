'use client';

import {
  ActionIcon,
  Avatar,
  Block,
  Button,
  Flexbox,
  Icon,
  Input,
  Select,
  Text,
  TextArea,
} from '@lobehub/ui';
import { App } from 'antd';
import { CrownIcon, Trash2Icon, UserRoundPlusIcon } from 'lucide-react';
import { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import useSWR from 'swr';

import Loading from '@/components/Loading/BrandTextLoading';
import { lambdaClient } from '@/libs/trpc/client';

import { buildResourceRootPath } from './paths';

const SpaceSettingsPage = memo(() => {
  const { t } = useTranslation('file');
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const { spaceId } = useParams<{ spaceId: string }>();
  const [description, setDescription] = useState('');
  const [memberRole, setMemberRole] = useState<'admin' | 'editor' | 'viewer'>('viewer');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
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
    canManage && spaceId ? ['resource-space-members', spaceId] : null,
    () => lambdaClient.space.listSpaceMembers.query({ spaceId: spaceId! }),
    { revalidateOnFocus: false },
  );

  useEffect(() => {
    if (!space) return;
    setName(space.name);
    setDescription(space.description || '');
  }, [space]);

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
        <Loading debugId="space-settings" />
      </Flexbox>
    );
  }

  const handleSave = async () => {
    if (!spaceId || !canManage || !name.trim()) return;

    setSaving(true);

    try {
      await lambdaClient.space.updateSpace.mutate({
        id: spaceId,
        value: {
          description: description.trim() || null,
          name: name.trim(),
        },
      });

      await refresh();
      message.success(t('space.settings.saved'));
    } finally {
      setSaving(false);
    }
  };

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

  const handleDeleteSpace = async () => {
    if (!spaceId || !isOwner || space.kind !== 'team') return;

    modal.confirm({
      okButtonProps: { danger: true },
      onOk: async () => {
        await lambdaClient.space.deleteSpace.mutate({ id: spaceId });
        navigate('/resource');
      },
      title: t('space.settings.deleteConfirm'),
    });
  };

  return (
    <Flexbox gap={16} padding={24} width={'100%'}>
      <Flexbox gap={4}>
        <Text as={'h2'}>{t('space.settings.title')}</Text>
        <Text type={'secondary'}>
          {space.kind === 'team'
            ? t('space.settings.teamSubtitle')
            : t('space.settings.personalSubtitle')}
        </Text>
      </Flexbox>

      <Block padding={16} variant={'outlined'}>
        <Flexbox gap={12}>
          <Text strong>{t('space.settings.details')}</Text>
          <Input
            disabled={!canManage}
            placeholder={t('space.create.namePlaceholder')}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <TextArea
            disabled={!canManage}
            placeholder={t('space.create.descriptionPlaceholder')}
            style={{ minHeight: 96, padding: '10px 12px', resize: 'vertical' }}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          {canManage ? (
            <Button loading={saving} type={'primary'} onClick={handleSave}>
              {t('space.settings.save')}
            </Button>
          ) : (
            <Text type={'secondary'}>{t('space.settings.readOnly')}</Text>
          )}
        </Flexbox>
      </Block>

      {space.kind === 'team' && (
        <Block padding={16} variant={'outlined'}>
          <Flexbox gap={12}>
            <Text strong>{t('space.members.title')}</Text>

            {canManage && (
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
            )}

            {membersLoading ? (
              <Loading debugId="space-members" />
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
      )}

      {isOwner && space.kind === 'team' && (
        <Block padding={16} variant={'outlined'}>
          <Flexbox gap={8}>
            <Text strong>{t('space.settings.dangerTitle')}</Text>
            <Text type={'secondary'}>{t('space.settings.dangerDesc')}</Text>
            <Button danger onClick={handleDeleteSpace}>
              {t('space.settings.delete')}
            </Button>
          </Flexbox>
        </Block>
      )}

      <Button onClick={() => navigate(buildResourceRootPath(space.id))}>
        {t('space.settings.back')}
      </Button>
    </Flexbox>
  );
});

SpaceSettingsPage.displayName = 'SpaceSettingsPage';

export default SpaceSettingsPage;
