'use client';

import { Flexbox, Icon, Segmented, type SegmentedProps } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { RESOURCE_ENTRY_ICONS } from '@/config/contentIcons';
import { buildContentRootPath } from '@/features/ResourceSpaces';
import { useContentManagerStore } from '@/routes/(main)/content/features/store';
import { useServerConfigStore } from '@/store/serverConfig';
import { FilesTabs } from '@/types/files';

const styles = createStaticStyles(({ css, cssVar }) => ({
  containerMobile: css`
    scrollbar-width: none;
    overflow-x: auto;
    width: 100%;

    &::-webkit-scrollbar {
      display: none;
    }
  `,
  option: css`
    display: inline-flex;
    gap: 6px;
    align-items: center;

    font-size: 12px;
    font-weight: 500;
    line-height: 1;
    white-space: nowrap;
  `,
  segmented: css`
    flex-shrink: 0;

    padding: 2px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 999px;

    background: color-mix(in srgb, ${cssVar.colorFillTertiary} 72%, ${cssVar.colorBgContainer} 28%);
    box-shadow:
      inset 0 1px 0 color-mix(in srgb, ${cssVar.colorTextLightSolid} 8%, transparent),
      0 1px 2px color-mix(in srgb, ${cssVar.colorText} 6%, transparent);

    :global(.ant-segmented-group) {
      gap: 2px;
    }

    :global(.ant-segmented-item) {
      color: ${cssVar.colorTextSecondary};
      transition: color ${cssVar.motionDurationMid};
    }

    :global(.ant-segmented-item-selected) {
      color: ${cssVar.colorText};
    }

    :global(.ant-segmented-item-label) {
      min-height: 28px;
      padding-block: 0;
      padding-inline: 10px;
    }

    :global(.ant-segmented-thumb) {
      border: 1px solid ${cssVar.colorBorderSecondary};
      border-radius: 999px;
      background: ${cssVar.colorBgContainer};
      box-shadow: 0 10px 24px color-mix(in srgb, ${cssVar.colorText} 10%, transparent);
    }
  `,
  segmentedMobile: css`
    width: max-content;
    min-width: 100%;
  `,
}));

const CategoryMenu = memo(() => {
  const { t } = useTranslation('file');
  const { spaceId } = useParams<{ spaceId?: string }>();
  const [searchParams] = useSearchParams();
  const [activeKey, setMode] = useContentManagerStore((s) => [s.category, s.setMode]);
  const isMobile = useServerConfigStore((s) => s.isMobile);
  const navigate = useNavigate();
  const basePath = buildContentRootPath(spaceId);

  const items = useMemo<SegmentedProps['options']>(
    () => [
      {
        key: FilesTabs.Home,
        label: (
          <span className={styles.option}>
            <Icon icon={RESOURCE_ENTRY_ICONS.all} size={14} />
            {t('tab.all', { defaultValue: 'All' })}
          </span>
        ),
        value: FilesTabs.Home,
      },
      {
        key: FilesTabs.Documents,
        label: (
          <span className={styles.option}>
            <Icon icon={RESOURCE_ENTRY_ICONS.documents} size={14} />
            {t('tab.docs', { defaultValue: 'Docs' })}
          </span>
        ),
        value: FilesTabs.Documents,
      },
      {
        key: FilesTabs.Images,
        label: (
          <span className={styles.option}>
            <Icon icon={RESOURCE_ENTRY_ICONS.images} size={14} />
            {t('tab.images')}
          </span>
        ),
        value: FilesTabs.Images,
      },
      {
        key: FilesTabs.Audios,
        label: (
          <span className={styles.option}>
            <Icon icon={RESOURCE_ENTRY_ICONS.audios} size={14} />
            {t('tab.audios')}
          </span>
        ),
        value: FilesTabs.Audios,
      },
      {
        key: FilesTabs.Videos,
        label: (
          <span className={styles.option}>
            <Icon icon={RESOURCE_ENTRY_ICONS.videos} size={14} />
            {t('tab.videos')}
          </span>
        ),
        value: FilesTabs.Videos,
      },
    ],
    [t],
  );

  const getCategoryUrl = (value: FilesTabs) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('file');
    nextParams.delete('files');

    if (value === FilesTabs.Home) {
      nextParams.delete('category');
    } else {
      nextParams.set('category', value);
    }

    const queryString = nextParams.toString();

    return queryString ? `${basePath}?${queryString}` : basePath;
  };

  return (
    <Flexbox className={isMobile ? styles.containerMobile : undefined}>
      <Segmented
        className={`${styles.segmented}${isMobile ? ` ${styles.segmentedMobile}` : ''}`}
        options={items}
        size={'small'}
        value={activeKey}
        onChange={(value) => {
          setMode('explorer');
          navigate(getCategoryUrl(value as FilesTabs), { replace: true });
        }}
      />
    </Flexbox>
  );
});

CategoryMenu.displayName = 'CategoryMenu';

export default CategoryMenu;
