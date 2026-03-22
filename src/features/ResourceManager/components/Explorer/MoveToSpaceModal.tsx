import { Button, Flexbox, Icon, Modal } from '@lobehub/ui';
import { App, Tag } from 'antd';
import { GlobeIcon, LockIcon, UserIcon } from 'lucide-react';
import { memo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { lambdaClient } from '@/libs/trpc/client';
import { useResourceManagerStore } from '@/routes/(main)/resource/features/store';
import { useFileStore } from '@/store/file';

interface Space {
  id: string;
  kind: string;
  membershipRole: string;
  name: string;
}

interface MoveToSpaceModalProps {
  fileId: string;
  onClose: () => void;
  open: boolean;
  sourceType?: string;
}

const MoveToSpaceModal = memo<MoveToSpaceModalProps>(({ open, onClose, fileId, sourceType }) => {
  const { t } = useTranslation('components');
  const { message } = App.useApp();

  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);

  const currentSpaceId = useResourceManagerStore((s) => s.spaceId);
  const refreshFileList = useFileStore((s) => s.refreshFileList);

  useEffect(() => {
    if (!open) return;

    const fetchSpaces = async () => {
      setLoading(true);
      try {
        const result = await lambdaClient.space.listSpaces.query();
        // Filter out the current space and spaces where user is only viewer
        const available = result.filter(
          (s) => s.id !== currentSpaceId && s.membershipRole !== 'viewer',
        );
        setSpaces(available);
      } catch {
        setSpaces([]);
        message.error(t('FileManager.actions.moveToSpaceError'));
      } finally {
        setLoading(false);
      }
    };

    fetchSpaces();
    setSelectedSpaceId(null);
  }, [open, currentSpaceId]);

  const handleMove = useCallback(async () => {
    if (!selectedSpaceId) return;

    setMoving(true);
    try {
      const kind = sourceType === 'document' ? 'document' : 'file';
      await lambdaClient.resourceShare.moveResourceToSpace.mutate({
        id: fileId,
        kind: kind as 'document' | 'file',
        targetSpaceId: selectedSpaceId,
      });

      const targetSpace = spaces.find((s) => s.id === selectedSpaceId);
      message.success(
        t('FileManager.actions.moveToSpaceSuccess', { spaceName: targetSpace?.name ?? '' }),
      );
      await refreshFileList();
      onClose();
    } catch {
      message.error(t('FileManager.actions.moveToSpaceError'));
    } finally {
      setMoving(false);
    }
  }, [selectedSpaceId, fileId, sourceType, spaces, message, t, refreshFileList, onClose]);

  const getSpaceIcon = (kind: string) => {
    if (kind === 'personal') return UserIcon;
    if (kind === 'team') return GlobeIcon;
    return LockIcon;
  };

  return (
    <Modal
      open={open}
      title={t('FileManager.actions.moveToSpaceModal.title')}
      footer={
        <Flexbox horizontal gap={8} justify="flex-end">
          <Button onClick={onClose}>{t('cancel', { ns: 'common' })}</Button>
          <Button disabled={!selectedSpaceId} loading={moving} type="primary" onClick={handleMove}>
            {t('FileManager.actions.moveToSpace')}
          </Button>
        </Flexbox>
      }
      onCancel={onClose}
    >
      <Flexbox gap={4} style={{ marginBottom: 8 }}>
        <span style={{ color: 'var(--lobe-color-text-secondary)', fontSize: 13 }}>
          {t('FileManager.actions.moveToSpaceModal.description')}
        </span>
      </Flexbox>
      <Flexbox gap={4} style={{ maxHeight: 320, minHeight: 120, overflowY: 'auto' }}>
        {loading ? (
          <Flexbox align="center" justify="center" style={{ minHeight: 120 }}>
            <span style={{ color: 'var(--lobe-color-text-secondary)' }}>
              {t('loading', { ns: 'common' })}
            </span>
          </Flexbox>
        ) : spaces.length === 0 ? (
          <Flexbox align="center" justify="center" style={{ minHeight: 120 }}>
            <span style={{ color: 'var(--lobe-color-text-secondary)' }}>
              {t('FileManager.actions.moveToSpaceModal.noOtherSpaces')}
            </span>
          </Flexbox>
        ) : (
          spaces.map((space) => (
            <Flexbox
              horizontal
              align="center"
              gap={12}
              key={space.id}
              style={{
                background:
                  selectedSpaceId === space.id ? 'var(--lobe-color-fill-tertiary)' : 'transparent',
                borderRadius: 8,
                cursor: 'pointer',
                padding: '10px 12px',
                transition: 'background 0.2s',
              }}
              onClick={() => setSelectedSpaceId(space.id)}
            >
              <Icon icon={getSpaceIcon(space.kind)} size={18} />
              <Flexbox gap={2} style={{ flex: 1 }}>
                <span style={{ fontWeight: 500 }}>{space.name}</span>
              </Flexbox>
              <Tag bordered={false} style={{ textTransform: 'capitalize' }}>
                {space.membershipRole}
              </Tag>
            </Flexbox>
          ))
        )}
      </Flexbox>
    </Modal>
  );
});

MoveToSpaceModal.displayName = 'MoveToSpaceModal';

export default MoveToSpaceModal;
