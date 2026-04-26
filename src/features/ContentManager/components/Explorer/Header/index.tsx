'use client';

import { type FileAssetCapabilities } from '@lobechat/types';
import { ActionIcon, Flexbox, Text } from '@lobehub/ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { XIcon } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import NavHeader from '@/features/NavHeader';
import CategoryMenu from '@/routes/(main)/content/(home)/_layout/Header/CategoryMenu';
import { useFolderPath } from '@/routes/(main)/content/features/hooks/useFolderPath';
import { selectors, useContentManagerStore } from '@/routes/(main)/content/features/store';
import { useServerConfigStore } from '@/store/serverConfig';

import AddButton from '../../Header/AddButton';
import BatchActionsDropdown from '../ToolBar/BatchActionsDropdown';
import DisplayDropdown from '../ToolBar/DisplayDropdown';
import Breadcrumb from './Breadcrumb';
import SearchInput from './SearchInput';

const styles = createStaticStyles(({ css, cssVar }) => ({
  breadcrumbWrap: css`
    overflow: hidden;
    min-width: 0;
    padding-inline-start: 8px;
  `,
  headerBar: css`
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
    background: linear-gradient(
      180deg,
      color-mix(in srgb, ${cssVar.colorBgContainer} 96%, ${cssVar.colorBgElevated}) 0%,
      color-mix(in srgb, ${cssVar.colorBgContainer} 92%, ${cssVar.colorBgLayout}) 100%
    );
    backdrop-filter: blur(14px);
  `,
  rightActions: css`
    gap: 6px;
    align-items: center;
    min-width: 0;
    padding-inline-start: 8px;
  `,
  selectionBar: css`
    gap: 12px;
    align-items: center;

    min-width: 0;
    padding-block: 6px;
    padding-inline: 8px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 999px;

    background: linear-gradient(
      180deg,
      color-mix(in srgb, ${cssVar.colorFillQuaternary} 88%, ${cssVar.colorBgContainer}) 0%,
      color-mix(in srgb, ${cssVar.colorFillSecondary} 76%, ${cssVar.colorBgContainer}) 100%
    );
    box-shadow:
      inset 0 1px 0 color-mix(in srgb, white 50%, transparent),
      0 12px 28px -24px color-mix(in srgb, ${cssVar.colorText} 24%, transparent);
  `,
  selectionActions: css`
    gap: 8px;
    align-items: center;

    padding: 4px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 999px;

    background: color-mix(in srgb, ${cssVar.colorFillQuaternary} 78%, transparent);
    box-shadow:
      inset 0 1px 0 color-mix(in srgb, white 44%, transparent),
      0 12px 28px -24px color-mix(in srgb, ${cssVar.colorText} 24%, transparent);
  `,
  selectionCount: css`
    font-size: 14px;
    font-weight: 600;
    color: ${cssVar.colorText};
    white-space: nowrap;
  `,
  selectionEyebrow: css`
    font-size: 11px;
    font-weight: 600;
    line-height: 1;
    color: ${cssVar.colorTextTertiary};
    text-transform: uppercase;
    letter-spacing: 0.08em;
    white-space: nowrap;
  `,
  selectionMeta: css`
    gap: 3px;
    min-width: 0;
    padding-inline: 4px 8px;
  `,
}));

/**
 * Toolbar for the resource explorer
 */
const Header = memo<{ governanceCapabilities?: FileAssetCapabilities }>(
  ({ governanceCapabilities }) => {
    const { t } = useTranslation(['components', 'common', 'file', 'sourceSet']);
    const { currentFolderSlug } = useFolderPath();

    // Get state and actions from store
    const [sourceSetId, currentViewItemId, onActionClick, selectFileIds, setSelectedFileIds] =
      useContentManagerStore((s) => [
        s.sourceSetId,
        s.currentViewItemId,
        s.onActionClick,
        s.selectedFileIds,
        s.setSelectedFileIds,
      ]);
    const currentFile = useContentManagerStore(selectors.getCurrentFile);
    const selectCount = selectFileIds.length;
    const isMultiSelected = selectCount > 1;
    const isMobile = useServerConfigStore((s) => s.isMobile);
    const showHeaderFilters = !isMultiSelected;
    const shouldShowBreadcrumb = Boolean(currentFolderSlug || currentViewItemId || sourceSetId);
    const showIdleBatchActions = !isMultiSelected && Boolean(sourceSetId);

    // Scope-first navigation lives in the sidebar. The header shows workspace-aware
    // breadcrumb context once users drill into a file, folder, or source set.
    const leftContent = isMultiSelected ? (
      <Flexbox horizontal className={styles.selectionBar}>
        <Flexbox className={styles.selectionMeta}>
          <Text className={styles.selectionEyebrow}>
            {t('FileManager.actions.batchActions', 'Batch actions')}
          </Text>
          <Text className={styles.selectionCount} weight={600}>
            {t('FileManager.total.selectedCount', { count: selectCount, ns: 'components' })}
          </Text>
        </Flexbox>
      </Flexbox>
    ) : shouldShowBreadcrumb ? (
      <Flexbox className={styles.breadcrumbWrap}>
        <Breadcrumb fileName={currentViewItemId ? currentFile?.name : undefined} />
      </Flexbox>
    ) : null;

    const rightContent = isMultiSelected ? (
      <Flexbox horizontal className={styles.selectionActions}>
        <BatchActionsDropdown
          governanceCapabilities={governanceCapabilities}
          selectCount={selectCount}
          onActionClick={onActionClick}
        />
        <ActionIcon
          icon={XIcon}
          title={t('close', { ns: 'common' })}
          onClick={() => setSelectedFileIds([])}
        />
      </Flexbox>
    ) : (
      <Flexbox horizontal className={styles.rightActions}>
        <SearchInput />
        <DisplayDropdown />
        {showIdleBatchActions && (
          <BatchActionsDropdown
            governanceCapabilities={governanceCapabilities}
            selectCount={selectCount}
            onActionClick={onActionClick}
          />
        )}
        <AddButton />
      </Flexbox>
    );

    return (
      <NavHeader
        children={showHeaderFilters ? <CategoryMenu /> : null}
        className={styles.headerBar}
        left={leftContent}
        right={rightContent}
        showTogglePanelButton={!isMobile}
        style={{
          background: cssVar.colorBgContainer,
          borderBottom: `1px solid ${cssVar.colorBorderSecondary}`,
        }}
        styles={{
          center: showHeaderFilters
            ? { alignItems: 'flex-start', flex: 1, minWidth: 0 }
            : undefined,
          left: { flex: 'none', minWidth: 0 },
          right: { flex: 'none', justifyContent: 'flex-end', minWidth: 0 },
        }}
      />
    );
  },
);

export default Header;
