/**
 * GroupMentionInput — TextInput with @ mention support for group chat.
 * When user types "@", shows a member picker (ALL_MEMBERS + individual members).
 * Inserts <mention name="X" id="Y" /> format into the text.
 */
import { Users } from 'lucide-react-native';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { TextInput as RNTextInput } from 'react-native';
import { FlatList, Image as RNImage, Modal, Pressable, Text, TextInput, View } from 'react-native';

import { useI18n } from '../../lib/i18n';
import { useThemeColors } from '../../theme/colors';

const MENTION_FORMAT = (name: string, id: string) => `<mention name="${name}" id="${id}" />`;

export interface MentionMember {
  avatar?: string;
  id: string;
  title?: string;
}

interface GroupMentionInputProps {
  accessibilityLabel?: string;
  className?: string;
  editable?: boolean;
  members: MentionMember[];
  onChangeText: (text: string) => void;
  onMentionTargetIdChange?: (targetId: string | null) => void;
  placeholder?: string;
  style?: object;
  value: string;
}

export function GroupMentionInput({
  members,
  placeholder,
  value,
  onChangeText,
  onMentionTargetIdChange,
  editable = true,
  accessibilityLabel,
  style,
  className,
}: GroupMentionInputProps) {
  const { t } = useI18n();
  const colors = useThemeColors();
  const inputRef = useRef<RNTextInput>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [mentionStartIndex, setMentionStartIndex] = useState(0);
  const [filter, setFilter] = useState('');

  const mentionOptions = useMemo(() => {
    const filtered =
      filter.trim().length > 0
        ? members.filter(
            (m) =>
              m.title?.toLowerCase().includes(filter.toLowerCase()) ||
              m.id.toLowerCase().includes(filter.toLowerCase()),
          )
        : members;

    return [
      { id: 'ALL_MEMBERS', title: t.groupMentionAllMembers, isAll: true, avatar: undefined },
      ...filtered.map((m) => ({
        avatar: m.avatar,
        id: m.id,
        isAll: false,
        title: m.title || m.id,
      })),
    ];
  }, [members, filter, t.groupMentionAllMembers]);

  const handleChangeText = useCallback(
    (text: string) => {
      onChangeText(text);
      const lastAt = text.lastIndexOf('@');
      if (lastAt >= 0) {
        const afterAt = text.slice(lastAt + 1);
        const spaceIndex = afterAt.indexOf(' ');
        const filterText = spaceIndex >= 0 ? afterAt.slice(0, spaceIndex) : afterAt;
        const hasClosing = filterText.includes('>');
        if (!hasClosing) {
          setMentionStartIndex(lastAt);
          setFilter(filterText);
          setShowPicker(true);
          return;
        }
      }
      setShowPicker(false);
    },
    [onChangeText],
  );

  const handleSelectMention = useCallback(
    (id: string, title: string) => {
      const before = value.slice(0, mentionStartIndex);
      const afterAt = value.slice(mentionStartIndex);
      const restAfter = afterAt.slice(
        afterAt.includes(' ') ? afterAt.indexOf(' ') : afterAt.length,
      );
      const mentionText = MENTION_FORMAT(title, id);
      const newText = `${before}${mentionText} ${restAfter}`.trim();
      onChangeText(newText);
      setShowPicker(false);
      setFilter('');
      onMentionTargetIdChange?.(id === 'ALL_MEMBERS' ? null : id);
    },
    [value, mentionStartIndex, onChangeText, onMentionTargetIdChange],
  );

  const handleClosePicker = useCallback(() => {
    setShowPicker(false);
    setFilter('');
  }, []);

  const parsedMentions = useMemo(() => {
    const mentions: { id: string; name: string }[] = [];
    const re = /<mention\s[^>]*name="([^"]*)"[^>]*id="([^"]+)"[^>]*\/>/g;
    let m;
    while ((m = re.exec(value)) !== null) {
      mentions.push({ id: m[2], name: m[1] || m[2] });
    }
    return mentions;
  }, [value]);

  return (
    <View>
      <TextInput
        multiline
        accessibilityLabel={accessibilityLabel}
        className={className}
        editable={editable}
        placeholder={placeholder}
        placeholderTextColor={colors.secondaryText}
        ref={inputRef}
        style={[{ paddingVertical: 0, textAlignVertical: 'top' }, style]}
        underlineColorAndroid="transparent"
        value={value}
        onChangeText={handleChangeText}
      />
      {parsedMentions.length > 0 ? (
        <View className="mt-1 flex-row flex-wrap gap-1">
          {parsedMentions.map((m, idx) => (
            <View
              key={`mention-${m.id}-${idx}`}
              className="rounded-full px-2 py-0.5 flex-row items-center"
              style={{ backgroundColor: colors.primarySubtle }}
            >
              <Text className="text-[12px] font-medium" style={{ color: colors.primary }}>
                @{m.name}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      <Modal
        accessibilityViewIsModal
        transparent
        animationType="fade"
        visible={showPicker}
        onRequestClose={handleClosePicker}
      >
        <Pressable className="flex-1 justify-end bg-black/40" onPress={handleClosePicker}>
          <Pressable
            className="mx-4 mb-8 max-h-64 rounded-2xl bg-card"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="max-h-64 rounded-2xl bg-card p-2">
              <View className="mb-2 px-2">
                <Text
                className="text-[12px] font-medium"
                style={{ color: colors.secondaryText }}
              >
                {t.groupMentionTitle}
              </Text>
              </View>
              <FlatList
                data={mentionOptions}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <Pressable
                    className="flex-row items-center rounded-xl px-3 py-2.5 active:bg-foreground/5"
                    onPress={() => handleSelectMention(item.id, item.title || item.id)}
                  >
                    {item.isAll ? (
                      <View className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-primary/15">
                        <Users color={colors.primary} size={18} strokeWidth={2} />
                      </View>
                    ) : (
                      <View className="mr-3 h-9 w-9 overflow-hidden rounded-full bg-primary/10">
                        {item.avatar ? (
                          <RNImage className="h-9 w-9" source={{ uri: item.avatar }} />
                        ) : (
                          <View className="h-full w-full items-center justify-center">
                            <Text className="text-[14px] font-semibold text-primary">
                              {(item.title || '#').slice(0, 1).toUpperCase()}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                    <Text className="flex-1 text-[15px] font-medium text-foreground">
                      {item.title}
                    </Text>
                  </Pressable>
                )}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
