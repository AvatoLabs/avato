'use client';

import { Block, Center, Flexbox, Image, Tag, Text } from '@lobehub/ui';
import { cssVar } from 'antd-style';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import FileIcon from '@/components/FileIcon';
import { buildFileAssetBadges } from '@/features/ContentManager/utils/buildFileAssetBadges';
import { buildFileGovernanceActivity } from '@/features/ContentManager/utils/buildFileGovernanceActivity';
import Time from '@/routes/(main)/home/features/components/Time';
import { RECENT_BLOCK_SIZE } from '@/routes/(main)/home/features/const';
import { sourceSetSelectors, useSourceSetStore } from '@/store/sourceSet';
import { type FileListItem } from '@/types/files';
import { formatSize } from '@/utils/format';

const IMAGE_FILE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
]);

interface RecentResourceItemProps {
  file: FileListItem;
}

const RecentResourceItem = memo<RecentResourceItemProps>(({ file }) => {
  const { t } = useTranslation('file');
  const getSourceSetNameById = useCallback(
    (id: string) => sourceSetSelectors.getSourceSetNameById(id)(useSourceSetStore.getState()),
    [],
  );
  const isImage = IMAGE_FILE_TYPES.has(file.fileType);
  const assetBadges = buildFileAssetBadges({
    assetClassification: file.assetClassification,
    compact: true,
    maxVisible: 3,
    assetPrimaryRenditionKind: file.assetPrimaryRenditionKind,
    assetPrimaryRenditionLabel: file.assetPrimaryRenditionLabel,
    assetReviewStatus: file.assetReviewStatus,
    assetRenditionCount: file.assetRenditionCount,
    assetUsagePolicy: file.assetUsagePolicy,
    assetVersionLabel: file.assetVersionLabel,
    getSourceSetNameById,
    sourceSetIds: file.sourceSetIds,
    t,
  });
  const governanceActivity = buildFileGovernanceActivity({
    action: file.assetLatestGovernanceAuditAction,
    actorDisplayName: file.assetLatestGovernanceAuditActorDisplayName,
    after: file.assetLatestGovernanceAuditAfter,
    before: file.assetLatestGovernanceAuditBefore,
    changedFields: file.assetLatestGovernanceAuditChangedFields,
    createdAt: file.assetLatestGovernanceAuditAt,
    t,
  });

  return (
    <Block
      clickable
      flex={'none'}
      height={RECENT_BLOCK_SIZE.RESOURCE.HEIGHT}
      variant={'outlined'}
      width={RECENT_BLOCK_SIZE.RESOURCE.WIDTH}
      style={{
        borderRadius: cssVar.borderRadiusLG,
        overflow: 'hidden',
        transition: `transform ${cssVar.motionDurationMid}, box-shadow ${cssVar.motionDurationMid}`,
      }}
    >
      <Center
        flex={'none'}
        height={148}
        style={{ background: cssVar.colorFillTertiary, overflow: 'hidden' }}
      >
        {isImage && file.url ? (
          <Image
            alt={file.name}
            height={'100%'}
            objectFit={'cover'}
            preview={false}
            src={file.url}
            width={'100%'}
            style={{
              borderRadius: 0,
              width: '100%',
            }}
          />
        ) : (
          <FileIcon fileName={file.name} fileType={file.fileType} size={48} />
        )}
      </Center>

      {/* File Info */}
      <Flexbox flex={1} gap={8} justify={'space-between'} padding={12}>
        <Text
          ellipsis={{ rows: 2 }}
          fontSize={13}
          style={{ lineHeight: 1.45, minHeight: 38, minWidth: 0 }}
          title={file.name}
          weight={500}
        >
          {file.name}
        </Text>
        {assetBadges.length > 0 && (
          <Flexbox horizontal gap={4} wrap={'wrap'}>
            {assetBadges.map((badge) => (
              <Tag
                color={badge.color}
                key={badge.key}
                size={'small'}
                title={badge.title}
                variant={badge.variant}
              >
                {badge.label}
              </Tag>
            ))}
          </Flexbox>
        )}
        {governanceActivity && (
          <Text ellipsis fontSize={12} title={governanceActivity.title} type={'secondary'}>
            {governanceActivity.label}
          </Text>
        )}
        <Flexbox horizontal align={'center'} gap={8} style={{ minHeight: 18 }}>
          <Time date={file.updatedAt} />
          <Text ellipsis fontSize={12} type={'secondary'}>
            {formatSize(file.size)}
          </Text>
        </Flexbox>
      </Flexbox>
    </Block>
  );
});

export default RecentResourceItem;
