/**
 * ProfileEditScreen — Full profile settings page aligned with Web.
 *
 * Sections (mirrors web /settings/profile):
 *  - Avatar (with image picker + upload)
 *  - Full Name (editable)
 *  - Interests (predefined tags + custom)
 *  - Account identity is managed by Feishu SSO
 */
import * as ImagePicker from 'expo-image-picker';
import {
  ArrowLeft,
  Briefcase,
  ChartNetwork,
  Code2,
  GraduationCap,
  HandCoins,
  PaintBucket,
  Pen,
  Target,
  TrendingUp,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image as RNImage,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import PressableScale from '../components/ui/PressableScale';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { useToast } from '../components/ui/Toast';
import { semanticColors } from '../constants/colors';
import { userApi } from '../lib/api';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import { useResolvedRemoteAsset } from '../lib/remoteAsset';
import { useUserStore } from '../store/user';
import { tokens } from '../theme/tokens';

const INTEREST_AREAS: {
  icon: React.ComponentType<any>;
  key: string;
  labelKey: keyof typeof INTEREST_LABEL_MAP;
}[] = [
  { icon: Pen, key: 'writing', labelKey: 'writing' },
  { icon: Code2, key: 'coding', labelKey: 'coding' },
  { icon: PaintBucket, key: 'design', labelKey: 'design' },
  { icon: GraduationCap, key: 'education', labelKey: 'education' },
  { icon: ChartNetwork, key: 'business', labelKey: 'business' },
  { icon: TrendingUp, key: 'marketing', labelKey: 'marketing' },
  { icon: Target, key: 'product', labelKey: 'product' },
  { icon: HandCoins, key: 'sales', labelKey: 'sales' },
];

const INTEREST_LABEL_MAP = {
  writing: 'profileInterestsWriting',
  coding: 'profileInterestsCoding',
  design: 'profileInterestsDesign',
  education: 'profileInterestsEducation',
  business: 'profileInterestsBusiness',
  marketing: 'profileInterestsMarketing',
  product: 'profileInterestsProduct',
  sales: 'profileInterestsSales',
} as const;

export default function ProfileEditScreen({ navigation }: any) {
  const { t } = useI18n();
  const toast = useToast();

  const storeProfile = useUserStore((s) => s.profile);
  const fetchUser = useUserStore((s) => s.fetchUser);
  const updateField = useUserStore((s) => s.updateField);
  const isLoaded = useUserStore((s) => s.isLoaded);

  const [loading, setLoading] = useState(!isLoaded);
  const [fullName, setFullName] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customInterest, setCustomInterest] = useState('');

  // Saving states
  const [savingName, setSavingName] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [savingInterests, setSavingInterests] = useState(false);
  const trimmedFullName = fullName.trim();
  const isNameDirty = trimmedFullName !== (storeProfile?.fullName || '').trim();
  const canSaveProfile = Boolean(trimmedFullName) && isNameDirty && !savingName;
  const resolvedAvatarUri = useResolvedRemoteAsset(avatarUri);

  useEffect(() => {
    if (!isLoaded) {
      fetchUser().finally(() => setLoading(false));
    }
  }, [isLoaded, fetchUser]);

  useEffect(() => {
    if (storeProfile) {
      setFullName(storeProfile.fullName || '');
      setInterests(storeProfile.interests || []);
      setAvatarUri(storeProfile.avatar || null);
    }
  }, [storeProfile]);

  // ── Avatar pick & upload ────────────────────────────────────────
  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images' as ImagePicker.MediaType,
      allowsEditing: true,
      quality: 0.8,
    } as any);

    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];

    setSavingAvatar(true);
    try {
      const mimeType = asset.mimeType || 'image/jpeg';
      const uploadedAvatar = await userApi.uploadAvatar(asset.uri, mimeType);
      updateField({ avatar: uploadedAvatar });
      setAvatarUri(uploadedAvatar);
      void fetchUser();
      haptics.success();
      toast.show('success', t.profileSaved);
    } catch {
      toast.show('error', t.fileUploadError);
    } finally {
      setSavingAvatar(false);
    }
  };

  // ── Save full name ───────────────────────────────────────────────
  const handleSaveName = useCallback(async () => {
    if (!trimmedFullName || !isNameDirty) return false;

    setSavingName(true);
    try {
      await userApi.updateFullName(trimmedFullName);
      updateField({ fullName: trimmedFullName });
      toast.show('success', t.profileSaved);
      return true;
    } catch {
      toast.show('error', t.profileSaveFailed || t.errorNetwork);
      return false;
    } finally {
      setSavingName(false);
    }
  }, [isNameDirty, t, toast, trimmedFullName, updateField]);

  const handleSaveProfile = useCallback(async () => {
    await handleSaveName();
  }, [handleSaveName]);

  // ── Toggle interest ─────────────────────────────────────────────
  const handleToggleInterest = async (label: string) => {
    const updated = interests.includes(label)
      ? interests.filter((i) => i !== label)
      : [...interests, label];

    setInterests(updated);
    setSavingInterests(true);
    try {
      await userApi.updateInterests(updated);
      updateField({ interests: updated });
    } catch {
      setInterests(interests);
      toast.show('error', t.errorNetwork);
    } finally {
      setSavingInterests(false);
    }
  };

  const handleAddCustomInterest = async () => {
    const trimmed = customInterest.trim();
    if (!trimmed || interests.includes(trimmed)) return;

    const updated = [...interests, trimmed];
    setCustomInterest('');
    setInterests(updated);
    setSavingInterests(true);
    try {
      await userApi.updateInterests(updated);
      updateField({ interests: updated });
    } catch {
      setInterests(interests);
      toast.show('error', t.errorNetwork);
    } finally {
      setSavingInterests(false);
    }
  };

  // ── Get translated interest label ──────────────────────────────
  const getInterestLabel = useCallback(
    (key: string): string => {
      const k = INTEREST_LABEL_MAP[key as keyof typeof INTEREST_LABEL_MAP];
      return k ? (t as any)[k] : key;
    },
    [t],
  );

  const predefinedLabels = INTEREST_AREAS.map((a) => getInterestLabel(a.key));
  const customInterests = interests.filter((i) => !predefinedLabels.includes(i));

  const initials = (fullName || storeProfile?.email || 'U').slice(0, 2).toUpperCase();

  if (loading) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader
          rightAccessibilityLabel={t.accessibilitySave}
          title={t.profileTitle}
          leftElement={
            <ArrowLeft
              color={semanticColors.primary}
              size={22}
              strokeWidth={tokens.icon.strokeWidth}
            />
          }
          rightElement={
            <Text
              className="text-[15px] font-medium"
              style={{ color: canSaveProfile ? '#007aff' : 'rgba(0,122,255,0.35)' }}
            >
              {t.save}
            </Text>
          }
          onPressLeft={() => navigation.goBack()}
          onPressRight={canSaveProfile ? handleSaveProfile : undefined}
        />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#007aff" size="large" />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        rightAccessibilityLabel={t.accessibilitySave}
        title={t.profileTitle}
        leftElement={
          <ArrowLeft
            color={semanticColors.primary}
            size={22}
            strokeWidth={tokens.icon.strokeWidth}
          />
        }
        rightElement={
          <Text
            className="text-[15px] font-medium"
            style={{ color: canSaveProfile ? '#007aff' : 'rgba(0,122,255,0.35)' }}
          >
            {t.save}
          </Text>
        }
        onPressLeft={() => navigation.goBack()}
        onPressRight={canSaveProfile ? handleSaveProfile : undefined}
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Section: Account */}
        <Animated.View entering={FadeInDown.duration(250)}>
          <View className="px-5 pt-4 pb-2">
            <Text className="text-secondary/60 text-[12px] font-medium uppercase tracking-wider">
              {t.profileAccount}
            </Text>
          </View>

          <View className="mx-5 bg-foreground/5 rounded-2xl overflow-hidden">
            {/* Avatar Row */}
            <TouchableOpacity
              activeOpacity={0.7}
              className="flex-row items-center justify-between px-4 py-4 border-b border-black/[0.03]"
              disabled={savingAvatar}
              onPress={handlePickAvatar}
            >
              <Text className="text-foreground text-[15px] font-medium tracking-tight">
                {t.profileAvatar}
              </Text>
              <View className="flex-row items-center">
                <Text className="text-primary text-[12px] font-medium mr-2">
                  {t.profileChangePhoto}
                </Text>
                {savingAvatar ? (
                  <ActivityIndicator color="#007aff" size="small" />
                ) : resolvedAvatarUri ? (
                  <RNImage
                    source={{ uri: resolvedAvatarUri }}
                    style={{ width: 40, height: 40, borderRadius: 8 }}
                  />
                ) : (
                  <View className="w-10 h-10 rounded-lg bg-foreground/10 items-center justify-center">
                    <Text className="text-foreground/60 text-[14px] font-semibold">{initials}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>

            {/* Full Name Row */}
            <View className="flex-row items-center justify-between px-4 py-1.5 border-b border-black/[0.03]">
              <Text className="text-foreground text-[15px] font-medium tracking-tight mr-4">
                {t.profileFullName}
              </Text>
              <View className="flex-row items-center flex-1 justify-end">
                {savingName && (
                  <ActivityIndicator color="#007aff" size="small" style={{ marginRight: 6 }} />
                )}
                <TextInput
                  autoCapitalize="words"
                  className="text-foreground text-[15px] text-right flex-1"
                  placeholder={t.profileFullName}
                  placeholderTextColor={semanticColors.muted}
                  returnKeyType="done"
                  value={fullName}
                  onChangeText={setFullName}
                  onSubmitEditing={handleSaveProfile}
                />
              </View>
            </View>

            {/* Interests Row */}
            <View className="px-4 py-4 border-b border-black/[0.03]">
              <Text className="text-foreground text-[15px] font-medium tracking-tight mb-3">
                {t.profileInterests}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {INTEREST_AREAS.map((area) => {
                  const label = getInterestLabel(area.key);
                  const isSelected = interests.includes(label);
                  const IconComp = area.icon;
                  return (
                    <PressableScale
                      key={area.key}
                      style={savingInterests ? { opacity: 0.6 } : undefined}
                      className={`flex-row items-center px-3 py-2 rounded-lg border ${
                        isSelected
                          ? 'bg-primary/10 border-primary/20'
                          : 'bg-foreground/5 border-transparent'
                      }`}
                      onPress={() => !savingInterests && handleToggleInterest(label)}
                    >
                      <IconComp
                        color={isSelected ? '#007aff' : '#999'}
                        size={13}
                        strokeWidth={tokens.icon.strokeWidth}
                        style={{ marginRight: 5 }}
                      />
                      <Text
                        className={`text-[13px] font-medium ${
                          isSelected ? 'text-primary' : 'text-foreground/70'
                        }`}
                      >
                        {label}
                      </Text>
                    </PressableScale>
                  );
                })}
                {customInterests.map((interest) => (
                  <PressableScale
                    className="flex-row items-center px-3 py-2 rounded-lg bg-primary/10 border border-primary/20"
                    key={interest}
                    style={savingInterests ? { opacity: 0.6 } : undefined}
                    onPress={() => !savingInterests && handleToggleInterest(interest)}
                  >
                    <Text className="text-[13px] font-medium text-primary">{interest}</Text>
                  </PressableScale>
                ))}
                <PressableScale
                  className={`flex-row items-center px-3 py-2 rounded-lg border ${
                    showCustomInput
                      ? 'bg-primary/10 border-primary/20'
                      : 'bg-foreground/5 border-transparent'
                  }`}
                  onPress={() => setShowCustomInput(!showCustomInput)}
                >
                  <Briefcase
                    color={showCustomInput ? '#007aff' : '#999'}
                    size={13}
                    strokeWidth={tokens.icon.strokeWidth}
                    style={{ marginRight: 5 }}
                  />
                  <Text
                    className={`text-[13px] font-medium ${
                      showCustomInput ? 'text-primary' : 'text-foreground/70'
                    }`}
                  >
                    {t.profileInterestsOther}
                  </Text>
                </PressableScale>
              </View>
              {showCustomInput && (
                <View className="flex-row items-center mt-3 bg-background rounded-xl px-3 h-10">
                  <TextInput
                    autoFocus
                    className="flex-1 text-foreground text-[14px]"
                    placeholder={t.profileInterestsCustomPlaceholder}
                    placeholderTextColor={semanticColors.muted}
                    returnKeyType="done"
                    value={customInterest}
                    onChangeText={setCustomInterest}
                    onSubmitEditing={handleAddCustomInterest}
                  />
                </View>
              )}
            </View>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}
