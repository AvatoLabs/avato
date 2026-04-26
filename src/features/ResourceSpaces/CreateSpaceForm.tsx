'use client';

import { Button, Flexbox, Input, TextArea } from '@lobehub/ui';
import { useModalContext } from '@lobehub/ui/base-ui';
import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { lambdaClient } from '@/libs/trpc/client';

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

export default CreateSpaceForm;
