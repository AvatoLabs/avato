'use client';

import { Button, Flexbox, Modal, Text } from '@lobehub/ui';
import { App } from 'antd';
import { memo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type DocumentItem } from '@lobechat/database/schemas';

import { documentService } from '@/services/document';
import { revalidateResources } from '@/store/file/slices/resource/hooks';

export const DocumentTrashModal = memo<{
  knowledgeBaseId?: string;
  onClose: () => void;
  open: boolean;
}>(({ knowledgeBaseId, open, onClose }) => {
  const { t } = useTranslation('file');
  const { message } = App.useApp();
  const [items, setItems] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await documentService.queryDocuments({
        current: 0,
        knowledgeBaseId,
        pageSize: 200,
        trash: true,
      });
      setItems(res.items);
    } catch {
      message.error(t('trash.loadError'));
    } finally {
      setLoading(false);
    }
  }, [knowledgeBaseId, message, t]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const handleRestore = async (id: string) => {
    setRestoringId(id);
    try {
      await documentService.restoreDocument(id);
      message.success(t('trash.restored'));
      setItems((prev) => prev.filter((d) => d.id !== id));
      await revalidateResources();
    } catch {
      message.error(t('trash.restoreError'));
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <Modal
      destroyOnClose
      footer={null}
      onCancel={onClose}
      open={open}
      title={t('trash.title')}
      width={480}
    >
      <Text type="secondary">{t(knowledgeBaseId ? 'trash.hint' : 'trash.hintAll')}</Text>
      <Flexbox gap={8} style={{ marginTop: 16, maxHeight: 360, overflowY: 'auto' }}>
        {loading ? (
          <Text type="secondary">{t('trash.loading')}</Text>
        ) : items.length === 0 ? (
          <Text type="secondary">{t('trash.empty')}</Text>
        ) : (
          items.map((doc) => {
            const label = doc.title || doc.filename || doc.id;
            return (
              <Flexbox
                align="center"
                horizontal
                justify="space-between"
                key={doc.id}
                padding={8}
                style={{
                  background: 'var(--lobe-color-fill-quaternary, rgba(0,0,0,0.04))',
                  borderRadius: 8,
                }}
              >
                <Text ellipsis style={{ flex: 1, marginInlineEnd: 8 }} title={label}>
                  {label}
                </Text>
                <Button
                  loading={restoringId === doc.id}
                  onClick={() => handleRestore(doc.id)}
                  size="small"
                  type="primary"
                >
                  {t('trash.restore')}
                </Button>
              </Flexbox>
            );
          })
        )}
      </Flexbox>
    </Modal>
  );
});

DocumentTrashModal.displayName = 'DocumentTrashModal';
