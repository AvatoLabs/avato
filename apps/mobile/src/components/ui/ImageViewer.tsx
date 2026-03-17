/**
 * ImageViewer — Fullscreen image preview with dismiss.
 */
import { X } from 'lucide-react-native';
import React, { memo } from 'react';
import { Image, Modal, Pressable, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tokens } from '../../theme/tokens';

interface ImageViewerProps {
  onClose: () => void;
  uri: string;
  visible: boolean;
}

const ImageViewer = memo<ImageViewerProps>(({ visible, uri, onClose }) => {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      accessibilityViewIsModal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black">
        {/* Close button */}
        <TouchableOpacity
          className="absolute z-10 right-4 w-10 h-10 bg-white/20 rounded-full items-center justify-center"
          style={{ top: insets.top + 8 }}
          onPress={onClose}
        >
          <X color="#fff" size={20} strokeWidth={tokens.icon.strokeWidth} />
        </TouchableOpacity>

        {/* Image */}
        <Pressable className="flex-1 items-center justify-center" onPress={onClose}>
          <Image className="w-full h-full" resizeMode="contain" source={{ uri }} />
        </Pressable>
      </View>
    </Modal>
  );
});

ImageViewer.displayName = 'ImageViewer';

export default ImageViewer;
