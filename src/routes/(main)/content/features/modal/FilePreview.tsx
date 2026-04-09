'use client';

import { Flexbox } from '@lobehub/ui';
import { createStaticStyles, cx } from 'antd-style';
import { memo } from 'react';

import FileViewer from '@/features/FileViewer';
import { fileManagerSelectors, useFileStore } from '@/store/file';
import { formatSize } from '@/utils/format';

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'];
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.ogg'];

const styles = createStaticStyles(({ css, cssVar }) => ({
  page: css`
    position: relative;

    overflow: hidden;

    height: 100%;
    padding: clamp(16px, 2.4vw, 28px);

    background:
      radial-gradient(circle at top left, rgb(82 149 255 / 12%), transparent 34%),
      linear-gradient(180deg, ${cssVar.colorBgLayout} 0%, ${cssVar.colorBgContainer} 100%);
  `,
  pageGlow: css`
    position: absolute;
    inset: auto auto -18% -8%;

    pointer-events: none;

    width: min(42vw, 420px);
    aspect-ratio: 1;
    border-radius: 999px;

    background: color-mix(in srgb, ${cssVar.colorPrimary} 14%, transparent);
    filter: blur(72px);
    opacity: 0.7;
  `,
  shell: css`
    position: relative;
    z-index: 1;

    width: min(100%, 1480px);
    height: 100%;
    margin-inline: auto;
  `,
  stage: css`
    overflow: hidden;

    height: 100%;
    border: 1px solid color-mix(in srgb, ${cssVar.colorBorderSecondary} 88%, transparent);
    border-radius: 24px;

    background: color-mix(in srgb, ${cssVar.colorBgContainer} 92%, ${cssVar.colorBgLayout});
    box-shadow:
      0 24px 60px -36px color-mix(in srgb, ${cssVar.colorText} 24%, transparent),
      inset 0 1px 0 color-mix(in srgb, white 55%, transparent);
    backdrop-filter: blur(18px);
  `,
  stageHeader: css`
    gap: 12px;
    padding: 16px 20px;
    border-bottom: 1px solid ${cssVar.colorBorderSecondary};

    background: linear-gradient(
      180deg,
      color-mix(in srgb, ${cssVar.colorFillQuaternary} 78%, transparent) 0%,
      color-mix(in srgb, ${cssVar.colorBgContainer} 82%, transparent) 100%
    );
  `,
  stageHeaderMeta: css`
    min-width: 0;
  `,
  stageHeaderMetaRow: css`
    flex-wrap: wrap;
    gap: 8px;
  `,
  stageHeaderMetaTag: css`
    flex-shrink: 0;

    padding: 5px 10px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 999px;

    color: ${cssVar.colorTextSecondary};
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;

    background: color-mix(in srgb, ${cssVar.colorFillQuaternary} 74%, transparent);
  `,
  stageHeaderName: css`
    overflow: hidden;

    font-size: 16px;
    font-weight: 600;
    line-height: 1.3;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  stageHeaderSubtitle: css`
    overflow: hidden;

    color: ${cssVar.colorTextSecondary};
    font-size: 12px;
    line-height: 1.4;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  viewerShell: css`
    flex: 1;
    min-height: 0;
    padding: 0;
  `,
  viewerShell_document: css`
    background: ${cssVar.colorBgLayout};
  `,
  viewerShell_visual: css`
    padding: clamp(16px, 2vw, 24px);
    background:
      radial-gradient(circle at top, rgb(255 255 255 / 7%), transparent 32%),
      linear-gradient(180deg, rgb(11 17 28 / 96%) 0%, rgb(15 22 34 / 100%) 100%);
  `,
  viewerFrame: css`
    overflow: hidden;
    height: 100%;
    border-radius: 20px;
  `,
  viewerFrame_document: css`
    background: ${cssVar.colorBgContainer};
  `,
  viewerFrame_visual: css`
    border: 1px solid rgb(255 255 255 / 8%);
    background: rgb(8 13 22 / 88%);
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 5%);
  `,
}));

const getPreviewSurfaceKind = (fileType?: string, fileName?: string) => {
  const lowerFileType = fileType?.toLowerCase();
  const lowerFileName = fileName?.toLowerCase();

  if (lowerFileType === 'pdf' || lowerFileName?.endsWith('.pdf')) return 'visual';

  if (lowerFileType?.startsWith('image/') || lowerFileType?.startsWith('video/')) {
    return 'visual';
  }

  if (lowerFileType && [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS].some((ext) => lowerFileType.includes(ext.slice(1)))) {
    return 'visual';
  }

  if (lowerFileName && [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS].some((ext) => lowerFileName.endsWith(ext))) {
    return 'visual';
  }

  return 'document';
};

const FilePreview = memo<{ id: string }>(({ id }) => {
  const file = useFileStore(fileManagerSelectors.getFileById(id));

  if (!file) return;

  const previewSurface = getPreviewSurfaceKind(file.fileType, file.name);
  const extension = file.name.split('.').pop()?.toUpperCase();
  const subtitle = [extension, formatSize(file.size)].filter(Boolean).join(' · ');
  const surfaceLabel = previewSurface === 'visual' ? 'Visual Surface' : 'Document Surface';

  return (
    <div className={styles.page} data-testid={'modal-file-preview'}>
      <div className={styles.pageGlow} />
      <Flexbox className={styles.shell}>
        <Flexbox className={styles.stage}>
          <Flexbox align={'center'} className={styles.stageHeader} justify={'space-between'}>
            <Flexbox className={styles.stageHeaderMeta} gap={4}>
              <Flexbox align={'center'} className={styles.stageHeaderMetaRow} gap={8}>
                <div className={styles.stageHeaderMetaTag}>Preview</div>
                <div className={styles.stageHeaderMetaTag}>{surfaceLabel}</div>
              </Flexbox>
              <div className={styles.stageHeaderName}>{file.name}</div>
              <div className={styles.stageHeaderSubtitle}>{subtitle}</div>
            </Flexbox>
          </Flexbox>
          <div
            className={cx(
              styles.viewerShell,
              previewSurface === 'visual'
                ? styles.viewerShell_visual
                : styles.viewerShell_document,
            )}
            data-preview-surface={previewSurface}
            data-testid={'modal-file-preview-stage'}
          >
            <div
              className={cx(
                styles.viewerFrame,
                previewSurface === 'visual'
                  ? styles.viewerFrame_visual
                  : styles.viewerFrame_document,
              )}
            >
              <FileViewer {...file} />
            </div>
          </div>
        </Flexbox>
      </Flexbox>
    </div>
  );
});

export default FilePreview;
