/**
 * SessionGroupScreen — Manage session groups (create, rename, delete).
 */
import { ArrowLeft, Edit3, Folder, Plus, Trash2 } from 'lucide-react-native';
import React, { useCallback, useEffect } from 'react';
import { Alert, FlatList, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '../lib/i18n';
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

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const handleCreate = useCallback(() => {
    Alert.prompt(
      t.groupCreate,
      undefined,
      async (name) => {
        if (name?.trim()) {
          await createGroup(name.trim());
        }
      },
      'plain-text',
      '',
      t.groupCreatePlaceholder,
    );
  }, [t, createGroup]);

  const handleRename = useCallback(
    (group: SessionGroup) => {
      Alert.prompt(
        t.groupRename,
        undefined,
        async (name) => {
          if (name?.trim()) {
            await renameGroup(group.id, name.trim());
          }
        },
        'plain-text',
        group.name,
      );
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

  const renderGroup = ({ item, index }: { item: SessionGroup; index: number }) => (
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
            {new Date(item.createdAt).toLocaleDateString()}
          </Text>
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

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-2.5">
        <TouchableOpacity
          activeOpacity={0.7}
          className="w-9 h-9 items-center justify-center rounded-full active:bg-foreground/10"
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft color="#111" size={22} strokeWidth={tokens.icon.strokeWidth} />
        </TouchableOpacity>
        <Text className="text-[17px] font-semibold text-foreground">{t.groupTitle}</Text>
        <TouchableOpacity
          activeOpacity={0.7}
          className="w-9 h-9 items-center justify-center rounded-full active:bg-foreground/10"
          onPress={handleCreate}
        >
          <Plus color="#007aff" size={22} strokeWidth={tokens.icon.strokeWidth} />
        </TouchableOpacity>
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
    </View>
  );
}
