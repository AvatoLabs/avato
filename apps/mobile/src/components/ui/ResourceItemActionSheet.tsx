import {
  Eye,
  FileText,
  Folder,
  FolderOpen,
  Pencil,
  Share2,
  Trash2,
  Users,
} from 'lucide-react-native';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { isChatContextEligibleResource } from '../../lib/chatContext';
import { useI18n } from '../../lib/i18n';
import { isMarkdownFile } from '../../lib/resourceFile';
import { getCanonicalResourceKind } from '../../lib/resourceList';
import { useThemeColors } from '../../theme/colors';
import { tokens } from '../../theme/tokens';
import type { FileListItem } from '../../types';
import AdaptiveSheetModal from './AdaptiveSheetModal';

const isFolder = (item: FileListItem) => item.fileType === 'custom/folder';

interface ResourceItemActionSheetProps {
  actionItem: FileListItem | null;
  hasAnySourceSets: boolean;
  inSourceSetScope: boolean;
  onAddToChatContext: (item: FileListItem) => void | Promise<void>;
  onAddToSourceSet: (item: FileListItem) => void;
  onClose: () => void;
  onConvertToDocument: () => void | Promise<void>;
  onDelete: (item: FileListItem) => void;
  onManageShare: (item: FileListItem) => void;
  onMoveToFolder: (item: FileListItem) => void;
  onMoveToSourceSet: (item: FileListItem) => void;
  onPreview: (item: FileListItem) => void;
  onRemoveFromSourceSet: (item: FileListItem) => void | Promise<void>;
  onRename: () => void;
  onShare: (item: FileListItem) => void;
  otherSourceSetCount: number;
  visible: boolean;
}

export default function ResourceItemActionSheet({
  actionItem,
  hasAnySourceSets,
  inSourceSetScope,
  onAddToChatContext,
  onAddToSourceSet,
  onClose,
  onConvertToDocument,
  onDelete,
  onManageShare,
  onMoveToFolder,
  onMoveToSourceSet,
  onPreview,
  onRemoveFromSourceSet,
  onRename,
  onShare,
  otherSourceSetCount,
  visible,
}: ResourceItemActionSheetProps) {
  const colors = useThemeColors();
  const { t } = useI18n();

  if (!actionItem) return null;

  const itemIsFolder = isFolder(actionItem);
  const itemKind = getCanonicalResourceKind(actionItem);
  const canConvertToDocument =
    !itemIsFolder && itemKind === 'file' && isMarkdownFile(actionItem.fileType, actionItem.name);
  const canMoveToOtherSourceSet = !itemIsFolder && inSourceSetScope && otherSourceSetCount > 0;
  const canRemoveFromSourceSet = !itemIsFolder && inSourceSetScope;
  const canAddToSourceSet = !itemIsFolder && !inSourceSetScope && hasAnySourceSets;

  return (
    <AdaptiveSheetModal
      overflowHidden
      maxHeight="72%"
      preferredWidth={560}
      visible={visible}
      onClose={onClose}
    >
      <View className="items-center pt-3 pb-2">
        <View className="w-9 h-1 rounded-full bg-foreground/10" />
      </View>
      <View className="px-5">
        {!itemIsFolder ? (
          <Pressable
            className="flex-row items-center rounded-xl px-3 py-3.5 active:bg-foreground/5"
            onPress={() => onPreview(actionItem)}
          >
            <Eye color={colors.muted} size={18} strokeWidth={tokens.icon.strokeWidth} />
            <Text className="ml-3 text-base text-foreground">{t.notebookPreview}</Text>
          </Pressable>
        ) : null}
        {canConvertToDocument ? (
          <Pressable
            className="flex-row items-center rounded-xl px-3 py-3.5 active:bg-foreground/5"
            onPress={() => void onConvertToDocument()}
          >
            <FileText color={colors.muted} size={18} strokeWidth={tokens.icon.strokeWidth} />
            <View className="ml-3 flex-1">
              <Text className="text-base text-foreground">{t.fileEditAsDocument}</Text>
              <Text className="mt-0.5 text-[12px]" style={{ color: colors.secondaryText }}>
                {t.fileEditAsDocumentDesc}
              </Text>
            </View>
          </Pressable>
        ) : null}
        {inSourceSetScope ? (
          <Pressable
            className="flex-row items-center rounded-xl px-3 py-3.5 active:bg-foreground/5"
            onPress={() => onMoveToFolder(actionItem)}
          >
            <Folder color={colors.muted} size={18} strokeWidth={tokens.icon.strokeWidth} />
            <Text className="ml-3 text-base text-foreground">{t.resourceMoveToFolder}</Text>
          </Pressable>
        ) : null}
        {canMoveToOtherSourceSet ? (
          <Pressable
            className="flex-row items-center rounded-xl px-3 py-3.5 active:bg-foreground/5"
            onPress={() => onMoveToSourceSet(actionItem)}
          >
            <FolderOpen color={colors.muted} size={18} strokeWidth={tokens.icon.strokeWidth} />
            <Text className="ml-3 text-base text-foreground">{t.resourceMoveToSourceSet}</Text>
          </Pressable>
        ) : null}
        {canRemoveFromSourceSet ? (
          <Pressable
            className="flex-row items-center rounded-xl px-3 py-3.5 active:bg-foreground/5"
            onPress={() => void onRemoveFromSourceSet(actionItem)}
          >
            <FolderOpen color={colors.danger} size={18} strokeWidth={tokens.icon.strokeWidth} />
            <Text className="ml-3 text-base text-red-500">{t.resourceRemoveFromSourceSet}</Text>
          </Pressable>
        ) : null}
        {canAddToSourceSet ? (
          <Pressable
            className="flex-row items-center rounded-xl px-3 py-3.5 active:bg-foreground/5"
            onPress={() => onAddToSourceSet(actionItem)}
          >
            <FolderOpen color={colors.muted} size={18} strokeWidth={tokens.icon.strokeWidth} />
            <Text className="ml-3 text-base text-foreground">{t.resourceAddToSourceSet}</Text>
          </Pressable>
        ) : null}
        <Pressable
          className="flex-row items-center rounded-xl px-3 py-3.5 active:bg-foreground/5"
          onPress={onRename}
        >
          <Pencil color={colors.muted} size={18} strokeWidth={tokens.icon.strokeWidth} />
          <Text className="ml-3 text-base text-foreground">{t.actionRename}</Text>
        </Pressable>
        {isChatContextEligibleResource(actionItem) ? (
          <Pressable
            className="flex-row items-center rounded-xl px-3 py-3.5 active:bg-foreground/5"
            onPress={() => void onAddToChatContext(actionItem)}
          >
            <FileText color={colors.muted} size={18} strokeWidth={tokens.icon.strokeWidth} />
            <View className="ml-3 flex-1">
              <Text className="text-base text-foreground">{t.fileAddToChatContext}</Text>
              <Text className="mt-0.5 text-[12px]" style={{ color: colors.secondaryText }}>
                {t.fileAddToChatContextDesc}
              </Text>
            </View>
          </Pressable>
        ) : null}
        <Pressable
          className="flex-row items-center rounded-xl px-3 py-3.5 active:bg-foreground/5"
          onPress={() => onShare(actionItem)}
        >
          <Share2 color={colors.muted} size={18} strokeWidth={tokens.icon.strokeWidth} />
          <Text className="ml-3 text-base text-foreground">{t.resourceShareCreateLinkAction}</Text>
        </Pressable>
        <Pressable
          className="flex-row items-center rounded-xl px-3 py-3.5 active:bg-foreground/5"
          onPress={() => onManageShare(actionItem)}
        >
          <Users color={colors.muted} size={18} strokeWidth={tokens.icon.strokeWidth} />
          <Text className="ml-3 text-base text-foreground">{t.resourceShareManage}</Text>
        </Pressable>
        <Pressable
          className="flex-row items-center rounded-xl px-3 py-3.5 active:bg-foreground/5"
          onPress={() => onDelete(actionItem)}
        >
          <Trash2 color={colors.danger} size={18} strokeWidth={tokens.icon.strokeWidth} />
          <Text className="ml-3 text-base text-red-500">{t.delete}</Text>
        </Pressable>
      </View>
      <View className="mt-2 px-5">
        <Pressable
          className="items-center rounded-xl bg-foreground/[0.04] py-3.5"
          onPress={onClose}
        >
          <Text className="text-base font-medium" style={{ color: colors.secondaryText }}>
            {t.cancel}
          </Text>
        </Pressable>
      </View>
    </AdaptiveSheetModal>
  );
}
