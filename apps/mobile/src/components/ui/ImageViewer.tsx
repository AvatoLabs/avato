/**
 * ImageViewer — Fullscreen image preview with dismiss.
 */
import { Share2, X } from 'lucide-react-native';
import React, { memo, useCallback } from 'react';
import { Image, Modal, Platform, Pressable, Share, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemeColors } from '../../theme/colors';
import { tokens } from '../../theme/tokens';

interface ImageViewerProps {
  accessibilityLabelClose?: string;
  accessibilityLabelShare?: string;
  onClose: () => void;
  uri: string;
  visible: boolean;
}

const ImageViewer = memo<ImageViewerProps>(
  ({ accessibilityLabelClose, accessibilityLabelShare, visible, uri, onClose }) => {
    const insets = useSafeAreaInsets();
    const colors = useThemeColors();

    const handleShare = useCallback(async () => {
      try {
        if (Platform.OS === 'ios') {
          await Share.share({ url: uri });
        } else {
          await Share.share({ message: uri });
        }
      } catch {
        /* user dismissed */
      }
    }, [uri]);

    return (
      <Modal
        accessibilityViewIsModal
        transparent
        animationType="fade"
        visible={visible}
        onRequestClose={onClose}
      >
        <View className="flex-1 bg-black">
          <View
            className="absolute z-10 left-4 right-4 flex-row justify-between"
            style={{ top: insets.top + 8 }}
          >
            <TouchableOpacity
              accessibilityLabel={accessibilityLabelShare}
              accessibilityRole="button"
              className="w-10 h-10 bg-white/20 rounded-full items-center justify-center"
              onPress={handleShare}
            >
              <Share2
                color={colors.iconOnPrimary}
                size={20}
                strokeWidth={tokens.icon.strokeWidth}
              />
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityLabel={accessibilityLabelClose}
              accessibilityRole="button"
              className="w-10 h-10 bg-white/20 rounded-full items-center justify-center"
              onPress={onClose}
            >
              <X color={colors.iconOnPrimary} size={20} strokeWidth={tokens.icon.strokeWidth} />
            </TouchableOpacity>
          </View>

          <Pressable
            accessibilityLabel={accessibilityLabelClose}
            accessibilityRole="button"
            className="flex-1 items-center justify-center"
            onPress={onClose}
          >
            <Image className="w-full h-full" resizeMode="contain" source={{ uri }} />
          </Pressable>
        </View>
      </Modal>
    );
  },
);

ImageViewer.displayName = 'ImageViewer';

export default ImageViewer;
