'use client';

import { Flexbox, Icon, Text } from '@lobehub/ui';
import { Descriptions, Divider } from 'antd';
import { cssVar } from 'antd-style';
import dayjs from 'dayjs';
import { FileIcon, FolderIcon, HistoryIcon, ShieldCheckIcon, UsersIcon, XIcon } from 'lucide-react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';

import { lambdaClient } from '@/libs/trpc/client';
import { useResourceManagerStore } from '@/routes/(main)/resource/features/store';
import { useFileStore } from '@/store/file';
import { formatSize } from '@/utils/format';

const PANEL_WIDTH = 320;

const ResourceInfoPanel = memo(() => {
  const { t } = useTranslation('components');
  const selectedFileIds = useResourceManagerStore((s) => s.selectedFileIds);
  const setShowInfoPanel = useResourceManagerStore((s) => s.setShowInfoPanel);
  const resourceMap = useFileStore((s) => s.resourceMap);

  const selectedId = selectedFileIds.length === 1 ? selectedFileIds[0] : null;
  const resource = selectedId ? resourceMap?.get(selectedId) : null;

  // Fetch sharing info when a single resource is selected
  const { data: shareInfo } = useSWR(
    selectedId && resource ? ['resource-share-info', selectedId, resource.sourceType] : null,
    async () => {
      if (!selectedId || !resource) return null;
      try {
        return await lambdaClient.resourceShare.getResourceShareInfo.query({
          id: selectedId,
          kind: resource.sourceType === 'document' ? 'document' : 'file',
        });
      } catch {
        return null;
      }
    },
    { revalidateOnFocus: false },
  );

  // Fetch activity when a single resource is selected
  const { data: activityData } = useSWR(
    selectedId && resource ? ['resource-activity', selectedId, resource.sourceType] : null,
    async () => {
      if (!selectedId || !resource) return null;
      try {
        return await lambdaClient.resourceShare.listResourceActivity.query({
          id: selectedId,
          kind: resource.sourceType === 'document' ? 'document' : 'file',
          limit: 20,
        });
      } catch {
        return null;
      }
    },
    { revalidateOnFocus: false },
  );

  const isFolder = resource?.fileType === 'custom/folder';
  const isDocument = resource?.sourceType === 'document';

  const detailItems = useMemo(() => {
    if (!resource) return [];
    return [
      { children: resource.name, key: 'name', label: t('FileManager.infoPanel.fileName') },
      {
        children: isFolder
          ? 'Folder'
          : isDocument
            ? 'Document'
            : (resource.name.split('.').pop()?.toUpperCase() ?? '—'),
        key: 'type',
        label: t('FileManager.infoPanel.fileType'),
      },
      ...(!isFolder
        ? [
            {
              children: formatSize(resource.size),
              key: 'size',
              label: t('FileManager.infoPanel.fileSize'),
            },
          ]
        : []),
      {
        children: dayjs(resource.createdAt).format('YYYY-MM-DD HH:mm'),
        key: 'createdAt',
        label: t('FileManager.infoPanel.createdAt'),
      },
      {
        children: dayjs(resource.updatedAt).format('YYYY-MM-DD HH:mm'),
        key: 'updatedAt',
        label: t('FileManager.infoPanel.updatedAt'),
      },
    ];
  }, [resource, isFolder, isDocument, t]);

  const accessVia = shareInfo?.access?.matchedBy;
  const permissionCount = shareInfo?.permissions?.length ?? 0;

  return (
    <Flexbox
      gap={0}
      style={{
        borderLeft: `1px solid ${cssVar.colorBorderSecondary}`,
        height: '100%',
        overflow: 'auto',
        width: PANEL_WIDTH,
      }}
    >
      {/* Header */}
      <Flexbox
        horizontal
        align={'center'}
        justify={'space-between'}
        paddingBlock={8}
        paddingInline={16}
        style={{ borderBottom: `1px solid ${cssVar.colorBorderSecondary}`, minHeight: 48 }}
      >
        <Text strong>{t('FileManager.infoPanel.title')}</Text>
        <Icon icon={XIcon} style={{ cursor: 'pointer' }} onClick={() => setShowInfoPanel(false)} />
      </Flexbox>

      {!resource ? (
        <Flexbox align={'center'} height={200} justify={'center'} padding={16}>
          <Text type={'secondary'}>{t('FileManager.infoPanel.noSelection')}</Text>
        </Flexbox>
      ) : (
        <Flexbox gap={0} padding={16}>
          {/* Icon + Name */}
          <Flexbox horizontal align={'center'} gap={12} style={{ marginBottom: 16 }}>
            <Icon icon={isFolder ? FolderIcon : FileIcon} size={32} />
            <Text ellipsis strong style={{ flex: 1 }}>
              {resource.name}
            </Text>
          </Flexbox>

          {/* Details section */}
          <Text strong style={{ marginBottom: 8 }}>
            {t('FileManager.infoPanel.details')}
          </Text>
          <Descriptions
            colon={false}
            column={1}
            items={detailItems}
            labelStyle={{ width: 80 }}
            size={'small'}
          />

          <Divider style={{ margin: '12px 0' }} />

          {/* Sharing section */}
          <Flexbox horizontal align={'center'} gap={8} style={{ marginBottom: 8 }}>
            <Icon icon={UsersIcon} size={16} />
            <Text strong>{t('FileManager.infoPanel.sharing')}</Text>
          </Flexbox>

          {permissionCount > 0 ? (
            <Text type={'secondary'}>
              {t('FileManager.infoPanel.sharedWith', { count: permissionCount })}
            </Text>
          ) : (
            <Text type={'secondary'}>{t('FileManager.infoPanel.noShares')}</Text>
          )}

          {accessVia && (
            <Flexbox horizontal align={'center'} gap={8} style={{ marginTop: 8 }}>
              <Icon icon={ShieldCheckIcon} size={14} />
              <Text fontSize={12} type={'secondary'}>
                {t('FileManager.infoPanel.accessedVia')}:{' '}
                {t(`FileManager.infoPanel.accessedVia.${accessVia}` as any)}
              </Text>
            </Flexbox>
          )}

          <Divider style={{ margin: '12px 0' }} />

          {/* Activity section */}
          <Flexbox horizontal align={'center'} gap={8} style={{ marginBottom: 8 }}>
            <Icon icon={HistoryIcon} size={16} />
            <Text strong>{t('FileManager.infoPanel.activity')}</Text>
          </Flexbox>

          {activityData && activityData.length > 0 ? (
            <Flexbox gap={8}>
              {activityData.map((item) => {
                const actionKey = `FileManager.infoPanel.activity.action.${item.action}` as any;
                const label = t(actionKey, { defaultValue: item.action });
                return (
                  <Flexbox gap={2} key={item.id}>
                    <Text ellipsis fontSize={13}>
                      <Text strong>{item.actorName}</Text> {label}
                    </Text>
                    <Text fontSize={11} type={'secondary'}>
                      {dayjs(item.createdAt).format('YYYY-MM-DD HH:mm')}
                    </Text>
                  </Flexbox>
                );
              })}
            </Flexbox>
          ) : (
            <Text type={'secondary'}>{t('FileManager.infoPanel.activity.empty')}</Text>
          )}
        </Flexbox>
      )}
    </Flexbox>
  );
});

ResourceInfoPanel.displayName = 'ResourceInfoPanel';

export default ResourceInfoPanel;
