'use client';

import { Block, Button, Flexbox, Input, Text, TextArea } from '@lobehub/ui';
import { App } from 'antd';
import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import useSWR from 'swr';

import Loading from '@/components/Loading/BrandTextLoading';
import { lambdaClient } from '@/libs/trpc/client';
import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/slices/auth/selectors';

import { buildSpaceRootPath } from './paths';
import { resolveSpaceDisplayName } from './resolveSpaceDisplayName';

const SpaceSettingsPage = memo(() => {
  const { t } = useTranslation('file');
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const { spaceId } = useParams<{ spaceId: string }>();
  const username = useUserStore(userProfileSelectors.username);
  const fullName = useUserStore(userProfileSelectors.fullName);
  const [description, setDescription] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

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

  useEffect(() => {
    if (!space) return;
    setName(resolveSpaceDisplayName(space, t, { fullName, username }) || '');
    setDescription(space.description || '');
  }, [fullName, space, t, username]);

  const refresh = async () => {
    await mutateSpace();
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

  const handleDeleteSpace = async () => {
    if (!spaceId || !isOwner || space.kind !== 'team') return;

    modal.confirm({
      okButtonProps: { danger: true },
      onOk: async () => {
        await lambdaClient.space.deleteSpace.mutate({ id: spaceId });
        navigate('/');
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
            placeholder={t('space.settings.namePlaceholder')}
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

      <Button onClick={() => navigate(buildSpaceRootPath(space.id))}>
        {t('space.settings.back')}
      </Button>
    </Flexbox>
  );
});

SpaceSettingsPage.displayName = 'SpaceSettingsPage';

export default SpaceSettingsPage;
