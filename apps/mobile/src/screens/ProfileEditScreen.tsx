/**
 * ProfileEditScreen — Edit user profile (name, username, bio).
 */
import { ArrowLeft, Camera, Check } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useToast } from '../components/ui/Toast';
import { userApi } from '../lib/api';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import { tokens } from '../theme/tokens';

export default function ProfileEditScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { t } = useI18n();
  const toast = useToast();

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await userApi.updateProfile({
        fullName: fullName.trim() || undefined,
        username: username.trim() || undefined,
        bio: bio.trim() || undefined,
      });
      haptics.success();
      toast.show('success', t.profileSaved);
      navigation.goBack();
    } catch {
      haptics.warning();
      toast.show('error', t.profileSaveFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-2.5">
        <TouchableOpacity
          activeOpacity={0.7}
          className="w-9 h-9 items-center justify-center rounded-full active:bg-foreground/10"
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft
            color={isDark ? '#fff' : '#111'}
            size={22}
            strokeWidth={tokens.icon.strokeWidth}
          />
        </TouchableOpacity>
        <Text className="text-[17px] font-semibold text-foreground">{t.profileEdit}</Text>
        <TouchableOpacity
          activeOpacity={0.7}
          className="w-9 h-9 items-center justify-center rounded-full active:bg-foreground/10"
          disabled={saving}
          onPress={handleSave}
        >
          <Check color="#007aff" size={22} strokeWidth={tokens.icon.strokeWidth} />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {/* Avatar placeholder */}
        <Animated.View entering={FadeInDown.delay(50).duration(300)}>
          <View className="items-center mb-8">
            <View className="w-24 h-24 rounded-full bg-primary/10 items-center justify-center">
              <Camera color="#007aff" size={32} strokeWidth={tokens.icon.strokeWidth} />
            </View>
            <Text className="text-primary text-[13px] font-medium mt-2">
              {t.profileChangePhoto}
            </Text>
          </View>
        </Animated.View>

        {/* Fields */}
        <Animated.View entering={FadeInDown.delay(100).duration(300)}>
          <Text className="text-secondary/60 text-[12px] font-medium uppercase tracking-wider mb-2 px-1">
            {t.profileFullName}
          </Text>
          <View className="bg-foreground/5 dark:bg-white/5 rounded-xl px-4 py-3 mb-5">
            <TextInput
              className="text-foreground text-[16px]"
              placeholder={t.profileFullName}
              placeholderTextColor={isDark ? '#636366' : '#8c8c8c'}
              value={fullName}
              onChangeText={setFullName}
            />
          </View>

          <Text className="text-secondary/60 text-[12px] font-medium uppercase tracking-wider mb-2 px-1">
            {t.profileUsername}
          </Text>
          <View className="bg-foreground/5 dark:bg-white/5 rounded-xl px-4 py-3 mb-5">
            <TextInput
              autoCapitalize="none"
              className="text-foreground text-[16px]"
              placeholder={t.profileUsername}
              placeholderTextColor={isDark ? '#636366' : '#8c8c8c'}
              value={username}
              onChangeText={setUsername}
            />
          </View>

          <Text className="text-secondary/60 text-[12px] font-medium uppercase tracking-wider mb-2 px-1">
            {t.profileBio}
          </Text>
          <View className="bg-foreground/5 dark:bg-white/5 rounded-xl px-4 py-3 mb-5">
            <TextInput
              multiline
              className="text-foreground text-[16px] min-h-[80px]"
              placeholder={t.profileBio}
              placeholderTextColor={isDark ? '#636366' : '#8c8c8c'}
              style={{ textAlignVertical: 'top' }}
              value={bio}
              onChangeText={setBio}
            />
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}
