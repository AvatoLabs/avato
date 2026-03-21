'use client';

import {
  AccordionItem,
  ActionIcon,
  Button,
  createModal,
  Flexbox,
  Input,
  Text,
  TextArea,
  useModalContext,
} from '@lobehub/ui';
import { HouseIcon, PlusIcon, Settings2Icon, Share2Icon, Users2Icon } from 'lucide-react';
import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import useSWR from 'swr';

import NavItem from '@/features/NavPanel/components/NavItem';
import SkeletonList from '@/features/NavPanel/components/SkeletonList';
import { lambdaClient } from '@/libs/trpc/client';

import { buildResourceRootPath, buildResourceSharedPath, buildSpaceSettingsPath } from './paths';

const SPACE_LIST_KEY = 'resource-space-list';

interface CreateSpaceFormProps {
  onCreated: (spaceId: string) => void;
}

const CreateSpaceForm = memo<CreateSpaceFormProps>(({ onCreated }) => {
  const { t } = useTranslation('file');
  const { close } = useModalContext();
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) return;

    setLoading(true);

    try {
      const space = await lambdaClient.space.createTeamSpace.mutate({
        description: description.trim() || undefined,
        name: name.trim(),
      });

      onCreated(space.id);
      close();
    } finally {
      setLoading(false);
    }
  }, [close, description, name, onCreated]);

  return (
    <Flexbox gap={12} paddingInline={8} style={{ paddingBottom: 8 }}>
      <Input
        autoFocus
        placeholder={t('space.create.namePlaceholder')}
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <TextArea
        placeholder={t('space.create.descriptionPlaceholder')}
        style={{ minHeight: 96, padding: '10px 12px', resize: 'vertical' }}
        value={description}
        onChange={(event) => setDescription(event.target.value)}
      />
      <Button
        block
        disabled={loading || !name.trim()}
        loading={loading}
        type={'primary'}
        onClick={handleSubmit}
      >
        {loading ? t('space.create.creating') : t('space.create.confirm')}
      </Button>
    </Flexbox>
  );
});

CreateSpaceForm.displayName = 'CreateSpaceForm';

const SpaceSection = memo<{ itemKey: string }>(({ itemKey }) => {
  const { t } = useTranslation('file');
  const location = useLocation();
  const navigate = useNavigate();
  const { spaceId: currentSpaceId } = useParams<{ spaceId?: string }>();

  const { data, isLoading, mutate } = useSWR(
    SPACE_LIST_KEY,
    () => lambdaClient.space.listSpaces.query(),
    { revalidateOnFocus: false },
  );

  const handleCreateSpace = useCallback(() => {
    createModal({
      children: (
        <CreateSpaceForm
          onCreated={(spaceId) => {
            void mutate();
            navigate(buildResourceRootPath(spaceId));
          }}
        />
      ),
      focusTriggerAfterClose: true,
      footer: null,
      title: t('space.create.title'),
      width: 420,
    });
  }, [mutate, navigate, t]);

  return (
    <AccordionItem
      itemKey={itemKey}
      paddingBlock={4}
      paddingInline={'8px 4px'}
      action={
        <ActionIcon
          icon={PlusIcon}
          size={'small'}
          title={t('space.create.title')}
          onClick={handleCreateSpace}
        />
      }
      title={
        <Text ellipsis fontSize={12} type={'secondary'} weight={500}>
          {t('space.sectionTitle')}
        </Text>
      }
    >
      {isLoading ? (
        <SkeletonList paddingInline={4} rows={4} />
      ) : (
        <Flexbox gap={1} paddingInline={4}>
          <NavItem
            active={location.pathname === buildResourceSharedPath()}
            icon={Share2Icon}
            title={t('shared.title')}
            onClick={() => navigate(buildResourceSharedPath())}
          />
          {data?.map((space) => {
            const active = currentSpaceId === space.id && !location.pathname.endsWith('/settings');
            const isCurrentSettings =
              currentSpaceId === space.id && location.pathname.endsWith('/settings');

            return (
              <NavItem
                active={active}
                icon={space.kind === 'personal' ? HouseIcon : Users2Icon}
                key={space.id}
                title={space.name}
                extra={
                  space.kind === 'team' ? (
                    <ActionIcon
                      active={isCurrentSettings}
                      icon={Settings2Icon}
                      size={'small'}
                      title={t('space.settings.title')}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        navigate(buildSpaceSettingsPath(space.id));
                      }}
                    />
                  ) : undefined
                }
                onClick={() => navigate(buildResourceRootPath(space.id))}
              />
            );
          })}
        </Flexbox>
      )}
    </AccordionItem>
  );
});

SpaceSection.displayName = 'SpaceSection';

export default SpaceSection;
