import { Camera, FileText, FolderOpen, FolderPlus, Image as ImageIcon } from 'lucide-react-native';
import React, { memo } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptics } from '../../lib/haptics';
import { useThemeColors } from '../../theme/colors';
import { useI18n } from '../../lib/i18n';
import { enteringModalContent } from '../../theme/motion';
import { tokens } from '../../theme/tokens';

interface AttachmentSheetProps {
  onCamera?: () => void;
  onClose: () => void;
  onDocument: () => void;
  onFromWorkspace?: () => void;
  onGallery?: () => void;
  onNewFolder?: () => void;
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
  ({ description, icon, isLast, onPress, title }) => {
    const colors = useThemeColors();
    return (
      <Pressable
        className={`flex-row items-start px-3.5 py-3 ${!isLast ? 'mb-px' : ''}`}
        onPress={onPress}
      >
        <View className="w-9 h-9 rounded-xl bg-foreground/[0.04] items-center justify-center mr-3">
          {icon}
        </View>
        <View className="flex-1">
          <Text className="text-foreground text-[17px] font-semibold tracking-tight">{title}</Text>
          <Text className="text-[13px] leading-5 mt-1" style={{ color: colors.secondaryText }}>
            {description}
          </Text>
        </View>
      </Pressable>
    );
  },
);

AttachmentOption.displayName = 'AttachmentOption';

const AttachmentSheet = memo<AttachmentSheetProps>(
  ({ visible, onClose, onCamera, onGallery, onDocument, onFromWorkspace, onNewFolder }) => {
    const colors = useThemeColors();
    const { t } = useI18n();
    const insets = useSafeAreaInsets();

    const options = [
      onCamera
        ? {
            description: 'Capture a new photo and attach it instantly.',
            icon: (
              <Camera
                color={colors.foreground}
                size={18}
                strokeWidth={tokens.icon.strokeWidth}
              />
            ),
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
            icon: (
              <ImageIcon
                color={colors.foreground}
                size={18}
                strokeWidth={tokens.icon.strokeWidth}
              />
            ),
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
        icon: (
          <FileText
            color={colors.foreground}
            size={18}
            strokeWidth={tokens.icon.strokeWidth}
          />
        ),
        key: 'document',
        title: t.fileDocument,
        onPress: () => {
          haptics.light();
          onClose();
          onDocument();
        },
      },
      onFromWorkspace
        ? {
            description: t.fileFromWorkspaceDesc,
            icon: (
              <FolderOpen
                color={colors.foreground}
                size={18}
                strokeWidth={tokens.icon.strokeWidth}
              />
            ),
            key: 'fromWorkspace',
            title: t.fileFromWorkspace,
            onPress: () => {
              haptics.light();
              onClose();
              onFromWorkspace();
            },
          }
        : null,
      onNewFolder
        ? {
            description: 'Create a new folder in the current location.',
            icon: (
              <FolderPlus
                color={colors.foreground}
                size={18}
                strokeWidth={tokens.icon.strokeWidth}
              />
            ),
            key: 'newFolder',
            title: t.resourceNewFolder,
            onPress: () => {
              haptics.light();
              onClose();
              onNewFolder();
            },
          }
        : null,
    ].filter(Boolean) as Array<{
      description: string;
      icon: React.ReactNode;
      key: string;
      onPress: () => void;
      title: string;
    }>;

    return (
      <Modal
        accessibilityViewIsModal
        transparent
        animationType="slide"
        visible={visible}
        onRequestClose={onClose}
      >
        <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
          <Animated.View entering={enteringModalContent()} style={{ maxHeight: '72%' }}>
            <Pressable
              className="bg-card rounded-t-2xl"
              style={{ paddingBottom: Math.max(insets.bottom, 16) }}
              onPress={(e) => e.stopPropagation()}
            >
              <View className="items-center pt-3 pb-1">
                <View className="w-9 h-1 rounded-full bg-foreground/10" />
              </View>

              <View className="px-5 pb-2 pt-2">
                <Text className="text-foreground text-[18px] font-bold tracking-tight">
                  {t.fileAttach}
                </Text>
                <Text className="text-[13px] leading-5 mt-1" style={{ color: colors.secondaryText }}>
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
          </Animated.View>
        </Pressable>
      </Modal>
    );
  },
);

AttachmentSheet.displayName = 'AttachmentSheet';

export default AttachmentSheet;
