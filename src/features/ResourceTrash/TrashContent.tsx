'use client';

import { getCanonicalContentKind } from '@lobechat/types';
import { Block, Button, Flexbox, Text } from '@lobehub/ui';
import { App } from 'antd';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import FileIcon from '@/components/FileIcon';
import { useSpaceName } from '@/features/ResourceSpaces';
import { contentService } from '@/services/content';
import { revalidateResources } from '@/store/file/slices/content/hooks';
import { sourceSetSelectors, useSourceSetStore } from '@/store/sourceSet';
import { type ContentItem } from '@/types/content';

interface TrashContentProps {
  enabled?: boolean;
  sourceSetId?: string;
  spaceId?: string;
  variant?: 'modal' | 'page';
}

const getCanonicalContentSourceType = (item: Pick<ContentItem, 'id' | 'sourceType'>) =>
  getCanonicalContentKind(item);

const toResourceRef = (item: Pick<ContentItem, 'id' | 'sourceType'>) => ({
  id: item.id,
  sourceType: getCanonicalContentSourceType(item),
});

export const TrashContent = memo<TrashContentProps>(
  ({ enabled = true, sourceSetId, spaceId, variant = 'page' }) => {
    const { t } = useTranslation(['common', 'file']);
    const { message, modal } = App.useApp();
    const spaceName = useSpaceName(spaceId);
    const sourceSetName = useSourceSetStore(
      sourceSetSelectors.getSourceSetNameById(sourceSetId || ''),
    );
    const [items, setItems] = useState<ContentItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [deletingAll, setDeletingAll] = useState(false);
    const [deletingIds, setDeletingIds] = useState<string[]>([]);
    const [restoringAll, setRestoringAll] = useState(false);
    const [restoringIds, setRestoringIds] = useState<string[]>([]);

    const busyIdSet = useMemo(
      () => new Set([...deletingIds, ...restoringIds]),
      [deletingIds, restoringIds],
    );

    const load = useCallback(async () => {
      if (!enabled) return;

      setLoading(true);
      try {
        const response = await contentService.queryContentItems({
          sourceSetId,
          limit: 200,
          offset: 0,
          showFilesInSourceSet: true,
          spaceId,
          trash: true,
        });

        setItems(response.items);
      } catch {
        message.error(t('trash.loadError', { ns: 'file' }));
      } finally {
        setLoading(false);
      }
    }, [enabled, sourceSetId, message, spaceId, t]);

    useEffect(() => {
      void load();
    }, [load]);

    const refreshAfterMutation = async () => {
      await load();
      await revalidateResources();
    };

    const handleRestore = async (item: Pick<ContentItem, 'id' | 'sourceType'>) => {
      setRestoringIds((prev) => [...prev, item.id]);
      try {
        await contentService.restoreContentItem(item);
        message.success(t('trash.restored', { ns: 'file' }));
        await refreshAfterMutation();
      } catch {
        message.error(t('trash.restoreError', { ns: 'file' }));
      } finally {
        setRestoringIds((prev) => prev.filter((id) => id !== item.id));
      }
    };

    const handleRestoreAll = async () => {
      if (items.length === 0) return;

      setRestoringAll(true);
      try {
        await contentService.restoreContentItems(items.map(toResourceRef));
        message.success(t('trash.restoreAllDone', { ns: 'file' }));
        await refreshAfterMutation();
      } catch {
        message.error(t('trash.restoreAllError', { ns: 'file' }));
      } finally {
        setRestoringAll(false);
      }
    };

    const confirmPermanentDelete = (
      resources: Array<Pick<ContentItem, 'id' | 'sourceType'>>,
      options: {
        onFinally?: () => void;
        onStart?: () => void;
        successKey: 'trash.deleteDone' | 'trash.emptyDone';
        errorKey: 'trash.deleteError' | 'trash.emptyError';
        titleKey: 'trash.deleteConfirmTitle' | 'trash.emptyConfirmTitle';
        contentKey: 'trash.deleteConfirmDescription' | 'trash.emptyConfirmDescription';
      },
    ) => {
      modal.confirm({
        cancelText: t('cancel', { ns: 'common' }),
        content: t(options.contentKey, { ns: 'file' }),
        okButtonProps: { danger: true },
        okText: t('trash.deletePermanent', { ns: 'file' }),
        title: t(options.titleKey, { ns: 'file' }),
        onOk: async () => {
          options.onStart?.();
          try {
            await contentService.deleteContentItems(
              resources.map((item) => item.id),
              false,
            );
            message.success(t(options.successKey, { ns: 'file' }));
            await refreshAfterMutation();
          } catch {
            message.error(t(options.errorKey, { ns: 'file' }));
          } finally {
            options.onFinally?.();
          }
        },
      });
    };

    const handleDelete = (item: Pick<ContentItem, 'id' | 'sourceType'>) => {
      confirmPermanentDelete([item], {
        errorKey: 'trash.deleteError',
        onFinally: () => setDeletingIds((prev) => prev.filter((id) => id !== item.id)),
        onStart: () => setDeletingIds((prev) => [...prev, item.id]),
        successKey: 'trash.deleteDone',
        titleKey: 'trash.deleteConfirmTitle',
        contentKey: 'trash.deleteConfirmDescription',
      });
    };

    const handleDeleteAll = () => {
      if (items.length === 0) return;

      confirmPermanentDelete(items.map(toResourceRef), {
        errorKey: 'trash.emptyError',
        onFinally: () => setDeletingAll(false),
        onStart: () => setDeletingAll(true),
        successKey: 'trash.emptyDone',
        titleKey: 'trash.emptyConfirmTitle',
        contentKey: 'trash.emptyConfirmDescription',
      });
    };

    const surfaceTitle = sourceSetName
      ? `${sourceSetName} / ${t('trash.title', { ns: 'file' })}`
      : spaceName
        ? `${spaceName} / ${t('trash.title', { ns: 'file' })}`
        : `${t('space.quickAccessTitle', { ns: 'file' })} / ${t('trash.title', { ns: 'file' })}`;

    return (
      <Flexbox gap={16} width={'100%'}>
        {variant === 'page' && (
          <Flexbox gap={4}>
            <Text as={'h2'}>{surfaceTitle}</Text>
            <Text type={'secondary'}>
              {t(sourceSetId ? 'trash.hint' : 'trash.hintAll', { ns: 'file' })}
            </Text>
          </Flexbox>
        )}

        {variant === 'modal' && (
          <Text type="secondary">
            {t(sourceSetId ? 'trash.hint' : 'trash.hintAll', { ns: 'file' })}
          </Text>
        )}

        <Flexbox horizontal align="center" gap={8} justify="space-between" wrap={'wrap'}>
          <Text type="secondary">{t('trash.count', { count: items.length, ns: 'file' })}</Text>
          <Flexbox horizontal gap={8}>
            <Button
              disabled={items.length === 0 || deletingAll || restoringAll}
              loading={restoringAll}
              size="small"
              type="default"
              onClick={handleRestoreAll}
            >
              {t('trash.restoreAll', { ns: 'file' })}
            </Button>
            <Button
              danger
              disabled={items.length === 0 || deletingAll || restoringAll}
              loading={deletingAll}
              size="small"
              type="default"
              onClick={handleDeleteAll}
            >
              {t('trash.emptyAction', { ns: 'file' })}
            </Button>
          </Flexbox>
        </Flexbox>

        {loading ? (
          <Text type="secondary">{t('trash.loading', { ns: 'file' })}</Text>
        ) : items.length === 0 ? (
          <Block padding={16} variant={'outlined'}>
            <Text type="secondary">{t('trash.emptyState', { ns: 'file' })}</Text>
          </Block>
        ) : (
          <Flexbox gap={12}>
            {items.map((item) => {
              const label = item.name || item.title || item.id;
              const isFolder = item.fileType === 'custom/folder';
              const busy = deletingAll || restoringAll || busyIdSet.has(item.id);

              return (
                <Block key={item.id} padding={16} variant={'outlined'}>
                  <Flexbox horizontal align="center" gap={12} justify="space-between" wrap={'wrap'}>
                    <Flexbox horizontal align="center" gap={12} style={{ minWidth: 0 }}>
                      <FileIcon fileName={label} isDirectory={isFolder} size={28} />
                      <Flexbox gap={2} style={{ minWidth: 0 }}>
                        <Text ellipsis strong title={label}>
                          {label}
                        </Text>
                        <Text fontSize={12} type="secondary">
                          {t(
                            isFolder
                              ? 'trash.kind.folder'
                              : getCanonicalContentSourceType(item) === 'document'
                                ? 'trash.kind.page'
                                : 'trash.kind.file',
                            { ns: 'file' },
                          )}
                        </Text>
                      </Flexbox>
                    </Flexbox>

                    <Flexbox horizontal gap={8}>
                      <Button
                        disabled={busy}
                        loading={restoringIds.includes(item.id)}
                        size="small"
                        type="primary"
                        onClick={() => void handleRestore(item)}
                      >
                        {t('trash.restore', { ns: 'file' })}
                      </Button>
                      <Button
                        danger
                        disabled={busy}
                        loading={deletingIds.includes(item.id)}
                        size="small"
                        type="default"
                        onClick={() => handleDelete(item)}
                      >
                        {t('trash.deletePermanent', { ns: 'file' })}
                      </Button>
                    </Flexbox>
                  </Flexbox>
                </Block>
              );
            })}
          </Flexbox>
        )}
      </Flexbox>
    );
  },
);

TrashContent.displayName = 'TrashContent';
