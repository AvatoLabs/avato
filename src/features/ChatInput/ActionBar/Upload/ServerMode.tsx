import { validateVideoFileSize } from '@lobechat/utils/client';
import { type ItemType } from '@lobehub/ui';
import { Icon, Tooltip } from '@lobehub/ui';
import { ArrowRight, FileUp, FolderUp, ImageUp, LibraryBig } from 'lucide-react';
import {
  memo,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type RefObject,
} from 'react';
import { useTranslation } from 'react-i18next';

import { message } from '@/components/AntdStaticMethods';
import FileIcon from '@/components/FileIcon';
import TipGuide from '@/components/TipGuide';
import { CHAT_INPUT_ACTION_ICONS } from '@/config/entryIcons';
import { AttachKnowledgeModal } from '@/features/LibraryModal';
import { useModelSupportVision } from '@/hooks/useModelSupportVision';
import { agentByIdSelectors } from '@/store/agent/selectors';
import { useAgentStore } from '@/store/agent/store';
import { useChatStore } from '@/store/chat';
import { useFileStore } from '@/store/file';
import { useSessionStore } from '@/store/session/store';
import { useUserStore } from '@/store/user';
import { preferenceSelectors } from '@/store/user/selectors';

import { useAgentId } from '../../hooks/useAgentId';
import Action from '../components/Action';
import { type ActionDropdownMenuItems } from '../components/ActionDropdown';
import CheckboxItem from '../components/CheckboxWithLoading';

const FileUpload = memo(() => {
  const { t } = useTranslation('chat');

  const upload = useFileStore((s) => s.uploadChatFiles);

  const agentId = useAgentId();
  const activeGroupId = useChatStore((s) => s.activeGroupId);
  const model = useAgentStore((s) => agentByIdSelectors.getAgentModelById(agentId)(s));
  const provider = useAgentStore((s) => agentByIdSelectors.getAgentModelProviderById(agentId)(s));

  const canUploadImage = useModelSupportVision(model, provider);
  const conversationFileContext = activeGroupId ? { groupId: activeGroupId } : { agentId };
  const libraryScope = 'conversation';

  const [showTip, updateGuideState] = useUserStore((s) => [
    preferenceSelectors.showUploadFileInKnowledgeBaseTip(s),
    s.updateGuideState,
  ]);
  const [modalOpen, setModalOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const useFetchConversationFiles = useSessionStore((s) => s.useFetchConversationFiles);
  const toggleConversationFile = useSessionStore((s) => s.toggleConversationFile);
  const { data: conversationFiles = [] } = useFetchConversationFiles(conversationFileContext);

  useEffect(() => {
    const folderInput = folderInputRef.current;

    if (!folderInput) return;

    folderInput.setAttribute('directory', '');
    folderInput.setAttribute('webkitdirectory', '');
  }, []);

  const uploadSelectedFiles = useCallback(
    async (selectedFiles: FileList | null, options?: { imagesOnly?: boolean }) => {
      if (!selectedFiles?.length) return;

      const files = Array.from(selectedFiles);
      const acceptedFiles: File[] = [];

      for (const file of files) {
        if (options?.imagesOnly) {
          acceptedFiles.push(file);
          continue;
        }

        if (!canUploadImage && (file.type.startsWith('image') || file.type.startsWith('video')))
          continue;

        const validation = validateVideoFileSize(file);
        if (!validation.isValid) {
          message.error(
            t('upload.validation.videoSizeExceeded', {
              actualSize: validation.actualSize,
            }),
          );
          continue;
        }

        acceptedFiles.push(file);
      }

      if (acceptedFiles.length === 0) return;

      setDropdownOpen(false);
      await upload(acceptedFiles);
    },
    [canUploadImage, t, upload],
  );

  const createInputChangeHandler = useCallback(
    (options?: { imagesOnly?: boolean }) =>
      async (event: ChangeEvent<HTMLInputElement>) => {
        await uploadSelectedFiles(event.target.files, options);
        event.target.value = '';
      },
    [uploadSelectedFiles],
  );

  const openFileDialog = useCallback((ref: RefObject<HTMLInputElement>) => {
    ref.current?.click();
  }, []);

  const uploadItems: ActionDropdownMenuItems = [
    {
      closeOnClick: false,
      disabled: !canUploadImage,
      icon: ImageUp,
      key: 'upload-image',
      label: canUploadImage ? (
        <div>
          <input
            hidden
            multiple
            accept={'image/*'}
            ref={imageInputRef}
            type={'file'}
            onChange={createInputChangeHandler({ imagesOnly: true })}
          />
          <div>{t('upload.action.imageUpload')}</div>
        </div>
      ) : (
        <Tooltip placement={'right'} title={t('upload.action.imageDisabled')}>
          <div>{t('upload.action.imageUpload')}</div>
        </Tooltip>
      ),
      onClick: canUploadImage ? () => openFileDialog(imageInputRef) : undefined,
    },
    {
      closeOnClick: false,
      icon: FileUp,
      key: 'upload-file',
      label: (
        <div>
          <input hidden multiple ref={fileInputRef} type={'file'} onChange={createInputChangeHandler()} />
          <div>{t('upload.action.fileUpload')}</div>
        </div>
      ),
      onClick: () => openFileDialog(fileInputRef),
    },
    {
      closeOnClick: false,
      icon: FolderUp,
      key: 'upload-folder',
      label: (
        <div>
          <input hidden multiple ref={folderInputRef} type={'file'} onChange={createInputChangeHandler()} />
          <div>{t('upload.action.folderUpload')}</div>
        </div>
      ),
      onClick: () => openFileDialog(folderInputRef),
    },
  ];

  const knowledgeItems: ItemType[] = [];

  if (conversationFiles.length > 0) {
    knowledgeItems.push({
      children: conversationFiles.map((item) => ({
        icon: <FileIcon fileName={item.name} fileType={item.fileType} size={20} />,
        key: item.id,
        label: (
          <CheckboxItem
            checked={item.enabled}
            id={item.id}
            label={item.name}
            onUpdate={async (id, enabled) => {
              setUpdating(true);
              await toggleConversationFile(id, enabled, conversationFileContext);
              setUpdating(false);
            }}
          />
        ),
      })),
      key: 'conversationFiles',
      label: t('conversationFiles.relatedFiles'),
      type: 'group',
    });
  }

  // Always add the "View More" option
  knowledgeItems.push(
    {
      type: 'divider',
    },
    {
      extra: <Icon icon={ArrowRight} />,
      icon: LibraryBig,
      key: 'knowledge-base-store',
      label: t('conversationFiles.viewMore'),
      onClick: () => {
        setModalOpen(true);
      },
    },
  );

  const items: ActionDropdownMenuItems = [
    ...uploadItems,
    ...(knowledgeItems.length > 0 ? knowledgeItems : []),
  ];

  const content = (
    <Action
      icon={CHAT_INPUT_ACTION_ICONS.paperclip}
      loading={updating}
      open={dropdownOpen}
      showTooltip={false}
      title={t('upload.action.tooltip')}
      trigger={'both'}
      dropdown={{
        maxHeight: 500,
        maxWidth: 480,
        menu: { items },
        minWidth: 240,
      }}
      onOpenChange={setDropdownOpen}
    />
  );

  return (
    <Suspense
      fallback={
        <Action
          disabled
          icon={CHAT_INPUT_ACTION_ICONS.paperclip}
          title={t('upload.action.tooltip')}
        />
      }
    >
      {showTip ? (
        <TipGuide
          open={showTip}
          placement={'top'}
          title={t('knowledgeBase.uploadGuide')}
          onOpenChange={() => {
            updateGuideState({ uploadFileInKnowledgeBase: false });
          }}
        >
          {content}
        </TipGuide>
      ) : (
        content
      )}
      <AttachKnowledgeModal open={modalOpen} scope={libraryScope} setOpen={setModalOpen} />
    </Suspense>
  );
});

export default FileUpload;
