import { Flexbox, Modal, Text } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { useServerConfigStore } from '@/store/serverConfig';

import List from './List';
import { type SourceSetModalScope } from './types';

const styles = createStaticStyles(({ css, cssVar }) => ({
  header: css`
    gap: 2px;
    padding-block: 20px 16px;
    padding-inline: 24px 72px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
  `,
  subtitle: css`
    font-size: 13px;
    color: ${cssVar.colorTextDescription};
  `,
  title: css`
    font-size: 18px;
    font-weight: 600;
    line-height: 1.2;
    color: ${cssVar.colorText};
  `,
}));

interface AttachSourceSetModalProps {
  open?: boolean;
  scope?: SourceSetModalScope;
  setOpen: (open: boolean) => void;
}

export const AttachSourceSetModal = memo<AttachSourceSetModalProps>(
  ({ setOpen, open, scope = 'agent' }) => {
    const { t } = useTranslation('chat');
    const mobile = useServerConfigStore((s) => s.isMobile);
    const subtitle = t(
      scope === 'conversation' ? 'conversationFiles.picker.scope' : 'sourceSet.picker.scope',
    );

    return (
      <Modal
        allowFullscreen
        footer={null}
        open={open}
        title={null}
        width={'min(88vw, 980px)'}
        styles={{
          body: { overflow: 'hidden', padding: 0 },
          header: { display: 'none' },
        }}
        onCancel={() => {
          setOpen(false);
        }}
      >
        <Flexbox
          gap={mobile ? 8 : 16}
          style={{ maxHeight: mobile ? '-webkit-fill-available' : 'inherit' }}
          width={'100%'}
        >
          <Flexbox className={styles.header}>
            <Text className={styles.title}>{t('sourceSet.picker.title')}</Text>
            <Text className={styles.subtitle}>{subtitle}</Text>
          </Flexbox>
          <List scope={scope} />
        </Flexbox>
      </Modal>
    );
  },
);
