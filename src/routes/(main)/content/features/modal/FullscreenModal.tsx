'use client';

import { Modal } from '@lobehub/ui';
import { ConfigProvider } from 'antd';
import { createStaticStyles, cx } from 'antd-style';
import { type ReactNode } from 'react';
import { useCallback, useState } from 'react';

const styles = createStaticStyles(({ css, cssVar }) => ({
  body: css`
    height: 100%;
    max-height: calc(100dvh - 56px) !important;
  `,
  body_withDetail: css`
    --fullscreen-detail-width: clamp(380px, 34vw, 500px);

    padding-inline-end: calc(var(--fullscreen-detail-width) + 28px) !important;

    @media (max-width: 900px) {
      padding-inline-end: 0 !important;
      padding-block-end: calc(min(58dvh, 600px) + env(safe-area-inset-bottom, 0px)) !important;
    }
  `,
  content: css`
    height: 100%;
    border: none !important;
    background: transparent !important;
  `,
  extra: css`
    position: fixed;
    z-index: ${cssVar.zIndexPopupBase + 10};
    inset-block: 12px;
    inset-inline-end: 12px;

    display: flex;
    flex-direction: column;

    overflow: hidden;

    width: min(var(--fullscreen-detail-width, 420px), calc(100vw - 24px));
    border: 1px solid color-mix(in srgb, ${cssVar.colorBorderSecondary} 92%, transparent);
    border-radius: 24px;

    background:
      linear-gradient(
        180deg,
        color-mix(in srgb, ${cssVar.colorBgContainer} 96%, ${cssVar.colorBgElevated}) 0%,
        color-mix(in srgb, ${cssVar.colorBgContainer} 92%, ${cssVar.colorBgLayout}) 100%
      );
    box-shadow:
      -24px 0 56px -44px color-mix(in srgb, ${cssVar.colorText} 28%, transparent),
      inset 0 1px 0 color-mix(in srgb, white 55%, transparent);
    backdrop-filter: blur(18px);

    @media (max-width: 900px) {
      inset-block: auto 0;
      inset-inline: 0;

      width: 100%;
      max-height: calc(min(58dvh, 600px) + env(safe-area-inset-bottom, 0px));
      padding-block-end: env(safe-area-inset-bottom, 0px);
      border: 1px solid color-mix(in srgb, ${cssVar.colorBorderSecondary} 92%, transparent);
      border-radius: 24px 24px 0 0;
      box-shadow:
        0 -24px 56px -44px color-mix(in srgb, ${cssVar.colorText} 28%, transparent),
        inset 0 1px 0 color-mix(in srgb, white 55%, transparent);
    }
  `,
  extraHandle: css`
    flex-shrink: 0;
    align-self: center;

    width: 44px;
    height: 5px;
    margin-block: 12px 8px;
    border-radius: 999px;

    background: color-mix(in srgb, ${cssVar.colorTextSecondary} 18%, ${cssVar.colorFillSecondary});
    opacity: 0.9;

    @media (min-width: 901px) {
      display: none;
    }
  `,
  extraInner: css`
    flex: 1;
    min-height: 0;
    overflow: auto;
  `,
  extraContent: css`
    min-height: 100%;
    padding: 12px;

    @media (max-width: 900px) {
      padding: 10px 10px 0;
    }
  `,
  header: css`
    background: transparent !important;
  `,
  modal: css`
    position: relative;
    inset-block-start: 0;

    width: 100vw !important;
    max-width: none;
    height: 100%;
    margin: 0;
    padding-block-end: 0;

    > div {
      height: 100%;
    }
  `,
  modal_withDetail: css`
    width: 100vw !important;
  `,
}));

interface FullscreenModalProps {
  children: ReactNode;
  detail?: ReactNode;
  onClose?: () => void;
}

const FullscreenModal = ({ children, detail, onClose }: FullscreenModalProps) => {
  const [open, setOpen] = useState(true);
  const showDetail = !!detail;

  const handleCancel = useCallback(() => {
    setOpen(false);
    onClose?.();
  }, [onClose]);

  return (
    <>
      <ConfigProvider theme={{ token: { motion: false } }}>
        <Modal
          className={cx(styles.modal, showDetail && styles.modal_withDetail)}
          classNames={{
            body: cx(styles.body, showDetail && styles.body_withDetail),
            header: styles.header,
            wrapper: styles.content,
          }}
          footer={false}
          open={open}
          width={'auto'}
          onCancel={handleCancel}
        >
          {children}
        </Modal>
      </ConfigProvider>
      {!!detail && (
        <div
          aria-label={'Detail panel'}
          className={styles.extra}
          data-testid={'fullscreen-modal-detail'}
          role={'complementary'}
        >
          <div className={styles.extraHandle} />
          <div className={styles.extraInner}>
            <div className={styles.extraContent}>{detail}</div>
          </div>
        </div>
      )}
    </>
  );
};
export default FullscreenModal;
