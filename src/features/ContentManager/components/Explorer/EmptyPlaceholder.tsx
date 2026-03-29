import { Center, FileTypeIcon, Flexbox, Icon, Text } from '@lobehub/ui';
import { Upload } from 'antd';
import { createStaticStyles, cssVar, cx } from 'antd-style';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { RESOURCE_ENTRY_ICONS } from '@/config/contentIcons';
import { buildSourceSetPath } from '@/features/ResourceSpaces';
import { useCreateSourceSetModal } from '@/features/SourceSetModal';
import { useContentManagerStore } from '@/routes/(main)/content/features/store';
import { useFileStore } from '@/store/file';
import { useServerConfigStore } from '@/store/serverConfig';

const ICON_SIZE = 80;

const styles = createStaticStyles(({ css, cssVar }) => ({
  actionTitle: css`
    margin-block-start: 12px;
    font-size: 16px;
    color: ${cssVar.colorText};
  `,
  card: css`
    touch-action: manipulation;
    cursor: pointer;

    position: relative;

    overflow: hidden;

    width: 200px;
    height: 140px;
    padding: 16px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadiusLG};

    font: inherit;
    font-weight: 500;
    color: inherit;
    text-align: center;

    appearance: none;
    background: ${cssVar.colorBgContainer};

    transition:
      transform 0.25s ease,
      border-color 0.25s ease,
      background 0.25s ease,
      box-shadow 0.25s ease;

    &:hover {
      transform: translateY(-2px);
      border-color: color-mix(in srgb, ${cssVar.colorPrimaryBorder} 60%, ${cssVar.colorBorder} 40%);
      background: color-mix(
        in srgb,
        ${cssVar.colorPrimaryBg} 14%,
        ${cssVar.colorFillSecondary} 86%
      );
    }

    &:focus-visible {
      outline: 2px solid ${cssVar.colorPrimary};
      outline-offset: 2px;
      box-shadow: 0 0 0 4px color-mix(in srgb, ${cssVar.colorPrimary} 18%, transparent);
    }
  `,
  cardButton: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;

    border: 0;
  `,
  cardContent: css`
    cursor: pointer;

    position: relative;

    overflow: hidden;

    width: 100%;
    height: 100%;
  `,
  glow: css`
    position: absolute;
    inset-block-end: -12px;
    inset-inline-end: 0;

    width: 48px;
    height: 48px;

    opacity: 0.5;
    filter: blur(24px);
  `,
  icon: css`
    position: absolute;
    z-index: 1;
    inset-block-end: -24px;
    inset-inline-end: 8px;

    flex: none;
  `,
}));

const EmptyPlaceholder = memo(() => {
  const { t } = useTranslation('components');
  const isMobile = useServerConfigStore((s) => s.isMobile);

  const pushDockFileList = useFileStore((s) => s.pushDockFileList);
  const navigate = useNavigate();

  const [sourceSetId, spaceId] = useContentManagerStore((s) => [s.sourceSetId, s.spaceId]);

  const { open } = useCreateSourceSetModal();

  const accentColors = [
    `color-mix(in srgb, ${cssVar.colorPrimary} 92%, ${cssVar.colorBgContainer} 8%)`,
    `color-mix(in srgb, ${cssVar.colorPrimary} 76%, ${cssVar.colorBgContainer} 24%)`,
    `color-mix(in srgb, ${cssVar.colorPrimary} 60%, ${cssVar.colorBgContainer} 40%)`,
  ];

  return (
    <Center gap={24} height={'100%'} style={{ paddingBottom: 100 }} width={'100%'}>
      <Flexbox justify={'center'} style={{ textAlign: 'center' }}>
        <Text as={'h4'}>{t('FileManager.emptyStatus.title')}</Text>
        <Text type={'secondary'}>{t('FileManager.emptyStatus.or')}</Text>
      </Flexbox>
      <Flexbox gap={12} horizontal={!isMobile}>
        {!sourceSetId && (
          <button
            className={cx(styles.card, styles.cardButton)}
            type="button"
            onClick={() => {
              open({
                onSuccess: (id) => navigate(buildSourceSetPath(spaceId, id)),
                spaceId,
              });
            }}
          >
            <Flexbox className={styles.cardContent}>
              <span className={styles.actionTitle}>
                {t('FileManager.emptyStatus.actions.sourceSet')}
              </span>
              <div className={styles.glow} style={{ background: accentColors[0] }} />
              <FileTypeIcon
                aria-hidden
                className={styles.icon}
                color={accentColors[0]}
                icon={<Icon color={cssVar.colorTextLightSolid} icon={RESOURCE_ENTRY_ICONS.plus} />}
                size={ICON_SIZE}
                type={'folder'}
              />
            </Flexbox>
          </button>
        )}
        <Upload
          multiple={true}
          showUploadList={false}
          beforeUpload={async (file) => {
            await pushDockFileList([file], sourceSetId, undefined, spaceId);

            return false;
          }}
        >
          <button className={cx(styles.card, styles.cardButton)} type="button">
            <Flexbox className={styles.cardContent}>
              <span className={styles.actionTitle}>
                {t('FileManager.emptyStatus.actions.file')}
              </span>
              <div className={styles.glow} style={{ background: accentColors[1] }} />
              <FileTypeIcon
                aria-hidden
                className={styles.icon}
                color={accentColors[1]}
                size={ICON_SIZE}
                icon={
                  <Icon
                    color={cssVar.colorTextLightSolid}
                    icon={RESOURCE_ENTRY_ICONS.uploadArrow}
                  />
                }
              />
            </Flexbox>
          </button>
        </Upload>
        <Upload
          directory
          multiple={true}
          showUploadList={false}
          beforeUpload={async (file) => {
            await pushDockFileList([file], sourceSetId, undefined, spaceId);

            return false;
          }}
        >
          <button className={cx(styles.card, styles.cardButton)} type="button">
            <Flexbox className={styles.cardContent}>
              <span className={styles.actionTitle}>
                {t('FileManager.emptyStatus.actions.folder')}
              </span>
              <div className={styles.glow} style={{ background: accentColors[2] }} />
              <FileTypeIcon
                aria-hidden
                className={styles.icon}
                color={accentColors[2]}
                size={ICON_SIZE}
                type={'folder'}
                icon={
                  <Icon
                    color={cssVar.colorTextLightSolid}
                    icon={RESOURCE_ENTRY_ICONS.uploadArrow}
                  />
                }
              />
            </Flexbox>
          </button>
        </Upload>
      </Flexbox>
    </Center>
  );
});

EmptyPlaceholder.displayName = 'EmptyPlaceholder';

export default EmptyPlaceholder;
