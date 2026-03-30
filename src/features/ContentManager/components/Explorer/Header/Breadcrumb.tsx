import { Flexbox, Skeleton } from '@lobehub/ui';
import { createStaticStyles, cx } from 'antd-style';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import {
  buildContentFolderPath,
  buildContentRootPath,
  buildSourceSetFolderPath,
  buildSourceSetPath,
} from '@/features/ResourceSpaces';
import { useFolderPath } from '@/routes/(main)/content/features/hooks/useFolderPath';
import { useContentManagerStore } from '@/routes/(main)/content/features/store';
import { useFileStore } from '@/store/file';
import { sourceSetSelectors, useSourceSetStore } from '@/store/sourceSet';
import { FilesTabs } from '@/types/files';

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

interface BreadcrumbProps {
  category?: string;
  fileName?: string;
  sourceSetId?: string;
}

interface FolderCrumb {
  id: string;
  name: string;
  slug: string;
}

const Breadcrumb = memo<BreadcrumbProps>(({ category, fileName }) => {
  const { t } = useTranslation('file');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentFolderSlug, sourceSetId: currentSourceSetId } = useFolderPath();

  const [setMode, setCurrentViewItemId, spaceId] = useContentManagerStore((s) => [
    s.setMode,
    s.setCurrentViewItemId,
    s.spaceId,
  ]);

  const rootSourceSetId = currentSourceSetId;
  const sourceSetName = useSourceSetStore(
    sourceSetSelectors.getSourceSetNameById(rootSourceSetId || ''),
  );
  const categoryLabel =
    category === FilesTabs.Documents
      ? t('tab.docs', { defaultValue: 'Docs' })
      : category && category !== FilesTabs.All && category !== FilesTabs.Home
        ? t(`tab.${category as FilesTabs}` as any)
        : t('tab.all', { defaultValue: 'All' });

  // Fetch folder breadcrumb chain from backend
  const useFetchFolderBreadcrumb = useFileStore((s) => s.useFetchFolderBreadcrumb);
  const { data: folderChain = [] } = useFetchFolderBreadcrumb(currentFolderSlug, spaceId);

  // When in home mode (no source set selected), show the category breadcrumb.
  if (!rootSourceSetId && !currentFolderSlug && !fileName) {
    return null;
  }

  const handleNavigate = (slug: string | null) => {
    // If navigating while viewing a file, reset the file view mode
    if (fileName) {
      setMode('explorer');
      setCurrentViewItemId(undefined);
    }

    // Preserve existing query parameters (view and sort preferences)
    const newParams = new URLSearchParams(searchParams);
    // Remove 'file' parameter when navigating away
    newParams.delete('file');

    const queryString = newParams.toString();
    const basePath = rootSourceSetId
      ? slug
        ? buildSourceSetFolderPath(spaceId, rootSourceSetId, slug)
        : buildSourceSetPath(spaceId, rootSourceSetId)
      : slug
        ? buildContentFolderPath(spaceId, slug)
        : buildContentRootPath(spaceId);

    navigate(queryString ? `${basePath}?${queryString}` : basePath);
  };

  const isAtRoot = folderChain.length === 0 && !fileName;
  const isRootClickable = folderChain.length > 0 || fileName;
  const rootLabel = rootSourceSetId ? sourceSetName : categoryLabel;

  return (
    <Flexbox horizontal align={'center'} className={styles.breadcrumb} gap={0}>
      <span
        className={cx(styles.breadcrumbItem, isAtRoot && styles.currentItem)}
        style={{ cursor: isRootClickable ? 'pointer' : 'default' }}
        onClick={() => isRootClickable && handleNavigate(null)}
      >
        {rootLabel ||
          (rootSourceSetId ? (
            <Skeleton.Button active size="small" style={{ height: 14, minWidth: 80, width: 80 }} />
          ) : null)}
      </span>

      {folderChain.map((folder: FolderCrumb, index: number) => {
        const isLast = index === folderChain.length - 1 && !fileName;
        return (
          <Flexbox horizontal align={'center'} gap={0} key={folder.id}>
            <span className={styles.separator}>/</span>
            <span
              className={cx(styles.breadcrumbItem, isLast && styles.currentItem)}
              style={{ cursor: isLast ? 'default' : 'pointer' }}
              onClick={() => !isLast && handleNavigate(folder.slug)}
            >
              {folder.name}
            </span>
          </Flexbox>
        );
      })}

      {fileName && (
        <Flexbox horizontal align={'center'} gap={0}>
          <span className={styles.separator}>/</span>
          <span
            className={cx(styles.breadcrumbItem, styles.currentItem)}
            style={{ cursor: 'default' }}
          >
            {fileName}
          </span>
        </Flexbox>
      )}
    </Flexbox>
  );
});

Breadcrumb.displayName = 'Breadcrumb';

export default Breadcrumb;
