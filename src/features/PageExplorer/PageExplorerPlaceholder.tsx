import { Center, FileTypeIcon, Flexbox, Icon, Text } from '@lobehub/ui';
import { Upload } from 'antd';
import { createStaticStyles, cssVar } from 'antd-style';
import { ArrowUpIcon, PlusIcon } from 'lucide-react';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useFileStore } from '@/store/file';
import { usePageStore } from '@/store/page';
import { DocumentSourceType } from '@/types/document';
import { standardizeIdentifier } from '@/utils/identifier';
import {
  DEFAULT_PAGE_KIND,
  getPageDetailPath,
  getPageKindFromDocument,
  getPageRootPath,
  type PageKind,
  TABLE_PAGE_KIND,
} from '@/utils/page';

const ICON_SIZE = 80;

const styles = createStaticStyles(({ css, cssVar }) => ({
  actionDescription: css`
    margin-block-start: 4px;
    font-size: 13px;
    line-height: 1.5;
    color: ${cssVar.colorTextTertiary};
  `,
  actionTitle: css`
    margin-block-start: 14px;
    font-size: 16px;
    color: ${cssVar.colorText};
  `,
  accentCard: css`
    position: relative;

    overflow: hidden;

    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 28px;

    background: ${cssVar.colorBgContainer};
  `,
  accentLine: css`
    block-size: 10px;
    border-radius: 999px;
    background: color-mix(in srgb, ${cssVar.colorPrimaryBg} 64%, ${cssVar.colorFillTertiary} 36%);
  `,
  card: css`
    cursor: pointer;

    position: relative;

    overflow: hidden;

    min-width: 0;
    min-height: 172px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 24px;

    font-weight: 500;

    background: ${cssVar.colorBgContainer};

    transition:
      transform 0.25s ease,
      border-color 0.25s ease,
      background 0.25s ease;

    &:hover {
      transform: translateY(-2px);
      border-color: color-mix(in srgb, ${cssVar.colorPrimaryBorder} 60%, ${cssVar.colorBorder} 40%);
      background: color-mix(
        in srgb,
        ${cssVar.colorPrimaryBg} 14%,
        ${cssVar.colorFillSecondary} 86%
      );
    }
  `,
  grid: css`
    display: grid;
    grid-template-columns: minmax(320px, 1.1fr) minmax(260px, 0.9fr);
    gap: 20px;
    width: min(1080px, 100%);

    @media (width <= 900px) {
      grid-template-columns: 1fr;
    }
  `,
  glow: css`
    position: absolute;
    inset-block-end: -12px;
    inset-inline-end: 0;

    width: 48px;
    height: 48px;

    opacity: 0.5;
    filter: blur(24px);
  `,
  icon: css`
    position: absolute;
    z-index: 1;
    inset-block-end: -24px;
    inset-inline-end: 8px;

    flex: none;
  `,
  previewPanel: css`
    gap: 14px;
    inline-size: min(460px, 100%);
  `,
}));

interface PageExplorerPlaceholderProps {
  hasPages?: boolean;
  knowledgeBaseId?: string;
  pageKind?: PageKind;
}

const PageExplorerPlaceholder = memo<PageExplorerPlaceholderProps>(
  ({ hasPages = false, knowledgeBaseId, pageKind = DEFAULT_PAGE_KIND }) => {
    const { t } = useTranslation(['file', 'common']);
    const [isUploading, setIsUploading] = useState(false);
    const isTablePage = pageKind === TABLE_PAGE_KIND;

    // Page-specific operations from pageStore
    const [
      createNewPage,
      createNewTable,
      createOptimisticPage,
      replaceTempPageWithReal,
      setSelectedPageId,
      createPage,
    ] = usePageStore((s) => [
      s.createNewPage,
      s.createNewTable,
      s.createOptimisticPage,
      s.replaceTempPageWithReal,
      s.setSelectedPageId,
      s.createPage,
    ]);

    const handleCreateDocument = async (content: string, title: string) => {
      if (isTablePage) {
        await createNewTable(title);
        return;
      }

      if (!content) {
        // For empty pages, use createNewPage which handles optimistic updates
        await createNewPage(title);
        return;
      }

      // For markdown uploads with content, use optimistic pattern similar to createNewPage
      const tempPageId = createOptimisticPage(title);
      // Set selected page to temp ID immediately (with URL update disabled for temp IDs)
      setSelectedPageId(tempPageId, false);

      try {
        const newDoc = await createPage({
          content,
          knowledgeBaseId,
          pageKind,
          title,
        });

        // Convert to LobeDocument format
        const realPage = {
          content: newDoc.content || '',
          createdAt: newDoc.createdAt ? new Date(newDoc.createdAt) : new Date(),
          editorData:
            typeof newDoc.editorData === 'string'
              ? JSON.parse(newDoc.editorData)
              : newDoc.editorData || null,
          fileType: 'custom/document' as const,
          filename: newDoc.title || title,
          id: newDoc.id,
          metadata: newDoc.metadata || {},
          source: 'document' as const,
          sourceType: DocumentSourceType.EDITOR,
          title: newDoc.title || title,
          totalCharCount: newDoc.content?.length || 0,
          totalLineCount: 0,
          updatedAt: newDoc.updatedAt ? new Date(newDoc.updatedAt) : new Date(),
        };

        // Replace optimistic with real
        replaceTempPageWithReal(tempPageId, realPage);
        // Update selected page ID and URL to the real page
        setSelectedPageId(newDoc.id);
      } catch (error) {
        console.error('Failed to create page:', error);
        // Remove temp document on error
        usePageStore.getState().removeTempPage(tempPageId);
        setSelectedPageId(null);
        throw error;
      }
    };

    const handleUploadFile = async (file: File) => {
      try {
        setIsUploading(true);

        const fileExtension = file.name.split('.').pop()?.toLowerCase();

        // For markdown files, read content directly
        if (fileExtension === 'md' || fileExtension === 'markdown') {
          const content = await file.text();
          await handleCreateDocument(content, file.name.replace(/\.md$|\.markdown$/i, ''));
        }
        // For PDF and DOCX files, upload to server and parse
        else if (fileExtension === 'pdf' || fileExtension === 'docx') {
          const fileName = file.name.replace(/\.(pdf|docx)$/i, '');

          // Create optimistic document but don't select it yet
          const tempPageId = createOptimisticPage(fileName);

          try {
            // Upload file to server
            const uploadResult = await useFileStore.getState().uploadWithProgress({
              file,
              knowledgeBaseId,
            });

            if (!uploadResult) {
              throw new Error('Failed to upload file');
            }

            // Parse file as document on server - this creates a clean document from the file
            const { lambdaClient } = await import('@/libs/trpc/client');
            const parsedDocument = await lambdaClient.document.parseDocument.mutate({
              id: uploadResult.id,
            });

            // Convert to LobeDocument format
            const realPage = {
              content: parsedDocument.content || '',
              createdAt: parsedDocument.createdAt ? new Date(parsedDocument.createdAt) : new Date(),
              editorData:
                typeof parsedDocument.editorData === 'string'
                  ? JSON.parse(parsedDocument.editorData)
                  : parsedDocument.editorData || null,
              fileType: parsedDocument.fileType || 'custom/document',
              filename: parsedDocument.filename || fileName,
              id: parsedDocument.id,
              metadata: parsedDocument.metadata || {},
              source: parsedDocument.source || 'document',
              sourceType: parsedDocument.sourceType || 'file',
              title: parsedDocument.title || fileName,
              totalCharCount: parsedDocument.totalCharCount || 0,
              totalLineCount: parsedDocument.totalLineCount || 0,
              updatedAt: parsedDocument.updatedAt ? new Date(parsedDocument.updatedAt) : new Date(),
            };

            // Replace optimistic with real document in the store
            replaceTempPageWithReal(tempPageId, realPage);

            // Update selected page ID in store (with full ID including prefix)
            setSelectedPageId(parsedDocument.id, false);

            // Update URL with stripped ID (without prefix)
            const cleanId = standardizeIdentifier(parsedDocument.id);
            const nextPageKind = getPageKindFromDocument(realPage);
            const newPath = cleanId ? getPageDetailPath(cleanId, nextPageKind) : getPageRootPath();
            window.history.replaceState({}, '', newPath);
          } catch (error) {
            console.error('Failed to upload and parse file:', error);
            // Remove temp document on error
            usePageStore.getState().removeTempPage(tempPageId);
            throw error;
          }
        }
      } catch (error) {
        console.error('Failed to upload file:', error);
      } finally {
        setIsUploading(false);
      }

      return false; // Prevent default upload behavior
    };

    return (
      <>
        <Center height={'100%'} style={{ paddingBottom: 100, paddingInline: 24 }} width={'100%'}>
          <div className={styles.grid}>
            <Flexbox className={styles.accentCard} gap={18} justify={'center'} padding={28}>
              <Flexbox className={styles.previewPanel}>
                <Text as={'h2'} style={{ fontSize: 34, fontWeight: 700, lineHeight: 1.1 }}>
                  {t(isTablePage ? 'pageEditor.empty.tableTitle' : 'pageEditor.empty.title')}
                </Text>
                <Text style={{ color: cssVar.colorTextSecondary, fontSize: 15, lineHeight: 1.7 }}>
                  {t(
                    isTablePage
                      ? 'pageEditor.empty.tableAutoSaveMessage'
                      : 'pageEditor.autoSaveMessage',
                  )}
                </Text>
                <Flexbox gap={10} style={{ marginTop: 8 }}>
                  <div className={styles.accentLine} style={{ width: '38%' }} />
                  <div className={styles.accentLine} style={{ width: '100%' }} />
                  <div className={styles.accentLine} style={{ width: '84%' }} />
                  <div className={styles.accentLine} style={{ width: '72%' }} />
                </Flexbox>
                {hasPages && (
                  <Text style={{ color: cssVar.colorTextTertiary, fontSize: 13 }}>
                    {t('or', { ns: 'common' })}
                  </Text>
                )}
              </Flexbox>
            </Flexbox>

            <Flexbox gap={12}>
              <Flexbox
                className={styles.card}
                gap={4}
                padding={20}
                onClick={() =>
                  handleCreateDocument(
                    '',
                    isTablePage ? t('pageList.tableUntitled') : t('pageList.untitled'),
                  )
                }
              >
                <span className={styles.actionTitle}>
                  {t(
                    isTablePage
                      ? 'pageEditor.empty.createNewTable'
                      : 'pageEditor.empty.createNewDocument',
                  )}
                </span>
                <span className={styles.actionDescription}>
                  {t('pageEditor.editorPlaceholder')}
                </span>
                <div className={styles.glow} style={{ background: cssVar.colorPrimary }} />
                <FileTypeIcon
                  className={styles.icon}
                  color={cssVar.colorPrimary}
                  icon={<Icon color={'#fff'} icon={PlusIcon} />}
                  size={ICON_SIZE}
                  type={'file'}
                />
              </Flexbox>

              {!isTablePage && (
                <Upload
                  accept=".md,.markdown,.pdf,.docx"
                  beforeUpload={handleUploadFile}
                  disabled={isUploading}
                  multiple={false}
                  showUploadList={false}
                >
                  <Flexbox
                    className={styles.card}
                    gap={4}
                    padding={20}
                    style={{ opacity: isUploading ? 0.65 : 1 }}
                  >
                    <span className={styles.actionTitle}>
                      {isUploading
                        ? t('uploadDock.uploadStatus.uploading')
                        : t('pageEditor.empty.uploadFiles')}
                    </span>
                    <span className={styles.actionDescription}>{t('empty')}</span>
                    <div className={styles.glow} style={{ background: cssVar.colorPrimary }} />
                    <FileTypeIcon
                      className={styles.icon}
                      color={cssVar.colorPrimary}
                      icon={<Icon color={'#fff'} icon={ArrowUpIcon} />}
                      size={ICON_SIZE}
                      type={'file'}
                    />
                  </Flexbox>
                </Upload>
              )}
            </Flexbox>
          </div>
        </Center>
      </>
    );
  },
);

export default PageExplorerPlaceholder;
