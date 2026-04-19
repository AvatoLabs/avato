import { ArrowLeft, GitBranch, MessageCircle, MoreVertical, Search, X } from 'lucide-react-native';
import React from 'react';
import { type StyleProp, Text, TouchableOpacity, View, type ViewStyle } from 'react-native';

import { useI18n } from '../../lib/i18n';
import { navigateToConversationOrigin } from '../../lib/navigation';
import type {
  ContentRouteParams,
  ConversationOriginRouteParams,
  PortalRouteParams,
} from '../../navigation/types';
import { useThemeColors } from '../../theme/colors';
import { tokens } from '../../theme/tokens';
import FileGridSkeleton from './FileGridSkeleton';
import PortalScaffold from './PortalScaffold';
import ResourceCollectionList from './ResourceCollectionList';
import ResourceContentHeaderChrome from './ResourceContentHeaderChrome';
import ResourceSelectionToolbar from './ResourceSelectionToolbar';
import ResourceUploadFab from './ResourceUploadFab';
import { HeaderIconButton } from './ScreenHeader';

export interface ResourceContentPageProps {
  children?: React.ReactNode;
  collection: Omit<React.ComponentProps<typeof ResourceCollectionList>, 'messages'>;
  header: Omit<React.ComponentProps<typeof ResourceContentHeaderChrome>, 'filterTabs' | 'messages'>;
  onClearSelection: () => void;
  onOpenHeaderMenu: () => void;
  onToggleSearch: () => void;
  portal: {
    active: boolean;
    currentLabel: string;
    onDismiss?: () => void;
    onPressLeft?: () => void;
    routeName: 'Content' | 'PortalContent';
    routeParams: (ContentRouteParams & PortalRouteParams) | undefined;
  };
  resourceOrigin: ConversationOriginRouteParams | null;
  searchVisible: boolean;
  selectedCount: number;
  selectionToolbar?: Omit<React.ComponentProps<typeof ResourceSelectionToolbar>, 'messages'> & {
    containerStyle?: StyleProp<ViewStyle>;
  };
  selectMode: boolean;
  showInitialSkeleton: boolean;
  uploadFab: React.ComponentProps<typeof ResourceUploadFab>;
}

export default function ResourceContentPage({
  children,
  collection,
  header,
  onClearSelection,
  onOpenHeaderMenu,
  onToggleSearch,
  portal,
  resourceOrigin,
  searchVisible,
  selectMode,
  selectedCount,
  selectionToolbar,
  showInitialSkeleton,
  uploadFab,
}: ResourceContentPageProps) {
  const { t } = useI18n();
  const colors = useThemeColors();
  const resourceOriginActionLabel = resourceOrigin?.threadId
    ? t.threadOpen
    : t.chatOpenConversation;
  const filterTabs = [
    { key: 'all' as const, label: t.resourceTabAll },
    { key: 'images' as const, label: t.resourceTabImages },
    { key: 'documents' as const, label: t.resourceTabDocuments },
    { key: 'others' as const, label: t.resourceTabOthers },
  ];

  return (
    <PortalScaffold
      active={portal.active}
      headerLevel="root"
      portalCurrentLabel={portal.currentLabel}
      portalRouteName={portal.routeName}
      portalRouteParams={portal.routeParams}
      headerChildren={
        <ResourceContentHeaderChrome
          {...header}
          filterTabs={filterTabs}
          messages={{
            resourceCollapseAll: t.resourceCollapseAll,
            resourceExpandAll: t.resourceExpandAll,
            resourceGovernanceAdvanced: t.resourceGovernanceAdvanced,
            resourceGovernanceClear: t.resourceGovernanceClear,
            resourceGovernanceFilters: t.resourceGovernanceFilters,
            resourceGovernanceQuickHint: t.resourceGovernanceQuickHint,
            resourceSharedKindSourceSet: t.resourceSharedKindSourceSet,
            resourceViewModeToggle: t.resourceViewModeToggle,
            search: t.search,
            workspaceManageSourceSet: t.workspaceManageSourceSet,
          }}
        />
      }
      leftElement={
        portal.onPressLeft ? (
          <ArrowLeft color={colors.primary} size={20} strokeWidth={tokens.icon.strokeWidth} />
        ) : undefined
      }
      rightActions={
        selectMode ? (
          <TouchableOpacity
            hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}
            onPress={onClearSelection}
          >
            <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '500' }}>
              {t.resourceCancelSelect}
            </Text>
          </TouchableOpacity>
        ) : (
          <View className="flex-row items-center" style={{ gap: 6 }}>
            {resourceOrigin?.sessionId ? (
              <HeaderIconButton
                accessibilityLabel={resourceOriginActionLabel}
                onPress={() => navigateToConversationOrigin(resourceOrigin)}
              >
                {resourceOrigin.threadId ? (
                  <GitBranch
                    color={colors.primary}
                    size={20}
                    strokeWidth={tokens.icon.strokeWidth}
                  />
                ) : (
                  <MessageCircle
                    color={colors.primary}
                    size={20}
                    strokeWidth={tokens.icon.strokeWidth}
                  />
                )}
              </HeaderIconButton>
            ) : null}
            <HeaderIconButton
              accessibilityLabel={t.search}
              active={searchVisible}
              onPress={onToggleSearch}
            >
              {searchVisible ? (
                <X color={colors.primary} size={20} strokeWidth={tokens.icon.strokeWidth} />
              ) : (
                <Search color={colors.primary} size={20} strokeWidth={tokens.icon.strokeWidth} />
              )}
            </HeaderIconButton>
            <HeaderIconButton accessibilityLabel={t.resourceMoreActions} onPress={onOpenHeaderMenu}>
              <MoreVertical
                color={colors.primary}
                size={20}
                strokeWidth={tokens.icon.strokeWidth}
              />
            </HeaderIconButton>
          </View>
        )
      }
      title={
        selectMode
          ? t.resourceSelectCount.replace('{count}', String(selectedCount))
          : t.resourceTitle
      }
      onDismiss={portal.onDismiss}
      onPressLeft={portal.onPressLeft}
    >
      {selectionToolbar ? (
        <View style={selectionToolbar.containerStyle}>
          <ResourceSelectionToolbar
            {...selectionToolbar}
            messages={{
              resourceAddToSourceSet: t.resourceAddToSourceSet,
              resourceBatchDelete: t.resourceBatchDelete,
              resourceBatchMove: t.resourceBatchMove,
              resourceBatchShareLink: t.resourceBatchShareLink,
              resourceMoveToSourceSet: t.resourceMoveToSourceSet,
              resourceRemoveFromSourceSet: t.resourceRemoveFromSourceSet,
              resourceTitle: t.resourceTitle,
            }}
          />
        </View>
      ) : null}

      {showInitialSkeleton ? (
        <FileGridSkeleton />
      ) : (
        <ResourceCollectionList
          {...collection}
          messages={{
            resourceEmpty: t.resourceEmpty,
            resourceEmptyDesc: t.resourceEmptyDesc,
            resourceFolderEmpty: t.resourceFolderEmpty,
            resourceFolderEmptyDesc: t.resourceFolderEmptyDesc,
            resourceLoadMore: t.resourceLoadMore,
            resourceNewFolder: t.resourceNewFolder,
            resourceSharedKindSourceSet: t.resourceSharedKindSourceSet,
            resourceUpload: t.resourceUpload,
          }}
        />
      )}

      <ResourceUploadFab {...uploadFab} />
      {children}
    </PortalScaffold>
  );
}
