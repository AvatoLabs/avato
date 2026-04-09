import { Button, Modal } from '@lobehub/ui';
import { App, type FormInstance } from 'antd';
import isEqual from 'fast-deep-equal';
import { memo, use, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { aiModelSelectors, useAiInfraStore } from '@/store/aiInfra';

import ModelConfigForm from '../CreateNewModelModal/Form';
import { ProviderSettingsContext } from '../ProviderSettingsContext';

interface ModelConfigModalProps {
  id: string;
  open: boolean;
  setOpen: (open: boolean) => void;
}

const ModelConfigModal = memo<ModelConfigModalProps>(({ id, open, setOpen }) => {
  const { t } = useTranslation(['common', 'setting']);
  const { message } = App.useApp();
  const [formInstance, setFormInstance] = useState<FormInstance>();
  const [loading, setLoading] = useState(false);
  const [editingProvider, updateAiModelsConfig] = useAiInfraStore((s) => [
    s.activeAiProvider!,
    s.updateAiModelsConfig,
  ]);
  const model = useAiInfraStore(aiModelSelectors.getAiModelById(id), isEqual);

  const closeModal = () => {
    setOpen(false);
  };
  const { showDeployName } = use(ProviderSettingsContext);

  return (
    <Modal
      destroyOnHidden
      mask={{ closable: true }}
      open={open}
      title={t('llm.customModelCards.modelConfig.modalTitle', { ns: 'setting' })}
      zIndex={1251} // Select is 1150
      footer={[
        <Button key="cancel" onClick={closeModal}>
          {t('cancel')}
        </Button>,
        <Button
          key="ok"
          loading={loading}
          style={{ marginInlineStart: '16px' }}
          type="primary"
          onClick={async () => {
            if (!editingProvider || !id || !formInstance) return;
            setLoading(true);
            try {
              await formInstance.validateFields();
              const data = formInstance.getFieldsValue();
              await updateAiModelsConfig(id, editingProvider, data);
              closeModal();
            } catch (error: any) {
              if (!error?.errorFields) {
                message.error(t('providerModels.item.modelConfig.updateError', { ns: 'modelProvider' }));
              }
            } finally {
              setLoading(false);
            }
          }}
        >
          {t('ok')}
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
      <ModelConfigForm
        idEditable={false}
        initialValues={model}
        showDeployName={showDeployName}
        type={model?.type}
        onFormInstanceReady={setFormInstance}
      />
    </Modal>
  );
});
export default ModelConfigModal;
