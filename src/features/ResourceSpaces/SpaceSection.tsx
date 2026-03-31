'use client';

import { AccordionItem, ActionIcon, Button, Flexbox, Input, Text, TextArea } from '@lobehub/ui';
import { createModal, useModalContext } from '@lobehub/ui/base-ui';
import { PlusIcon } from 'lucide-react';
import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useSWRConfig } from 'swr';

import { lambdaClient } from '@/libs/trpc/client';

import { buildContentRootPath } from './paths';
import SpaceList, { SPACE_LIST_KEY } from './SpaceList';

interface CreateSpaceFormProps {
  onCreated: (spaceId: string) => void;
}

export const CreateSpaceForm = memo<CreateSpaceFormProps>(({ onCreated }) => {
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
  const navigate = useNavigate();
  const { spaceId: currentSpaceId } = useParams<{ spaceId?: string }>();
  const { mutate } = useSWRConfig();

  const handleCreateSpace = useCallback(() => {
    createModal({
      children: (
        <CreateSpaceForm
          onCreated={(spaceId) => {
            void mutate(SPACE_LIST_KEY);
            navigate(buildContentRootPath(spaceId));
          }}
        />
      ),
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
      <Flexbox gap={1} paddingInline={4}>
        <SpaceList
          currentSpaceId={currentSpaceId}
          onSelectSpace={(spaceId) => navigate(buildContentRootPath(spaceId))}
        />
      </Flexbox>
    </AccordionItem>
  );
});

SpaceSection.displayName = 'SpaceSection';

export default SpaceSection;
