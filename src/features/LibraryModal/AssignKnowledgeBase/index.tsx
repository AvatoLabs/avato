import { Flexbox, Modal, Text } from '@lobehub/ui';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { useServerConfigStore } from '@/store/serverConfig';

import List from './List';
import { type LibraryModalScope } from './types';

interface AttachKnowledgeModalProps {
  open?: boolean;
  scope?: LibraryModalScope;
  setOpen: (open: boolean) => void;
}

export const AttachKnowledgeModal = memo<AttachKnowledgeModalProps>(
  ({ setOpen, open, scope = 'agent' }) => {
    const { t } = useTranslation('chat');
    const mobile = useServerConfigStore((s) => s.isMobile);
    const subtitle = t(
      scope === 'conversation' ? 'conversationFiles.library.scope' : 'knowledgeBase.library.scope',
    );

    return (
      <Modal
        allowFullscreen
        footer={null}
        open={open}
        styles={{ body: { overflow: 'hidden', padding: 0 } }}
        width={'min(88vw, 980px)'}
        title={
          <Flexbox gap={2}>
            <Text strong>{t('knowledgeBase.library.title')}</Text>
            <Text type={'secondary'}>{subtitle}</Text>
          </Flexbox>
        }
        onCancel={() => {
          setOpen(false);
        }}
      >
        <Flexbox
          gap={mobile ? 8 : 16}
          style={{ maxHeight: mobile ? '-webkit-fill-available' : 'inherit' }}
          width={'100%'}
        >
          <List scope={scope} />
        </Flexbox>
      </Modal>
    );
  },
);
