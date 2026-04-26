import { Plus } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

import { useThemeColors } from '../../theme/colors';

interface ResourceUploadFabProps {
  bottomPadding: number;
  onPress: () => void;
  rightPadding: number;
  uploading: boolean;
  uploadProgress: number;
  visible: boolean;
}

export default function ResourceUploadFab({
  bottomPadding,
  onPress,
  rightPadding,
  uploadProgress,
  uploading,
  visible,
}: ResourceUploadFabProps) {
  const colors = useThemeColors();

  if (!visible) return null;

  return (
    <View
      className="absolute bottom-0 right-0"
      style={{
        paddingBottom: bottomPadding,
        paddingRight: rightPadding,
      }}
    >
      <TouchableOpacity
        activeOpacity={0.8}
        className="items-center justify-center rounded-full shadow-lg"
        style={{ width: 56, height: 56, elevation: 6, backgroundColor: colors.primary }}
        onPress={uploading ? undefined : onPress}
      >
        {uploading ? (
          <View className="items-center">
            <ActivityIndicator color={colors.iconOnPrimary} size="small" />
            {uploadProgress > 0 ? (
              <Text
                className="text-[9px] font-medium mt-0.5"
                style={{ color: colors.iconOnPrimary }}
              >
                {uploadProgress}%
              </Text>
            ) : null}
          </View>
        ) : (
          <Plus color={colors.iconOnPrimary} size={26} strokeWidth={2.5} />
        )}
      </TouchableOpacity>
    </View>
  );
}
