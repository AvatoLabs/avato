/**
 * SessionGroupScreen — Manage session groups (create, rename, delete, reorder).
 */
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Edit3,
  Folder,
  Plus,
  Trash,
  Trash2,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import PromptModal from '../components/ui/PromptModal';
import { useI18n } from '../lib/i18n';
import { useSessionStore } from '../store/session';
import { useSessionGroupStore } from '../store/sessionGroup';
import { tokens } from '../theme/tokens';
import type { SessionGroup } from '../types';

export default function SessionGroupScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();

  const groups = useSessionGroupStore((s) => s.groups);
  const fetchGroups = useSessionGroupStore((s) => s.fetchGroups);
  const createGroup = useSessionGroupStore((s) => s.createGroup);
  const removeGroup = useSessionGroupStore((s) => s.removeGroup);
  const renameGroup = useSessionGroupStore((s) => s.renameGroup);
  const removeAll = useSessionGroupStore((s) => s.removeAll);
  const reorderGroup = useSessionGroupStore((s) => s.reorderGroup);

  const sessions = useSessionStore((s) => s.sessions);

  const [promptVisible, setPromptVisible] = useState(false);
  const [promptTitle, setPromptTitle] = useState('');
  const [promptDefault, setPromptDefault] = useState('');
  const [promptPlaceholder, setPromptPlaceholder] = useState('');
  const [promptCallback, setPromptCallback] = useState<((val: string) => void) | null>(null);

  const sessionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of sessions) {
      if (s.groupId) {
        counts[s.groupId] = (counts[s.groupId] || 0) + 1;
      }
    }
    return counts;
  }, [sessions]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const openPrompt = (
    title: string,
    placeholder: string,
    defaultValue: string,
    cb: (val: string) => void,
  ) => {
    setPromptTitle(title);
    setPromptPlaceholder(placeholder);
    setPromptDefault(defaultValue);
    setPromptCallback(() => cb);
    setPromptVisible(true);
  };

  const handleCreate = useCallback(() => {
    openPrompt(t.groupCreate, t.groupCreatePlaceholder, '', async (name) => {
      await createGroup(name);
    });
  }, [t, createGroup]);

  const handleRename = useCallback(
    (group: SessionGroup) => {
      openPrompt(t.groupRename, '', group.name, async (name) => {
        await renameGroup(group.id, name);
      });
    },
    [t, renameGroup],
  );

  const handleDelete = useCallback(
    (group: SessionGroup) => {
      Alert.alert(t.groupDelete, t.groupDeleteConfirm, [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.delete,
          style: 'destructive',
          onPress: () => removeGroup(group.id),
        },
      ]);
    },
    [t, removeGroup],
  );

  const handleRemoveAll = useCallback(() => {
    if (groups.length === 0) return;
    Alert.alert(t.groupDeleteAll, t.groupDeleteAllConfirm, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete,
        style: 'destructive',
        onPress: () => removeAll(),
      },
    ]);
  }, [t, groups.length, removeAll]);

  const renderGroup = ({ item, index }: { item: SessionGroup; index: number }) => {
    const count = sessionCounts[item.id] || 0;
    const isFirst = index === 0;
    const isLast = index === groups.length - 1;

    return (
      <Animated.View entering={FadeInDown.delay(index * 50).duration(250)}>
        <View className="flex-row items-center px-5 py-4 mx-3 mb-2 rounded-xl border border-black/5">
          <View className="w-9 h-9 rounded-full bg-primary/10 items-center justify-center mr-3">
            <Folder color="#007aff" size={18} strokeWidth={tokens.icon.strokeWidth} />
          </View>
          <View className="flex-1">
            <Text className="text-foreground text-[15px] font-medium tracking-tight">
              {item.name}
            </Text>
            <Text className="text-secondary/40 text-[12px] mt-0.5 font-medium">
              {t.groupSessionCount.replace('{count}', String(count))}
            </Text>
          </View>
          <View className="flex-col mr-1">
            <TouchableOpacity
              className="p-1"
              disabled={isFirst}
              style={{ opacity: isFirst ? 0.25 : 1 }}
              onPress={() => reorderGroup(item.id, 'up')}
            >
              <ChevronUp color="#666" size={14} strokeWidth={tokens.icon.strokeWidth} />
            </TouchableOpacity>
            <TouchableOpacity
              className="p-1"
              disabled={isLast}
              style={{ opacity: isLast ? 0.25 : 1 }}
              onPress={() => reorderGroup(item.id, 'down')}
            >
              <ChevronDown color="#666" size={14} strokeWidth={tokens.icon.strokeWidth} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity className="p-2 mr-1" onPress={() => handleRename(item)}>
            <Edit3 color="#666" size={16} strokeWidth={tokens.icon.strokeWidth} />
          </TouchableOpacity>
          <TouchableOpacity className="p-2" onPress={() => handleDelete(item)}>
            <Trash2 color="#ff3b30" size={16} strokeWidth={tokens.icon.strokeWidth} />
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center justify-between px-4 py-2.5">
        <TouchableOpacity
          activeOpacity={0.7}
          className="w-9 h-9 items-center justify-center rounded-full active:bg-foreground/10"
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft color="#111" size={22} strokeWidth={tokens.icon.strokeWidth} />
        </TouchableOpacity>
        <Text className="text-[17px] font-semibold text-foreground">{t.groupTitle}</Text>
        <View className="flex-row items-center">
          {groups.length > 0 && (
            <TouchableOpacity
              activeOpacity={0.7}
              className="w-9 h-9 items-center justify-center rounded-full active:bg-foreground/10 mr-1"
              onPress={handleRemoveAll}
            >
              <Trash color="#ff3b30" size={18} strokeWidth={tokens.icon.strokeWidth} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            activeOpacity={0.7}
            className="w-9 h-9 items-center justify-center rounded-full active:bg-foreground/10"
            onPress={handleCreate}
          >
            <Plus color="#007aff" size={22} strokeWidth={tokens.icon.strokeWidth} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 30 }}
        data={groups}
        keyExtractor={(item) => item.id}
        renderItem={renderGroup}
        ListEmptyComponent={
          <View className="items-center pt-20 px-8">
            <Folder color="#ccc" size={48} strokeWidth={1} />
            <Text className="text-secondary/50 text-[15px] font-medium mt-4">{t.groupEmpty}</Text>
            <Text className="text-secondary/40 text-[13px] mt-1 text-center">
              {t.groupEmptyDesc}
            </Text>
          </View>
        }
      />

      <PromptModal
        defaultValue={promptDefault}
        placeholder={promptPlaceholder}
        submitLabel={t.save}
        title={promptTitle}
        visible={promptVisible}
        onCancel={() => setPromptVisible(false)}
        onSubmit={(val) => {
          setPromptVisible(false);
          promptCallback?.(val);
        }}
      />
    </View>
  );
}
