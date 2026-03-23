'use client';

import { ActionIcon, Flexbox, ScrollShadow, Text } from '@lobehub/ui';
import { Drawer } from 'antd';
import { createStaticStyles, cssVar } from 'antd-style';
import { FolderTreeIcon, XIcon } from 'lucide-react';
import { memo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

import LibraryHierarchy from '@/features/ResourceManager/components/LibraryHierarchy';

const bodyStyles = createStaticStyles(({ css }) => ({
  wrapper: css`
    overflow: hidden;
    height: 100%;
  `,
}));

interface LibraryFolderDrawerProps {
  onOpenChange?: (open: boolean) => void;
  open: boolean;
  trigger?: React.ReactNode;
}

const LibraryFolderDrawer = memo<LibraryFolderDrawerProps>(({ open, onOpenChange, trigger }) => {
  const { t } = useTranslation('file');
  const location = useLocation();
  const pathWhenOpenedRef = useRef(location.pathname);

  useEffect(() => {
    if (open) {
      pathWhenOpenedRef.current = location.pathname;
    }
  }, [open]);

  useEffect(() => {
    if (open && location.pathname !== pathWhenOpenedRef.current) {
      pathWhenOpenedRef.current = location.pathname;
      onOpenChange?.(false);
    }
  }, [open, location.pathname, onOpenChange]);

  return (
    <>
      {trigger}
      <Drawer
        mask
        closeIcon={null}
        open={open}
        placement="left"
        width="min(320px, 85vw)"
        extra={
          <ActionIcon
            icon={XIcon}
            size="small"
            title={t('common.close', { defaultValue: 'Close' })}
            onClick={() => onOpenChange?.(false)}
          />
        }
        styles={{
          body: { padding: 0 },
          header: { borderBottom: `1px solid ${cssVar.colorBorderSecondary}` },
        }}
        title={
          <Flexbox align="center" gap={8}>
            <FolderTreeIcon size={18} />
            <Text weight={500}>{t('library.title')}</Text>
          </Flexbox>
        }
        onClose={() => onOpenChange?.(false)}
      >
        <ScrollShadow className={bodyStyles.wrapper} size={2} style={{ height: '100%' }}>
          <Flexbox padding={12}>
            <LibraryHierarchy />
          </Flexbox>
        </ScrollShadow>
      </Drawer>
    </>
  );
});

LibraryFolderDrawer.displayName = 'LibraryFolderDrawer';

export default LibraryFolderDrawer;
