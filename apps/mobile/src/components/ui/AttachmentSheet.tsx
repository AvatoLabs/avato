import { Camera, FileText, Image as ImageIcon } from 'lucide-react-native';
import React, { memo } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptics } from '../../lib/haptics';
import { useI18n } from '../../lib/i18n';
import { tokens } from '../../theme/tokens';

interface AttachmentSheetProps {
  onCamera?: () => void;
  onClose: () => void;
  onDocument: () => void;
  onGallery?: () => void;
  visible: boolean;
}

interface AttachmentOptionProps {
  description: string;
  icon: React.ReactNode;
  isLast?: boolean;
  onPress: () => void;
  title: string;
}

const AttachmentOption = memo<AttachmentOptionProps>(
  ({ description, icon, isLast, onPress, title }) => (
    <Pressable
      className={`flex-row items-start px-3.5 py-3 ${!isLast ? 'border-b border-black/[0.06]' : ''}`}
      onPress={onPress}
    >
      <View className="w-9 h-9 rounded-xl border border-black/5 bg-white items-center justify-center mr-3">
        {icon}
      </View>
      <View className="flex-1">
        <Text className="text-foreground text-[17px] font-semibold tracking-tight">{title}</Text>
        <Text className="text-secondary/60 text-[13px] leading-5 mt-1">{description}</Text>
      </View>
    </Pressable>
  ),
);

AttachmentOption.displayName = 'AttachmentOption';

const AttachmentSheet = memo<AttachmentSheetProps>(
  ({ visible, onClose, onCamera, onGallery, onDocument }) => {
    const { t } = useI18n();
    const insets = useSafeAreaInsets();

    const options = [
      onCamera
        ? {
            description: 'Capture a new photo and attach it instantly.',
            icon: <Camera color="#111" size={18} strokeWidth={tokens.icon.strokeWidth} />,
            key: 'camera',
            title: t.fileCamera,
            onPress: () => {
              haptics.light();
              onClose();
              onCamera();
            },
          }
        : null,
      onGallery
        ? {
            description: 'Choose one or more images from your library.',
            icon: <ImageIcon color="#111" size={18} strokeWidth={tokens.icon.strokeWidth} />,
            key: 'gallery',
            title: t.fileGallery,
            onPress: () => {
              haptics.light();
              onClose();
              onGallery();
            },
          }
        : null,
      {
        description: 'Attach files, notes, PDFs, or other supporting material.',
        icon: <FileText color="#111" size={18} strokeWidth={tokens.icon.strokeWidth} />,
        key: 'document',
        title: t.fileDocument,
        onPress: () => {
          haptics.light();
          onClose();
          onDocument();
        },
      },
    ].filter(Boolean) as Array<{
      description: string;
      icon: React.ReactNode;
      key: string;
      onPress: () => void;
      title: string;
    }>;

    return (
      <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
        <Pressable
          className="flex-1 justify-end"
          style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
          onPress={onClose}
        >
          <Pressable
            className="bg-white rounded-t-3xl"
            style={{ paddingBottom: Math.max(insets.bottom, 16), maxHeight: '72%' }}
            onPress={(e) => e.stopPropagation()}
          >
            <View className="items-center pt-3 pb-1">
              <View className="w-10 h-1 rounded-full bg-black/10" />
            </View>

            <View className="px-5 pb-2 pt-2">
              <Text className="text-foreground text-[22px] font-bold tracking-tight">
                {t.fileAttach}
              </Text>
              <Text className="text-secondary/60 text-[13px] leading-5 mt-1">
                Pick the source that fits the task. Everything lands in the same chat composer.
              </Text>

              <View className="mt-4 bg-foreground/5 rounded-2xl overflow-hidden">
                {options.map((option, index) => (
                  <AttachmentOption
                    description={option.description}
                    icon={option.icon}
                    isLast={index === options.length - 1}
                    key={option.key}
                    title={option.title}
                    onPress={option.onPress}
                  />
                ))}
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    );
  },
);

AttachmentSheet.displayName = 'AttachmentSheet';

export default AttachmentSheet;
