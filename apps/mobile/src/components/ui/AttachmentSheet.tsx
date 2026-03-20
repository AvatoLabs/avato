import { Camera, FileText, FolderOpen, FolderPlus, Image as ImageIcon } from 'lucide-react-native';
import React, { memo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { haptics } from '../../lib/haptics';
import { useI18n } from '../../lib/i18n';
import { useThemeColors } from '../../theme/colors';
import { tokens } from '../../theme/tokens';
import { BottomSheetScaffold } from './BottomSheetScaffold';

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
        <View
          className="mr-3 h-9 w-9 items-center justify-center rounded-xl"
          style={{ backgroundColor: colors.fillTertiary }}
        >
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

    const options = [
      onCamera
        ? {
            description: t.fileCameraDesc,
            icon: (
              <Camera color={colors.foreground} size={18} strokeWidth={tokens.icon.strokeWidth} />
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
            description: t.fileGalleryDesc,
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
        description: t.fileDocumentDesc,
        icon: (
          <FileText color={colors.foreground} size={18} strokeWidth={tokens.icon.strokeWidth} />
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
            description: t.fileNewFolderDesc,
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
      <BottomSheetScaffold
        description={t.fileAttachDesc}
        maxHeight="72%"
        title={t.fileAttach}
        visible={visible}
        onClose={onClose}
      >
        <View className="px-5 pb-2">
          <View
            className="mt-4 overflow-hidden rounded-2xl"
            style={{ backgroundColor: colors.fillQuaternary }}
          >
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
      </BottomSheetScaffold>
    );
  },
);

AttachmentSheet.displayName = 'AttachmentSheet';

export default AttachmentSheet;
