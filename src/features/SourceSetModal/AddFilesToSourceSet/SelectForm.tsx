import { Block, Button, Flexbox, Form, MaterialFileTypeIcon, Select } from '@lobehub/ui';
import { App } from 'antd';
import { memo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import RepoIcon from '@/components/LibIcon';
import { buildSourceSetPath } from '@/features/ResourceSpaces';
import { getActiveWorkspaceSpaceId } from '@/helpers/activeWorkspaceSpace';
import { useSourceSetStore } from '@/store/sourceSet';

interface CreateFormProps {
  fileIds: string[];
  onClose?: () => void;
  sourceSetId?: string;
}

const SelectForm = memo<CreateFormProps>(({ onClose, sourceSetId, fileIds }) => {
  const { t } = useTranslation('sourceSet');
  const [loading, setLoading] = useState(false);
  const activeWorkspaceSpaceId = getActiveWorkspaceSpaceId();

  const { message } = App.useApp();
  const [useFetchSourceSetList, addFilesToSourceSet] = useSourceSetStore((s) => [
    s.useFetchSourceSetList,
    s.addFilesToSourceSet,
  ]);
  const { data, isLoading } = useFetchSourceSetList(activeWorkspaceSpaceId);
  const onFinish = async (values: { id: string }) => {
    setLoading(true);

    try {
      await addFilesToSourceSet(values.id, fileIds);
      setLoading(false);
      message.success({
        content: (
          <Trans
            i18nKey={'addToSourceSet.addSuccess'}
            ns={'sourceSet'}
            components={[
              <span key="0" />,
              <Link key="1" to={buildSourceSetPath(activeWorkspaceSpaceId, values.id)} />,
            ]}
          />
        ),
      });

      onClose?.();
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  return (
    <Form
      gap={16}
      itemsType={'flat'}
      layout={'vertical'}
      footer={
        <Button block htmlType={'submit'} loading={loading} type={'primary'}>
          {t('addToSourceSet.confirm')}
        </Button>
      }
      items={[
        {
          children: (
            <Block horizontal align={'center'} gap={8} padding={16} variant={'filled'}>
              <MaterialFileTypeIcon filename={''} size={32} />
              {t('addToSourceSet.totalFiles', { count: fileIds.length })}
            </Block>
          ),
          noStyle: true,
        },
        {
          children: (
            <Select
              autoFocus
              loading={isLoading}
              placeholder={t('addToSourceSet.id.placeholder')}
              options={(data || [])
                .filter((item) => item.id !== sourceSetId)
                .map((item) => ({
                  label: (
                    <Flexbox horizontal gap={8}>
                      <RepoIcon />
                      {item.name}
                    </Flexbox>
                  ),
                  value: item.id,
                }))}
            />
          ),
          label: t('addToSourceSet.id.title'),
          name: 'id',
          rules: [{ message: t('addToSourceSet.id.required'), required: true }],
        },
      ]}
      onFinish={onFinish}
    />
  );
});

export default SelectForm;
