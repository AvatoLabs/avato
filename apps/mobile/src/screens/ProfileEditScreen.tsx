/**
 * ProfileEditScreen — Full profile settings page aligned with Web.
 *
 * Sections (mirrors web /settings/profile):
 *  - Avatar (with image picker + upload)
 *  - Full Name (editable)
 *  - Username (editable with validation)
 *  - Interests (predefined tags + custom)
 *  - Password (reset via email)
 *  - Email (editable with validation)
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
import { userApi } from '../lib/api';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
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

const EMAIL_REGEX = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

export default function ProfileEditScreen({ navigation }: any) {
  const { t } = useI18n();
  const toast = useToast();

  const storeProfile = useUserStore((s) => s.profile);
  const fetchUser = useUserStore((s) => s.fetchUser);
  const updateField = useUserStore((s) => s.updateField);
  const isLoaded = useUserStore((s) => s.isLoaded);

  const [loading, setLoading] = useState(!isLoaded);
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
  const [savingPassword, setSavingPassword] = useState(false);
  const [usernameError, setUsernameError] = useState('');

  // Email editing state
  const [editingEmail, setEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);

  useEffect(() => {
    if (!isLoaded) {
      fetchUser().finally(() => setLoading(false));
    }
  }, [isLoaded, fetchUser]);

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
      await userApi.uploadAvatar(asset.uri, mimeType);
      setAvatarUri(asset.uri);
      haptics.success();
      toast.show('success', t.profileSaved);
    } catch {
      toast.show('error', t.fileUploadError);
    } finally {
      setSavingAvatar(false);
    }
  };

  // ── Save full name (on blur) ───────────────────────────────────
  const handleSaveName = async () => {
    const trimmed = fullName.trim();
    if (!trimmed || trimmed === (storeProfile?.fullName || '')) return;

    setSavingName(true);
    try {
      await userApi.updateFullName(trimmed);
      updateField({ fullName: trimmed });
    } catch {
      toast.show('error', t.errorNetwork);
    } finally {
      setSavingName(false);
    }
  };

  // ── Save username (on blur) ─────────────────────────────────────
  const usernameRegex = /^\w+$/;

  const handleSaveUsername = async () => {
    const trimmed = username.trim();
    if (!trimmed || trimmed === (storeProfile?.username || '')) {
      setUsernameError('');
      return;
    }

    if (trimmed.length > 64 || !usernameRegex.test(trimmed)) {
      setUsernameError(t.profileUsernameRule);
      return;
    }

    setSavingUsername(true);
    setUsernameError('');
    try {
      await userApi.updateUsername(trimmed);
      updateField({ username: trimmed });
    } catch (err: any) {
      if (err?.message?.includes('CONFLICT') || err?.message?.includes('TAKEN')) {
        setUsernameError(t.profileUsernameDuplicate);
      } else {
        toast.show('error', t.errorNetwork);
      }
    } finally {
      setSavingUsername(false);
    }
  };

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

  // ── Password reset ──────────────────────────────────────────────
  const handlePasswordReset = async () => {
    const email = storeProfile?.email;
    if (!email) return;

    setSavingPassword(true);
    try {
      await userApi.requestPasswordReset(email);
      haptics.success();
      toast.show('success', t.profilePasswordResetSent);
    } catch {
      toast.show('error', t.profilePasswordResetError);
    } finally {
      setSavingPassword(false);
    }
  };

  // ── Email change ────────────────────────────────────────────────
  const handleStartEmailEdit = () => {
    setNewEmail('');
    setEmailError('');
    setEditingEmail(true);
  };

  const handleCancelEmailEdit = () => {
    setEditingEmail(false);
    setNewEmail('');
    setEmailError('');
  };

  const handleSaveEmail = async () => {
    const trimmed = newEmail.trim();
    if (!trimmed) return;

    if (!EMAIL_REGEX.test(trimmed)) {
      setEmailError(t.profileEmailInvalid);
      return;
    }

    setSavingEmail(true);
    setEmailError('');
    try {
      await userApi.changeEmail(trimmed);
      setEditingEmail(false);
      haptics.success();
      toast.show('success', t.profileEmailChangeSent);
    } catch (err: any) {
      setEmailError(err?.message || t.errorNetwork);
    } finally {
      setSavingEmail(false);
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

  const initials = (fullName || username || storeProfile?.email || 'U').slice(0, 2).toUpperCase();

  if (loading) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader
          leftElement={<ArrowLeft color="#111" size={22} strokeWidth={tokens.icon.strokeWidth} />}
          title={t.profileTitle}
          onPressLeft={() => navigation.goBack()}
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
        leftElement={<ArrowLeft color="#111" size={22} strokeWidth={tokens.icon.strokeWidth} />}
        title={t.profileTitle}
        onPressLeft={() => navigation.goBack()}
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
                ) : avatarUri ? (
                  <RNImage
                    source={{ uri: avatarUri }}
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
                  placeholderTextColor="#8c8c8c"
                  returnKeyType="done"
                  value={fullName}
                  onBlur={handleSaveName}
                  onChangeText={setFullName}
                  onSubmitEditing={handleSaveName}
                />
              </View>
            </View>

            {/* Username Row */}
            <View className="border-b border-black/[0.03]">
              <View className="flex-row items-center justify-between px-4 py-1.5">
                <Text className="text-foreground text-[15px] font-medium tracking-tight mr-4">
                  {t.profileUsername}
                </Text>
                <View className="flex-row items-center flex-1 justify-end">
                  {savingUsername && (
                    <ActivityIndicator color="#007aff" size="small" style={{ marginRight: 6 }} />
                  )}
                  <TextInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    className={`text-[15px] text-right flex-1 ${usernameError ? 'text-red-500' : 'text-foreground'}`}
                    placeholder={t.profileUsername}
                    placeholderTextColor="#8c8c8c"
                    returnKeyType="done"
                    value={username}
                    onBlur={handleSaveUsername}
                    onSubmitEditing={handleSaveUsername}
                    onChangeText={(v) => {
                      setUsername(v);
                      if (usernameError) setUsernameError('');
                    }}
                  />
                </View>
              </View>
              {usernameError ? (
                <Text className="text-red-500 text-[11px] font-medium px-4 pb-2">
                  {usernameError}
                </Text>
              ) : null}
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
                    placeholderTextColor="#8c8c8c"
                    returnKeyType="done"
                    value={customInterest}
                    onChangeText={setCustomInterest}
                    onSubmitEditing={handleAddCustomInterest}
                  />
                </View>
              )}
            </View>

            {/* Password Row */}
            {storeProfile?.email && (
              <View className="flex-row items-center justify-between px-4 py-3.5 border-b border-black/[0.03]">
                <Text className="text-foreground text-[15px] font-medium tracking-tight">
                  {t.profilePassword}
                </Text>
                <TouchableOpacity
                  activeOpacity={0.7}
                  className="bg-foreground/5 px-4 py-2 rounded-lg"
                  disabled={savingPassword}
                  onPress={handlePasswordReset}
                >
                  {savingPassword ? (
                    <ActivityIndicator color="#007aff" size="small" />
                  ) : (
                    <Text className="text-primary text-[13px] font-medium">
                      {t.profileChangePassword}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* Email Row (editable) */}
            {storeProfile?.email && (
              <View className="border-b border-black/[0.03]">
                <View className="flex-row items-center justify-between px-4 py-3.5">
                  <Text className="text-foreground text-[15px] font-medium tracking-tight">
                    {t.profileEmail}
                  </Text>
                  {!editingEmail ? (
                    <View className="flex-row items-center gap-3">
                      <Text className="text-secondary/60 text-[14px]">{storeProfile.email}</Text>
                      <TouchableOpacity activeOpacity={0.7} onPress={handleStartEmailEdit}>
                        <Text className="text-primary text-[13px] font-medium">
                          {t.profileUpdateEmail}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
                {editingEmail && (
                  <View className="px-4 pb-3">
                    <View className="bg-background rounded-xl px-3 h-10 justify-center mb-2">
                      <TextInput
                        autoFocus
                        autoCapitalize="none"
                        autoCorrect={false}
                        className={`text-[14px] ${emailError ? 'text-red-500' : 'text-foreground'}`}
                        keyboardType="email-address"
                        placeholder={t.profileEmailPlaceholder}
                        placeholderTextColor="#8c8c8c"
                        returnKeyType="done"
                        value={newEmail}
                        onSubmitEditing={handleSaveEmail}
                        onChangeText={(v) => {
                          setNewEmail(v);
                          if (emailError) setEmailError('');
                        }}
                      />
                    </View>
                    {emailError ? (
                      <Text className="text-red-500 text-[11px] font-medium mb-2">
                        {emailError}
                      </Text>
                    ) : null}
                    <View className="flex-row justify-end gap-2">
                      <TouchableOpacity
                        activeOpacity={0.7}
                        className="bg-foreground/5 px-4 py-2 rounded-lg"
                        disabled={savingEmail}
                        onPress={handleCancelEmailEdit}
                      >
                        <Text className="text-foreground/70 text-[13px] font-medium">
                          {t.cancel}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        className="bg-primary px-4 py-2 rounded-lg"
                        disabled={savingEmail}
                        onPress={handleSaveEmail}
                      >
                        {savingEmail ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <Text className="text-white text-[13px] font-medium">{t.save}</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}
