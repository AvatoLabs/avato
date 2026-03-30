'use client';

import { ActionIcon, Button, Flexbox } from '@lobehub/ui';
import { Modal } from 'antd';
import { cssVar, useTheme } from 'antd-style';
import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { RESOURCE_ENTRY_ICONS } from '@/config/contentIcons';
import NavHeader from '@/features/NavHeader';
import { DocsAgentProvider } from '@/features/PageEditor/DocsAgentProvider';
import {
  createStore as createPageEditorStore,
  Provider as PageEditorStoreProvider,
} from '@/features/PageEditor/store';
import FileDetailComponent from '@/routes/(main)/content/features/FileDetail';
import { useContentManagerStore } from '@/routes/(main)/content/features/store';
import { fileManagerSelectors, useFileStore } from '@/store/file';
import { downloadFile } from '@/utils/client/downloadFile';

import { useOpenFileDocument } from '../../hooks/useOpenFileDocument';
import { isMarkdownContentFile } from '../../utils/isMarkdownContentFile';
import FileContent from './FileContent';

interface FileEditorProps {
  onBack?: () => void;
}

const FileEditorCanvas = memo<FileEditorProps>(({ onBack }) => {
  const { t } = useTranslation(['common', 'file']);
  const theme = useTheme();
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isConverting, setIsConverting] = useState(false);

  const currentViewItemId = useContentManagerStore((s) => s.currentViewItemId);
  const useFetchKnowledgeItem = useFileStore((s) => s.useFetchKnowledgeItem);

  const fileDetail = useFileStore(fileManagerSelectors.getFileById(currentViewItemId));
  const { data: fetchedFileDetail } = useFetchKnowledgeItem(currentViewItemId);
  const resolvedFileDetail = fileDetail || fetchedFileDetail;
  const openFileDocument = useOpenFileDocument({
    fileId: resolvedFileDetail?.fileId,
    id: currentViewItemId || '',
  });

  const isMarkdown = isMarkdownContentFile(resolvedFileDetail?.name, resolvedFileDetail?.fileType);

  const handleEditAsDoc = useCallback(async () => {
    if (!currentViewItemId || isConverting) return;
    try {
      setIsConverting(true);
      await openFileDocument();
    } catch (error) {
      console.error('Failed to convert markdown to doc:', error);
    } finally {
      setIsConverting(false);
    }
  }, [currentViewItemId, isConverting, openFileDocument]);

  return (
    <>
      <Flexbox horizontal height={'100%'} width={'100%'}>
        <Flexbox flex={1} height={'100%'}>
          <NavHeader
            left={
              <Flexbox
                horizontal
                align={'center'}
                gap={12}
                style={{ minHeight: 32, minWidth: 0, overflow: 'hidden' }}
              >
                <ActionIcon icon={RESOURCE_ENTRY_ICONS.back} title={t('back')} onClick={onBack} />
                <span
                  title={resolvedFileDetail?.name}
                  style={{
                    color: theme.colorText,
                    fontSize: 14,
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {resolvedFileDetail?.name}
                </span>
              </Flexbox>
            }
            right={
              <Flexbox horizontal gap={8}>
                {/* <ToggleRightPanelButton icon={BotMessageSquareIcon} showActive={true} size={20} /> */}
                {isMarkdown && (
                  <Button
                    icon={RESOURCE_ENTRY_ICONS.edit}
                    loading={isConverting}
                    size={'small'}
                    title={t('preview.editAsDocument', { ns: 'file' })}
                    type={'primary'}
                    onClick={handleEditAsDoc}
                  >
                    {t('preview.editAsDocument', { ns: 'file' })}
                  </Button>
                )}
                {resolvedFileDetail?.url && (
                  <ActionIcon
                    icon={RESOURCE_ENTRY_ICONS.download}
                    title={t('download', { ns: 'common' })}
                    onClick={() => {
                      if (resolvedFileDetail?.url && resolvedFileDetail?.name) {
                        downloadFile(resolvedFileDetail.url, resolvedFileDetail.name);
                      }
                    }}
                  />
                )}
                <ActionIcon
                  icon={RESOURCE_ENTRY_ICONS.info}
                  onClick={() => setIsDetailModalOpen(true)}
                />
              </Flexbox>
            }
            style={{
              borderBottom: `1px solid ${cssVar.colorBorderSecondary}`,
            }}
            styles={{
              left: { flex: 1, minWidth: 0, overflow: 'hidden', padding: 0 },
            }}
          />
          <Flexbox flex={1} style={{ overflow: 'hidden' }}>
            <FileContent fileId={currentViewItemId} />
          </Flexbox>
        </Flexbox>
        {/* <FileCopilot /> */}
      </Flexbox>

      <Modal
        footer={null}
        open={isDetailModalOpen}
        title={t('detail.basic.title', { ns: 'file' })}
        width={400}
        onCancel={() => setIsDetailModalOpen(false)}
      >
        {resolvedFileDetail && (
          <FileDetailComponent
            {...resolvedFileDetail}
            showDownloadButton={false}
            showTitle={false}
          />
        )}
      </Modal>
    </>
  );
});

FileEditorCanvas.displayName = 'FileEditorCanvas';

/**
 * View or Edit a file
 *
 * It's a un-reusable component for business logic only.
 * So we depend on context, not props.
 */
const FileEditor = memo<FileEditorProps>(({ onBack }) => {
  const currentViewItemId = useContentManagerStore((s) => s.currentViewItemId);

  return (
    <PageEditorStoreProvider
      key={currentViewItemId ?? 'content-file-editor'}
      createStore={() =>
        createPageEditorStore({
          documentId: currentViewItemId,
        })
      }
    >
      <DocsAgentProvider>
        <FileEditorCanvas onBack={onBack} />
      </DocsAgentProvider>
    </PageEditorStoreProvider>
  );
});

FileEditor.displayName = 'FileEditor';

export default FileEditor;
