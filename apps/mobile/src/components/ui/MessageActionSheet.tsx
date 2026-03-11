/**
 * MessageActionSheet — Bottom sheet for message long-press actions.
 */
import * as Clipboard from 'expo-clipboard';
import { Copy, Pencil, RefreshCw, Trash2 } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { memo, useCallback } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { haptics } from '../../lib/haptics';
import { useI18n } from '../../lib/i18n';
import { tokens } from '../../theme/tokens';
import { useToast } from './Toast';

export interface MessageAction {
  danger?: boolean;
  icon: React.ReactNode;
  key: string;
  label: string;
  onPress: () => void;
}

interface MessageActionSheetProps {
  content: string;
  messageId: string;
  onClose: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onRegenerate: () => void;
  role: 'user' | 'assistant' | 'system' | 'tool';
  visible: boolean;
}

const MessageActionSheet = memo<MessageActionSheetProps>(
  ({ visible, onClose, content, role, onCopy, onEdit, onRegenerate, onDelete }) => {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const { t } = useI18n();
    const toast = useToast();

    const handleCopy = useCallback(async () => {
      await Clipboard.setStringAsync(content);
      haptics.success();
      toast.show('success', t.toastCopied);
      onCopy();
      onClose();
    }, [content, onCopy, onClose, toast, t]);

    const handleEdit = useCallback(() => {
      onEdit();
      onClose();
    }, [onEdit, onClose]);

    const handleRegenerate = useCallback(() => {
      onRegenerate();
      onClose();
    }, [onRegenerate, onClose]);

    const handleDelete = useCallback(() => {
      onDelete();
      onClose();
    }, [onDelete, onClose]);

    const actions: MessageAction[] = [
      {
        key: 'copy',
        label: t.msgActionCopy,
        icon: (
          <Copy
            color={isDark ? '#d0d0d0' : '#333'}
            size={tokens.icon.size.md}
            strokeWidth={tokens.icon.strokeWidth}
          />
        ),
        onPress: handleCopy,
      },
      ...(role === 'user'
        ? [
            {
              key: 'edit',
              label: t.msgActionEdit,
              icon: (
                <Pencil
                  color={isDark ? '#d0d0d0' : '#333'}
                  size={tokens.icon.size.md}
                  strokeWidth={tokens.icon.strokeWidth}
                />
              ),
              onPress: handleEdit,
            },
          ]
        : []),
      {
        key: 'regenerate',
        label: t.msgActionRegenerate,
        icon: (
          <RefreshCw
            color={isDark ? '#d0d0d0' : '#333'}
            size={tokens.icon.size.md}
            strokeWidth={tokens.icon.strokeWidth}
          />
        ),
        onPress: handleRegenerate,
      },
      {
        key: 'delete',
        label: t.msgActionDelete,
        icon: (
          <Trash2
            color="#ff3b30"
            size={tokens.icon.size.md}
            strokeWidth={tokens.icon.strokeWidth}
          />
        ),
        danger: true,
        onPress: handleDelete,
      },
    ];

    return (
      <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
        <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
          <Pressable
            className="bg-white dark:bg-neutral-900 rounded-t-2xl pb-8"
            onPress={(e) => e.stopPropagation()}
          >
            {/* Handle bar */}
            <View className="items-center pt-3 pb-2">
              <View className="w-9 h-1 rounded-full bg-neutral-300 dark:bg-neutral-600" />
            </View>

            {/* Actions */}
            <View className="px-4">
              {actions.map((action) => (
                <Pressable
                  className="flex-row items-center py-3.5 px-3 rounded-xl active:bg-foreground/5"
                  key={action.key}
                  onPress={action.onPress}
                >
                  <View className="mr-3">{action.icon}</View>
                  <Text
                    className={`text-base ${
                      action.danger ? 'text-red-500' : 'text-neutral-800 dark:text-neutral-200'
                    }`}
                  >
                    {action.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Cancel */}
            <View className="px-4 mt-2">
              <Pressable
                className="items-center py-3.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 active:bg-neutral-200"
                onPress={onClose}
              >
                <Text className="text-base font-medium text-neutral-500">{t.cancel}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    );
  },
);

MessageActionSheet.displayName = 'MessageActionSheet';

export default MessageActionSheet;
