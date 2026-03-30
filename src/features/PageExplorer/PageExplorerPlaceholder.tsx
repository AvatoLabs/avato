import { Center, FileTypeIcon, Flexbox, Icon, Text } from '@lobehub/ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { ArrowUpIcon, PlusIcon } from 'lucide-react';
import { type ChangeEvent, type KeyboardEvent, memo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { usePageStore } from '@/store/docs';
import { useFileStore } from '@/store/file';
import { DocumentSourceType } from '@/types/document';
import { DEFAULT_PAGE_KIND, type PageKind, TABLE_PAGE_KIND } from '@/utils/docs';

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
  pageKind?: PageKind;
  sourceSetId?: string;
}

const PageExplorerPlaceholder = memo<PageExplorerPlaceholderProps>(
  ({ hasPages = false, sourceSetId, pageKind = DEFAULT_PAGE_KIND }) => {
    const { t } = useTranslation(['file', 'common']);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
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
        await createNewTable(title, { sourceSetId });
        return;
      }

      if (!content) {
        // For empty pages, use createNewPage which handles optimistic updates
        await createNewPage(title, { sourceSetId });
        return;
      }

      // For markdown uploads with content, use optimistic pattern similar to createNewPage
      const tempPageId = createOptimisticPage(title, pageKind, sourceSetId);
      // Set selected page to temp ID immediately (with URL update disabled for temp IDs)
      setSelectedPageId(tempPageId, false);

      try {
        const newDoc = await createPage({
          content,
          sourceSetId,
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
          parentId: newDoc.parentId ?? null,
          sourceSetId: newDoc.sourceSetId ?? sourceSetId ?? null,
          metadata: newDoc.metadata || {},
          source: 'document' as const,
          sourceType: DocumentSourceType.EDITOR,
          spaceId: newDoc.spaceId ?? null,
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
          const tempPageId = createOptimisticPage(fileName, pageKind, sourceSetId);

          try {
            // Upload file to server
            const uploadResult = await useFileStore.getState().uploadWithProgress({
              file,
              sourceSetId,
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
              parentId: parsedDocument.parentId ?? null,
              sourceSetId: parsedDocument.sourceSetId ?? sourceSetId ?? null,
              metadata: parsedDocument.metadata || {},
              source: parsedDocument.source || 'document',
              sourceType: parsedDocument.sourceType || 'file',
              spaceId: parsedDocument.spaceId ?? null,
              title: parsedDocument.title || fileName,
              totalCharCount: parsedDocument.totalCharCount || 0,
              totalLineCount: parsedDocument.totalLineCount || 0,
              updatedAt: parsedDocument.updatedAt ? new Date(parsedDocument.updatedAt) : new Date(),
            };

            // Replace optimistic with real document in the store
            replaceTempPageWithReal(tempPageId, realPage);

            setSelectedPageId(parsedDocument.id);
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

    const openUploadFileDialog = () => {
      if (isUploading) return;

      fileInputRef.current?.click();
    };

    const handleUploadFileInputChange = async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];

      if (file) {
        await handleUploadFile(file);
      }

      event.target.value = '';
    };

    const handleUploadCardKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;

      event.preventDefault();
      openUploadFileDialog();
    };

    return (
      <>
        <Center height={'100%'} style={{ paddingBottom: 100, paddingInline: 24 }} width={'100%'}>
          <div className={styles.grid}>
            <Flexbox className={styles.accentCard} gap={18} justify={'center'} padding={28}>
              <Flexbox className={styles.previewPanel}>
                <Text as={'h2'} style={{ fontSize: 34, fontWeight: 700, lineHeight: 1.1 }}>
                  {t(isTablePage ? 'docEditor.empty.tableTitle' : 'docEditor.empty.title')}
                </Text>
                <Text style={{ color: cssVar.colorTextSecondary, fontSize: 15, lineHeight: 1.7 }}>
                  {t(
                    isTablePage
                      ? 'docEditor.empty.tableAutoSaveMessage'
                      : 'docEditor.autoSaveMessage',
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
                      ? 'docEditor.empty.createNewTable'
                      : 'docEditor.empty.createNewDocument',
                  )}
                </span>
                <span className={styles.actionDescription}>{t('docEditor.editorPlaceholder')}</span>
                <div className={styles.glow} style={{ background: cssVar.colorPrimary }} />
                <FileTypeIcon
                  className={styles.icon}
                  color={cssVar.colorPrimary}
                  icon={<Icon color={cssVar.colorTextLightSolid} icon={PlusIcon} />}
                  size={ICON_SIZE}
                  type={'file'}
                />
              </Flexbox>

              {!isTablePage && (
                <>
                  <Flexbox
                    aria-disabled={isUploading}
                    className={styles.card}
                    gap={4}
                    padding={20}
                    role={'button'}
                    style={{ opacity: isUploading ? 0.65 : 1 }}
                    tabIndex={isUploading ? -1 : 0}
                    onClick={openUploadFileDialog}
                    onKeyDown={handleUploadCardKeyDown}
                  >
                    <span className={styles.actionTitle}>
                      {isUploading
                        ? t('uploadDock.uploadStatus.uploading')
                        : t('docEditor.empty.uploadFiles')}
                    </span>
                    <span className={styles.actionDescription}>{t('empty')}</span>
                    <div className={styles.glow} style={{ background: cssVar.colorPrimary }} />
                    <FileTypeIcon
                      className={styles.icon}
                      color={cssVar.colorPrimary}
                      icon={<Icon color={cssVar.colorTextLightSolid} icon={ArrowUpIcon} />}
                      size={ICON_SIZE}
                      type={'file'}
                    />
                  </Flexbox>
                  <input
                    hidden
                    accept=".md,.markdown,.pdf,.docx"
                    ref={fileInputRef}
                    type={'file'}
                    onChange={handleUploadFileInputChange}
                  />
                </>
              )}
            </Flexbox>
          </div>
        </Center>
      </>
    );
  },
);

export default PageExplorerPlaceholder;
