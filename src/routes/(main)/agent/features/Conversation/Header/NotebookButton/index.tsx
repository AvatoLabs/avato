'use client';

import { DESKTOP_HEADER_ICON_SIZE } from '@lobechat/const';
import { ActionIcon } from '@lobehub/ui';
import { FilePenIcon } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { useChatStore } from '@/store/chat';
import { chatPortalSelectors } from '@/store/chat/selectors';

const NotebookButton = memo(() => {
  const { t } = useTranslation('portal');
  const [showNotebook, toggleNotebook] = useChatStore((s) => [
    chatPortalSelectors.showNotebook(s),
    s.toggleNotebook,
  ]);

  return (
    <ActionIcon
      active={showNotebook}
      icon={FilePenIcon}
      size={DESKTOP_HEADER_ICON_SIZE}
      title={t('notebook.title')}
      onClick={() => toggleNotebook()}
    />
  );
});

export default NotebookButton;
