import { Folder, Plus } from 'lucide-react-native';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { useThemeColors } from '../../theme/colors';
import { tokens } from '../../theme/tokens';
import EmptyState from './EmptyState';

interface ResourceListEmptyStateMessages {
  resourceEmpty: string;
  resourceEmptyDesc: string;
  resourceFolderEmpty: string;
  resourceFolderEmptyDesc: string;
  resourceNewFolder: string;
  resourceUpload: string;
}

interface ResourceListEmptyStateProps {
  inFolder: boolean;
  messages: ResourceListEmptyStateMessages;
  onCreateFolder: () => void;
  onUpload: () => void;
  sourceSetId: string | null;
}

export default function ResourceListEmptyState({
  inFolder,
  messages,
  sourceSetId,
  onCreateFolder,
  onUpload,
}: ResourceListEmptyStateProps) {
  const colors = useThemeColors();

  return (
    <EmptyState
      description={inFolder ? messages.resourceFolderEmptyDesc : messages.resourceEmptyDesc}
      iconVariant="resource"
      title={inFolder ? messages.resourceFolderEmpty : messages.resourceEmpty}
      action={
        <View className="flex-row flex-wrap justify-center gap-3 mt-2">
          <TouchableOpacity
            activeOpacity={0.7}
            className="flex-row items-center rounded-2xl px-5 py-3"
            style={{ backgroundColor: colors.primary }}
            onPress={onUpload}
          >
            <Plus color={colors.iconOnPrimary} size={18} strokeWidth={2.5} />
            <Text
              className="ml-2 text-[15px] font-semibold"
              style={{ color: colors.iconOnPrimary }}
            >
              {messages.resourceUpload}
            </Text>
          </TouchableOpacity>
          {sourceSetId ? (
            <TouchableOpacity
              activeOpacity={0.7}
              className="flex-row items-center rounded-2xl px-5 py-3"
              style={{
                backgroundColor: colors.primarySubtle,
                borderColor: colors.primaryBorder,
                borderWidth: 1,
              }}
              onPress={onCreateFolder}
            >
              <Folder color={colors.primary} size={18} strokeWidth={tokens.icon.strokeWidth} />
              <Text className="ml-2 text-[15px] font-semibold" style={{ color: colors.primary }}>
                {messages.resourceNewFolder}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      }
    />
  );
}
