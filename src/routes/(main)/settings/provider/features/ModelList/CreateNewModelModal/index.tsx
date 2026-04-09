import { Button, Modal } from '@lobehub/ui';
import { App, type FormInstance } from 'antd';
import { memo, use, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAiInfraStore } from '@/store/aiInfra';

import { ProviderSettingsContext } from '../ProviderSettingsContext';
import ModelConfigForm from './Form';

interface ModelConfigModalProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const ModelConfigModal = memo<ModelConfigModalProps>(({ open, setOpen }) => {
  const { t } = useTranslation(['modelProvider', 'common']);
  const { message } = App.useApp();
  const [formInstance, setFormInstance] = useState<FormInstance>();
  const [loading, setLoading] = useState(false);
  const [editingProvider, createNewAiModel] = useAiInfraStore((s) => [
    s.activeAiProvider!,
    s.createNewAiModel,
  ]);

  const closeModal = () => {
    setOpen(false);
  };

  const { showDeployName } = use(ProviderSettingsContext);

  return (
    <Modal
      destroyOnHidden
      mask={{ closable: true }}
      open={open}
      title={t('providerModels.createNew.title')}
      zIndex={1251} // Select is 1150
      footer={[
        <Button key="cancel" onClick={closeModal}>
          {t('cancel', { ns: 'common' })}
        </Button>,

        <Button
          key="ok"
          loading={loading}
          style={{ marginInlineStart: '16px' }}
          type="primary"
          onClick={async () => {
            if (!editingProvider || !formInstance) return;
            setLoading(true);

            try {
              await formInstance.validateFields();
              const data = formInstance.getFieldsValue();
              await createNewAiModel({ ...data, providerId: editingProvider });
              closeModal();
            } catch (error: any) {
              if (!error?.errorFields) {
                message.error(t('providerModels.createNew.createError'));
              }
            } finally {
              setLoading(false);
            }
          }}
        >
          {t('ok', { ns: 'common' })}
        </Button>,
      ]}
      styles={{
        body: {
          display: 'flex',
          flexDirection: 'column',
          maxHeight: 'calc(100vh - 150px)',
        },
      }}
      onCancel={closeModal}
    >
      <ModelConfigForm showDeployName={showDeployName} onFormInstanceReady={setFormInstance} />
    </Modal>
  );
});
export default ModelConfigModal;
