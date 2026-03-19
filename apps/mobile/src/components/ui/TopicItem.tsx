/**
 * TopicItem — A single topic row for TopicListScreen.
 */
import { Heart, MoreHorizontal, Pencil, Tag, Trash2, Wand2 } from 'lucide-react-native';
import React, { memo, useCallback, useState } from 'react';
import { Alert, Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';

import { withAlpha } from '../../constants/tags';
import { haptics } from '../../lib/haptics';
import { useI18n } from '../../lib/i18n';
import { useThemeColors } from '../../theme/colors';
import { tokens } from '../../theme/tokens';
import type { Topic } from '../../types';
import PromptModal from './PromptModal';
import { useToast } from './Toast';

interface TopicItemProps {
  isActive: boolean;
  isGroup?: boolean;
  onDelete: () => void;
  onFavorite: () => void;
  onMoveToTag?: () => void;
  onPress: () => void;
  onRename?: (newTitle: string) => void;
  onSmartRename?: () => void;
  topic: Topic;
}

const TopicItem = memo<TopicItemProps>(
  ({
    topic,
    isActive,
    isGroup,
    onPress,
    onFavorite,
    onDelete,
    onMoveToTag,
    onRename,
    onSmartRename,
  }) => {
    const { t } = useI18n();
    const toast = useToast();
    const colors = useThemeColors();
    const [menuVisible, setMenuVisible] = useState(false);
    const [renameVisible, setRenameVisible] = useState(false);

    const handleRename = useCallback(() => {
      setMenuVisible(false);
      setTimeout(() => setRenameVisible(true), 300);
    }, []);

    const handleDelete = useCallback(() => {
      setMenuVisible(false);
      setTimeout(() => {
        Alert.alert(t.deleteTopicConfirm, t.deleteTopicDesc, [
          { text: t.cancel, style: 'cancel' },
          {
            text: t.delete,
            style: 'destructive',
            onPress: () => {
              haptics.warning();
              onDelete();
            },
          },
        ]);
      }, 300);
    }, [onDelete, t]);

    const formatDate = (dateStr: string) => {
      const d = new Date(dateStr);
      return `${d.getMonth() + 1}/${d.getDate()}`;
    };

    return (
      <>
        <TouchableOpacity
          accessibilityLabel={topic.title}
          accessibilityRole="button"
          activeOpacity={0.6}
          className="flex-row items-center px-5 py-3.5 rounded-xl mx-3 mb-1"
          style={isActive ? { backgroundColor: colors.primarySubtle } : undefined}
          onLongPress={() => {
            haptics.medium();
            setMenuVisible(true);
          }}
          onPress={() => {
            haptics.light();
            onPress();
          }}
        >
          <View className="flex-1 mr-3">
            <View className="flex-row items-center">
              {topic.favorite && (
                <Heart
                  color={colors.danger}
                  fill={colors.danger}
                  size={12}
                  style={{ marginRight: 4 }}
                />
              )}
              <Text
                className="text-[15px] font-medium tracking-tight"
                numberOfLines={1}
                style={{ color: isActive ? colors.primary : colors.foreground }}
              >
                {topic.title}
              </Text>
              {isGroup && (
                <View
                  className="ml-2 flex-row items-center rounded-full px-2.5 py-0.5"
                  style={{ backgroundColor: withAlpha(colors.primary, '18') }}
                >
                  <View
                    className="mr-1.5 rounded-full"
                    style={{ backgroundColor: colors.primary, height: 6, width: 6 }}
                  />
                  <Text
                    className="text-[10px] font-semibold"
                    numberOfLines={1}
                    style={{ color: colors.primary }}
                  >
                    {t.chatListGroupTag}
                  </Text>
                </View>
              )}
            </View>
            <Text
              className="text-[12px] mt-0.5 font-medium"
              style={{ color: colors.secondaryText }}
            >
              {formatDate(topic.updatedAt)}
            </Text>
          </View>

          <TouchableOpacity
            className="p-1.5"
            onPress={() => {
              haptics.light();
              setMenuVisible(true);
            }}
          >
            <MoreHorizontal color={colors.muted} size={18} strokeWidth={tokens.icon.strokeWidth} />
          </TouchableOpacity>
        </TouchableOpacity>

        {/* Context Menu */}
        <Modal
          accessibilityViewIsModal
          transparent
          animationType="fade"
          visible={menuVisible}
          onRequestClose={() => setMenuVisible(false)}
        >
          <Pressable
            className="flex-1 justify-end bg-black/40"
            onPress={() => setMenuVisible(false)}
          >
            <Pressable className="bg-card rounded-t-2xl pb-8" onPress={(e) => e.stopPropagation()}>
              <View className="items-center pt-3 pb-2">
                <View className="w-9 h-1 rounded-full bg-foreground/10" />
              </View>
              <View className="px-5">
                <Pressable
                  className="flex-row items-center py-3.5 px-3 rounded-xl active:bg-foreground/5"
                  onPress={() => {
                    haptics.light();
                    onFavorite();
                    setMenuVisible(false);
                  }}
                >
                  <Heart
                    color={topic.favorite ? colors.danger : colors.muted}
                    fill={topic.favorite ? colors.danger : 'none'}
                    size={18}
                    strokeWidth={tokens.icon.strokeWidth}
                  />
                  <Text className="ml-3 text-base text-foreground">
                    {topic.favorite ? t.actionUnfavorite : t.actionFavorite}
                  </Text>
                </Pressable>
                {onSmartRename && (
                  <Pressable
                    className="flex-row items-center py-3.5 px-3 rounded-xl active:bg-foreground/5"
                    onPress={() => {
                      setMenuVisible(false);
                      onSmartRename();
                    }}
                  >
                    <Wand2 color={colors.muted} size={18} strokeWidth={tokens.icon.strokeWidth} />
                    <Text className="ml-3 text-base text-foreground">{t.actionSmartRename}</Text>
                  </Pressable>
                )}
                {onRename && (
                  <Pressable
                    className="flex-row items-center py-3.5 px-3 rounded-xl active:bg-foreground/5"
                    onPress={handleRename}
                  >
                    <Pencil color={colors.muted} size={18} strokeWidth={tokens.icon.strokeWidth} />
                    <Text className="ml-3 text-base text-foreground">{t.actionRename}</Text>
                  </Pressable>
                )}
                {onMoveToTag && (
                  <Pressable
                    className="flex-row items-center py-3.5 px-3 rounded-xl active:bg-foreground/5"
                    onPress={() => {
                      setMenuVisible(false);
                      onMoveToTag();
                    }}
                  >
                    <Tag color={colors.muted} size={18} strokeWidth={tokens.icon.strokeWidth} />
                    <Text className="ml-3 text-base text-foreground">{t.tagMoveSession}</Text>
                  </Pressable>
                )}
                <Pressable
                  className="flex-row items-center py-3.5 px-3 rounded-xl active:bg-foreground/5"
                  onPress={handleDelete}
                >
                  <Trash2 color={colors.danger} size={18} strokeWidth={tokens.icon.strokeWidth} />
                  <Text className="ml-3 text-base text-red-500">{t.delete}</Text>
                </Pressable>
              </View>
              <View className="px-5 mt-2">
                <Pressable
                  className="items-center py-3.5 rounded-xl bg-foreground/[0.04]"
                  onPress={() => setMenuVisible(false)}
                >
                  <Text className="text-base font-medium" style={{ color: colors.secondaryText }}>
                    {t.cancel}
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        <PromptModal
          defaultValue={topic.title}
          submitLabel={t.save}
          title={t.topicRename}
          visible={renameVisible}
          onCancel={() => setRenameVisible(false)}
          onSubmit={(newName) => {
            setRenameVisible(false);
            if (onRename) {
              haptics.success();
              onRename(newName);
              toast.show('success', t.topicRenamed);
            }
          }}
        />
      </>
    );
  },
);

TopicItem.displayName = 'TopicItem';

export default TopicItem;
