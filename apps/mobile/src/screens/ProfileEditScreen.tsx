/**
 * ProfileEditScreen — Full profile settings page aligned with Web.
 *
 * Sections (mirrors web /settings/profile):
 *  - Avatar (with image picker + upload)
 *  - Full Name (editable)
 *  - Username (editable; same rules as server `user.updateUsername`)
 *  - Linked sign-in (read-only list from `user.getUserSSOProviders`)
 *  - Interests (predefined tags + custom)
 *  - Sign-in & security: change email, password reset (Better Auth routes)
 */
import * as ImagePicker from 'expo-image-picker';
import {
  ArrowLeft,
  Briefcase,
  ChartNetwork,
  ChevronRight,
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
  Alert,
  Image as RNImage,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import PressableScale from '../components/ui/PressableScale';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { useToast } from '../components/ui/Toast';
import { userApi } from '../lib/api';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import { useResolvedRemoteAsset } from '../lib/remoteAsset';
import { useUserStore } from '../store/user';
import { useThemeColors } from '../theme/colors';
import { tokens } from '../theme/tokens';
import type { MobileSSOProvider } from '../types';

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

const USERNAME_MAX_LEN = 64;

const isUsernameFormatValid = (value: string) =>
  value.length > 0 && value.length <= USERNAME_MAX_LEN && /^\w+$/.test(value);

const isUsernameConflictError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /USERNAME_TAKEN|CONFLICT/i.test(message);
};

const formatLinkedProviderLabel = (provider: string) =>
  provider.replaceAll(/[_-]+/g, ' ').replaceAll(/\b\w/g, (char) => char.toUpperCase());

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/.test(value.trim());

export default function ProfileEditScreen({ navigation }: any) {
  const { t } = useI18n();
  const toast = useToast();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  const storeProfile = useUserStore((s) => s.profile);
  const userEmail = useUserStore((s) => s.email);
  const fetchUser = useUserStore((s) => s.fetchUser);
  const updateField = useUserStore((s) => s.updateField);
  const isLoaded = useUserStore((s) => s.isLoaded);

  const displayEmail = (userEmail || storeProfile?.email || '').trim();

  const [loading, setLoading] = useState(!isLoaded);
  const [loadError, setLoadError] = useState(false);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customInterest, setCustomInterest] = useState('');

  // Saving states
  const [savingName, setSavingName] = useState(false);
  const [savingUsername, setSavingUsername] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [savingInterests, setSavingInterests] = useState(false);
  const [ssoProviders, setSsoProviders] = useState<MobileSSOProvider[] | null>(null);
  const [changeEmailModalVisible, setChangeEmailModalVisible] = useState(false);
  const [changeEmailValue, setChangeEmailValue] = useState('');
  const [changeEmailSubmitting, setChangeEmailSubmitting] = useState(false);
  const [resetPasswordSubmitting, setResetPasswordSubmitting] = useState(false);
  const trimmedFullName = fullName.trim();
  const trimmedUsername = username.trim();
  const isNameDirty = trimmedFullName !== (storeProfile?.fullName || '').trim();
  const isUsernameDirty = trimmedUsername !== (storeProfile?.username || '').trim();
  const canSaveName = Boolean(trimmedFullName) && isNameDirty && !savingName;
  const canSaveUsername =
    isUsernameDirty && isUsernameFormatValid(trimmedUsername) && !savingUsername;
  const canSaveProfile = canSaveName || canSaveUsername;
  const resolvedAvatarUri = useResolvedRemoteAsset(avatarUri);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (isLoaded) {
        setLoading(false);
        return;
      }
      setLoadError(false);
      try {
        await fetchUser({ throwOnError: true });
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, fetchUser]);

  const handleRetryProfileLoad = useCallback(async () => {
    setLoadError(false);
    setLoading(true);
    try {
      await fetchUser({ throwOnError: true });
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [fetchUser]);

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    void userApi
      .getSSOProviders()
      .then((list) => {
        if (!cancelled) setSsoProviders(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setSsoProviders([]);
      });
    return () => {
      cancelled = true;
    };
  }, [loading]);

  useEffect(() => {
    if (storeProfile) {
      setFullName(storeProfile.fullName || '');
      setUsername(storeProfile.username || '');
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
  const handleSaveName = useCallback(
    async (options?: { quiet?: boolean }) => {
      if (!trimmedFullName || !isNameDirty) return false;

      setSavingName(true);
      try {
        await userApi.updateFullName(trimmedFullName);
        updateField({ fullName: trimmedFullName });
        if (!options?.quiet) toast.show('success', t.profileSaved);
        return true;
      } catch {
        toast.show('error', t.profileSaveFailed || t.errorNetwork);
        return false;
      } finally {
        setSavingName(false);
      }
    },
    [isNameDirty, t, toast, trimmedFullName, updateField],
  );

  const handleSaveUsername = useCallback(
    async (options?: { quiet?: boolean }) => {
      if (!isUsernameDirty) return false;

      if (!trimmedUsername) {
        toast.show('error', t.profileUsernameRequired);
        return false;
      }
      if (!isUsernameFormatValid(trimmedUsername)) {
        toast.show('error', t.profileUsernameRule);
        return false;
      }

      setSavingUsername(true);
      try {
        await userApi.updateUsername(trimmedUsername);
        updateField({ username: trimmedUsername });
        if (!options?.quiet) toast.show('success', t.profileSaved);
        return true;
      } catch (error) {
        if (isUsernameConflictError(error)) {
          toast.show('error', t.profileUsernameDuplicate);
        } else {
          toast.show('error', t.profileSaveFailed || t.errorNetwork);
        }
        return false;
      } finally {
        setSavingUsername(false);
      }
    },
    [isUsernameDirty, t, toast, trimmedUsername, updateField],
  );

  const handleSaveProfile = useCallback(async () => {
    let anyOk = false;
    if (canSaveName && (await handleSaveName({ quiet: true }))) anyOk = true;
    if (canSaveUsername && (await handleSaveUsername({ quiet: true }))) anyOk = true;
    if (anyOk) {
      haptics.success();
      toast.show('success', t.profileSaved);
    }
  }, [canSaveName, canSaveUsername, handleSaveName, handleSaveUsername, t, toast]);

  useEffect(() => {
    if (changeEmailModalVisible) {
      setChangeEmailValue('');
    }
  }, [changeEmailModalVisible]);

  const closeChangeEmailModal = useCallback(() => {
    if (changeEmailSubmitting) return;
    setChangeEmailModalVisible(false);
  }, [changeEmailSubmitting]);

  const handleSubmitChangeEmail = useCallback(async () => {
    const next = changeEmailValue.trim();
    if (!isValidEmail(next)) {
      toast.show('error', t.profileEmailInvalid);
      return;
    }
    if (displayEmail && next.toLowerCase() === displayEmail.toLowerCase()) {
      toast.show('error', t.profileEmailMustDiffer);
      return;
    }

    setChangeEmailSubmitting(true);
    try {
      await userApi.changeEmail(next);
      haptics.success();
      toast.show('success', t.profileEmailChangeSent);
      setChangeEmailModalVisible(false);
      await fetchUser();
    } catch (e) {
      toast.show('error', e instanceof Error ? e.message : t.errorNetwork);
    } finally {
      setChangeEmailSubmitting(false);
    }
  }, [changeEmailValue, displayEmail, fetchUser, t, toast]);

  const handleRequestPasswordReset = useCallback(() => {
    if (!displayEmail || resetPasswordSubmitting) return;
    Alert.alert(
      t.profileSendPasswordReset,
      t.profilePasswordResetConfirm.replace('{email}', displayEmail),
      [
        { style: 'cancel', text: t.cancel },
        {
          text: t.confirm,
          onPress: () => {
            void (async () => {
              setResetPasswordSubmitting(true);
              try {
                await userApi.requestPasswordReset(displayEmail);
                haptics.success();
                toast.show('success', t.profilePasswordResetSent);
              } catch (e) {
                toast.show('error', e instanceof Error ? e.message : t.profilePasswordResetError);
              } finally {
                setResetPasswordSubmitting(false);
              }
            })();
          },
        },
      ],
    );
  }, [displayEmail, resetPasswordSubmitting, t, toast]);

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
          rightAccessibilityHint={t.accessibilityHintSave}
          rightAccessibilityLabel={t.accessibilitySave}
          title={t.profileTitle}
          leftElement={
            <ArrowLeft color={colors.primary} size={22} strokeWidth={tokens.icon.strokeWidth} />
          }
          rightElement={
            <Text
              className="text-[15px] font-medium"
              style={{
                color:
                  canSaveProfile && !savingName && !savingUsername
                    ? colors.primary
                    : colors.secondaryText,
              }}
            >
              {t.save}
            </Text>
          }
          onPressLeft={() => navigation.goBack()}
          onPressRight={
            canSaveProfile && !savingName && !savingUsername ? handleSaveProfile : undefined
          }
        />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </View>
    );
  }

  if (loadError && !storeProfile) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader
          title={t.profileTitle}
          leftElement={
            <ArrowLeft color={colors.primary} size={22} strokeWidth={tokens.icon.strokeWidth} />
          }
          onPressLeft={() => navigation.goBack()}
        />
        <View className="flex-1 justify-center px-8">
          <Text
            className="text-center text-[15px] font-medium"
            style={{ color: colors.foreground }}
          >
            {t.errorNetwork}
          </Text>
          <TouchableOpacity
            accessibilityLabel={t.errorRetry}
            accessibilityRole="button"
            activeOpacity={0.85}
            className="mt-5 self-center rounded-xl px-6 py-3"
            style={{ backgroundColor: colors.primary }}
            onPress={() => {
              haptics.light();
              void handleRetryProfileLoad();
            }}
          >
            <Text className="text-[15px] font-semibold" style={{ color: colors.iconOnPrimary }}>
              {t.errorRetry}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-background"
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 64 : 0}
    >
      <ScreenHeader
        rightAccessibilityHint={t.accessibilityHintSave}
        rightAccessibilityLabel={t.accessibilitySave}
        title={t.profileTitle}
        leftElement={
          <ArrowLeft color={colors.primary} size={22} strokeWidth={tokens.icon.strokeWidth} />
        }
        rightElement={
          <Text
            className="text-[15px] font-medium"
            style={{
              color:
                canSaveProfile && !savingName && !savingUsername
                  ? colors.primary
                  : colors.secondaryText,
            }}
          >
            {t.save}
          </Text>
        }
        onPressLeft={() => navigation.goBack()}
        onPressRight={
          canSaveProfile && !savingName && !savingUsername ? handleSaveProfile : undefined
        }
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
            <Text
              className="text-[12px] font-medium uppercase tracking-wider"
              style={{ color: colors.secondaryText }}
            >
              {t.profileAccount}
            </Text>
          </View>

          <View className="mx-5 bg-foreground/5 rounded-xl overflow-hidden">
            {/* Avatar Row */}
            <TouchableOpacity
              activeOpacity={0.7}
              className="flex-row items-center justify-between px-5 py-4 border-b border-border"
              disabled={savingAvatar}
              onPress={handlePickAvatar}
            >
              <Text className="text-foreground text-[15px] font-medium tracking-tight mr-4">
                {t.profileAvatar}
              </Text>
              <View className="flex-row items-center">
                {savingAvatar ? (
                  <ActivityIndicator color={colors.primary} size="small" />
                ) : resolvedAvatarUri ? (
                  <RNImage className="h-10 w-10 rounded-lg" source={{ uri: resolvedAvatarUri }} />
                ) : (
                  <View className="w-10 h-10 rounded-lg bg-foreground/10 items-center justify-center">
                    <Text
                      className="text-[14px] font-semibold"
                      style={{ color: colors.secondaryText }}
                    >
                      {initials}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>

            {/* Full Name Row */}
            <View className="flex-row items-center justify-between px-5 py-2 border-b border-border">
              <Text className="text-foreground text-[15px] font-medium tracking-tight mr-4">
                {t.profileFullName}
              </Text>
              <View className="flex-row items-center flex-1 justify-end">
                {savingName && (
                  <View className="mr-1.5">
                    <ActivityIndicator color={colors.primary} size="small" />
                  </View>
                )}
                <TextInput
                  autoCapitalize="words"
                  className="text-foreground text-[15px] text-right flex-1"
                  placeholder={t.profileFullName}
                  placeholderTextColor={colors.muted}
                  returnKeyType="done"
                  value={fullName}
                  onChangeText={setFullName}
                  onSubmitEditing={handleSaveProfile}
                />
              </View>
            </View>

            {/* Username Row */}
            <View className="px-5 py-2 pb-3 border-b border-border">
              <Text className="text-foreground text-[15px] font-medium tracking-tight mb-1.5">
                {t.profileUsername}
              </Text>
              <View className="flex-row items-center flex-1 justify-end">
                {savingUsername && (
                  <View className="mr-1.5">
                    <ActivityIndicator color={colors.primary} size="small" />
                  </View>
                )}
                <TextInput
                  autoCapitalize="none"
                  autoComplete="username"
                  autoCorrect={false}
                  className="text-foreground text-[15px] w-full"
                  maxLength={USERNAME_MAX_LEN}
                  placeholder={t.profileUsername}
                  placeholderTextColor={colors.muted}
                  returnKeyType="done"
                  value={username}
                  onChangeText={setUsername}
                  onSubmitEditing={handleSaveProfile}
                />
              </View>
              <Text className="text-[12px] mt-1" style={{ color: colors.secondaryText }}>
                {t.profileUsernameRule}
              </Text>
            </View>

            {/* Linked OAuth / SSO (read-only; aligns with web profile) */}
            {ssoProviders !== null && ssoProviders.length > 0 ? (
              <View className="px-5 py-3 border-b border-border">
                <Text className="text-foreground text-[15px] font-medium tracking-tight mb-1">
                  {t.profileLinkedSignIn}
                </Text>
                <Text className="text-[12px] mb-2" style={{ color: colors.secondaryText }}>
                  {t.profileLinkedSignInHint}
                </Text>
                {ssoProviders.map((account, index) => (
                  <View
                    className={index > 0 ? 'pt-2 mt-2 border-t border-border' : ''}
                    key={`${account.provider}-${account.providerAccountId}-${index}`}
                  >
                    <Text className="text-foreground text-[14px] font-medium">
                      {formatLinkedProviderLabel(account.provider)}
                    </Text>
                    {account.email ? (
                      <Text className="text-[13px] mt-0.5" style={{ color: colors.secondaryText }}>
                        {account.email}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}

            {/* Interests Row */}
            <View className="px-5 py-4 border-b border-border">
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
                      className="flex-row items-center px-3 py-2 rounded-lg border"
                      key={area.key}
                      style={[
                        isSelected
                          ? {
                              backgroundColor: colors.primarySubtle,
                              borderColor: colors.primaryBorder,
                            }
                          : { backgroundColor: colors.fillTertiary, borderColor: 'transparent' },
                        savingInterests && { opacity: 0.6 },
                      ]}
                      onPress={() => !savingInterests && handleToggleInterest(label)}
                    >
                      <View className="mr-1.5">
                        <IconComp
                          color={isSelected ? colors.primary : colors.secondaryText}
                          size={13}
                          strokeWidth={tokens.icon.strokeWidth}
                        />
                      </View>
                      <Text
                        className="text-[13px] font-medium"
                        style={{
                          color: isSelected ? colors.primary : colors.secondaryText,
                        }}
                      >
                        {label}
                      </Text>
                    </PressableScale>
                  );
                })}
                {customInterests.map((interest) => (
                  <PressableScale
                    className="flex-row items-center px-3 py-2 rounded-lg border"
                    key={interest}
                    style={[
                      { backgroundColor: colors.primarySubtle, borderColor: colors.primaryBorder },
                      savingInterests && { opacity: 0.6 },
                    ]}
                    onPress={() => !savingInterests && handleToggleInterest(interest)}
                  >
                    <Text className="text-[13px] font-medium" style={{ color: colors.primary }}>
                      {interest}
                    </Text>
                  </PressableScale>
                ))}
                <PressableScale
                  className="flex-row items-center px-3 py-2 rounded-lg border"
                  style={
                    showCustomInput
                      ? { backgroundColor: colors.primarySubtle, borderColor: colors.primaryBorder }
                      : { backgroundColor: colors.fillTertiary, borderColor: 'transparent' }
                  }
                  onPress={() => setShowCustomInput(!showCustomInput)}
                >
                  <View className="mr-1.5">
                    <Briefcase
                      color={showCustomInput ? colors.primary : colors.secondaryText}
                      size={13}
                      strokeWidth={tokens.icon.strokeWidth}
                    />
                  </View>
                  <Text
                    className="text-[13px] font-medium"
                    style={{
                      color: showCustomInput ? colors.primary : colors.secondaryText,
                    }}
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
                    placeholderTextColor={colors.muted}
                    returnKeyType="done"
                    value={customInterest}
                    onChangeText={setCustomInterest}
                    onSubmitEditing={handleAddCustomInterest}
                  />
                </View>
              )}
            </View>
          </View>

          {/* Sign-in & security */}
          <View className="px-5 pt-6 pb-2">
            <Text
              className="text-[12px] font-medium uppercase tracking-wider"
              style={{ color: colors.secondaryText }}
            >
              {t.profileSecurity}
            </Text>
          </View>
          <View className="mx-5 bg-foreground/5 rounded-xl overflow-hidden mb-4">
            <View className="flex-row items-center justify-between px-5 py-3 border-b border-border">
              <Text className="text-foreground text-[15px] font-medium tracking-tight mr-3 shrink-0">
                {t.profileEmailDisplay}
              </Text>
              <Text
                className="text-foreground text-[14px] text-right flex-1"
                numberOfLines={2}
                style={{ color: displayEmail ? colors.foreground : colors.secondaryText }}
              >
                {displayEmail || t.profileEmailMissing}
              </Text>
            </View>
            {displayEmail ? (
              <>
                <TouchableOpacity
                  activeOpacity={0.7}
                  className="flex-row items-center justify-between px-5 py-3.5 border-b border-border"
                  onPress={() => setChangeEmailModalVisible(true)}
                >
                  <Text className="text-foreground text-[15px] font-medium">
                    {t.profileChangeEmailAction}
                  </Text>
                  <ChevronRight
                    color={colors.secondaryText}
                    size={18}
                    strokeWidth={tokens.icon.strokeWidth}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.7}
                  className="flex-row items-center justify-between px-5 py-3.5"
                  disabled={resetPasswordSubmitting}
                  style={resetPasswordSubmitting ? { opacity: 0.55 } : undefined}
                  onPress={handleRequestPasswordReset}
                >
                  <Text className="text-foreground text-[15px] font-medium">
                    {t.profileSendPasswordReset}
                  </Text>
                  {resetPasswordSubmitting ? (
                    <ActivityIndicator color={colors.primary} size="small" />
                  ) : (
                    <ChevronRight
                      color={colors.secondaryText}
                      size={18}
                      strokeWidth={tokens.icon.strokeWidth}
                    />
                  )}
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </Animated.View>
      </ScrollView>

      <Modal
        transparent
        animationType="fade"
        visible={changeEmailModalVisible}
        onRequestClose={closeChangeEmailModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1 justify-center px-5"
          style={{ backgroundColor: colors.modalOverlay }}
        >
          <Pressable className="flex-1 w-full justify-center px-0" onPress={closeChangeEmailModal}>
            <View onStartShouldSetResponder={() => true}>
              <View className="rounded-2xl border border-border bg-background p-5">
                <Text className="text-foreground text-[17px] font-semibold mb-3">
                  {t.profileChangeEmailTitle}
                </Text>
                <TextInput
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect={false}
                  className="rounded-xl border border-border bg-foreground/5 px-3 py-3 text-[15px] text-foreground"
                  editable={!changeEmailSubmitting}
                  keyboardType="email-address"
                  placeholder={t.profileEmailPlaceholder}
                  placeholderTextColor={colors.muted}
                  returnKeyType="done"
                  value={changeEmailValue}
                  onChangeText={setChangeEmailValue}
                  onSubmitEditing={handleSubmitChangeEmail}
                />
                <View className="mt-4 flex-row justify-end gap-4">
                  <TouchableOpacity
                    disabled={changeEmailSubmitting}
                    onPress={closeChangeEmailModal}
                  >
                    <Text
                      className="text-[15px] font-medium"
                      style={{ color: colors.secondaryText }}
                    >
                      {t.cancel}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    disabled={changeEmailSubmitting}
                    onPress={handleSubmitChangeEmail}
                  >
                    {changeEmailSubmitting ? (
                      <ActivityIndicator color={colors.primary} size="small" />
                    ) : (
                      <Text className="text-[15px] font-medium" style={{ color: colors.primary }}>
                        {t.confirm}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}
