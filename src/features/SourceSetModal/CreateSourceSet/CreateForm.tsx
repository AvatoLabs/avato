import { Button, Flexbox, Input, TextArea } from '@lobehub/ui';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useSourceSetStore } from '@/store/sourceSet';

interface CreateFormProps {
  id?: string;
  initialValues?: { name?: string; description?: string };
  onClose?: () => void;
  onSuccess?: (id: string) => void;
  spaceId?: string;
}

const CreateForm = memo<CreateFormProps>(({ id, initialValues, onClose, onSuccess, spaceId }) => {
  const { t } = useTranslation('sourceSet');
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(initialValues?.name || '');
  const [description, setDescription] = useState(initialValues?.description || '');
  const createSourceSet = useSourceSetStore((s) => s.createSourceSet);
  const updateSourceSet = useSourceSetStore((s) => s.updateSourceSet);

  const isEditMode = !!id;

  const handleSubmit = async () => {
    if (!name.trim()) return;

    setLoading(true);
    const values = { description: description.trim(), name: name.trim(), spaceId };

    try {
      if (isEditMode) {
        await updateSourceSet(id, values);
        setLoading(false);
        onClose?.();
      } else {
        const newId = await createSourceSet(values);
        setLoading(false);
        onSuccess?.(newId);
        onClose?.();
      }
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  return (
    <Flexbox gap={16}>
      <Input
        autoFocus
        placeholder={t('createNew.name.placeholder')}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Flexbox gap={8}>
        <label style={{ fontSize: 14 }}>{t('createNew.description.label')}</label>
        <TextArea
          placeholder={t('createNew.description.placeholder')}
          style={{ minHeight: 120 }}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Flexbox>
      <Button block loading={loading} type={'primary'} onClick={handleSubmit}>
        {isEditMode ? t('createNew.edit.confirm') : t('createNew.confirm')}
      </Button>
    </Flexbox>
  );
});

export default CreateForm;
