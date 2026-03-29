import { Flexbox } from '@lobehub/ui';
import { createStaticStyles, cx } from 'antd-style';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { useFileStore } from '@/store/file';
import { sourceSetSelectors, useSourceSetStore } from '@/store/sourceSet';

import { usePageEditorStore } from '../store';

const styles = createStaticStyles(({ css, cssVar }) => ({
  breadcrumb: css`
    font-size: 14px;
    color: ${cssVar.colorTextSecondary};
  `,
  breadcrumbItem: css`
    cursor: pointer;
    transition: color ${cssVar.motionDurationSlow};

    &:hover {
      color: ${cssVar.colorText};
    }
  `,
  currentItem: css`
    font-weight: 500;
    color: ${cssVar.colorText};
  `,
  separator: css`
    margin-inline: 8px;
    color: ${cssVar.colorTextQuaternary};
  `,
}));

interface FolderCrumb {
  id: string;
  name: string;
  slug: string;
}

const Breadcrumb = memo(() => {
  const { t } = useTranslation('file');

  const title = usePageEditorStore((s) => s.title);
  const sourceSetId = usePageEditorStore((s) => s.sourceSetId);
  const parentId = usePageEditorStore((s) => s.parentId);

  const sourceSetName = useSourceSetStore(
    sourceSetSelectors.getSourceSetNameById(sourceSetId || ''),
  );

  // Fetch the parent folder to get its slug
  const useFetchKnowledgeItem = useFileStore((s) => s.useFetchKnowledgeItem);
  const { data: parentFolder } = useFetchKnowledgeItem(parentId);

  // Fetch folder breadcrumb chain from backend using parent folder's slug
  const useFetchFolderBreadcrumb = useFileStore((s) => s.useFetchFolderBreadcrumb);
  const { data: folderChain = [] } = useFetchFolderBreadcrumb(
    parentFolder?.slug || null,
    parentFolder?.spaceId ?? undefined,
  );

  // If no parent folder data yet, don't render
  if (!parentFolder || !parentId) {
    return null;
  }

  const documentTitle = title || t('docEditor.titlePlaceholder');

  return (
    <Flexbox horizontal align={'center'} className={styles.breadcrumb} flex={1} gap={0}>
      {/* Source set root */}
      {sourceSetId && (
        <>
          <span className={styles.breadcrumbItem} style={{ cursor: 'default' }}>
            {sourceSetName || 'Source Set'}
          </span>
          <span className={styles.separator}>/</span>
        </>
      )}

      {/* Folder chain */}
      {folderChain.map((folder: FolderCrumb) => (
        <Flexbox horizontal align={'center'} gap={0} key={folder.id}>
          <span className={styles.breadcrumbItem} style={{ cursor: 'default' }}>
            {folder.name}
          </span>
          <span className={styles.separator}>/</span>
        </Flexbox>
      ))}

      {/* Current document title */}
      <span className={cx(styles.breadcrumbItem, styles.currentItem)} style={{ cursor: 'default' }}>
        {documentTitle}
      </span>
    </Flexbox>
  );
});

Breadcrumb.displayName = 'Breadcrumb';

export default Breadcrumb;
