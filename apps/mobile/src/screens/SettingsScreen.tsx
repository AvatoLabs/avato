/**
 * SettingsScreen — Full settings page with i18n and proper navigation.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ArrowLeft,
  Bot,
  Brain,
  ChevronRight,
  Cloud,
  Database,
  Globe,
  Info,
  Key,
  Mic,
  Palette,
  Server,
  Shield,
  Volume2,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useEffect, useState } from 'react';
import { Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '../components/ui/ScreenHeader';
import { LOCALE_DISPLAY_NAMES, useI18n } from '../lib/i18n';
import { tokens } from '../theme/tokens';

interface SettingsRowProps {
  icon: any;
  iconBg?: string;
  iconColor?: string;
  label: string;
  onPress?: () => void;
  subtitle?: string;
}

function SettingsRow({
  icon: IconComp,
  iconBg = 'bg-foreground/5 dark:bg-white/5',
  iconColor = '#007aff',
  label,
  onPress,
  subtitle,
}: SettingsRowProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.6}
      className="flex-row items-center px-4 py-3.5 mb-1 rounded-2xl active:bg-foreground/5"
      onPress={onPress}
    >
      <View className={`w-8 h-8 rounded-full ${iconBg} items-center justify-center mr-4`}>
        <IconComp color={iconColor} size={16} strokeWidth={tokens.icon.strokeWidth} />
      </View>
      <View className="flex-1">
        <Text className="text-foreground text-[15.5px] font-medium tracking-tight">{label}</Text>
        {subtitle && (
          <Text className="text-secondary/70 text-[12.5px] mt-0.5 font-medium">{subtitle}</Text>
        )}
      </View>
      <ChevronRight color="#c0c0c0" size={18} strokeWidth={tokens.icon.strokeWidth} />
    </TouchableOpacity>
  );
}

function SettingsSection({
  children,
  delay = 0,
  title,
}: {
  children: React.ReactNode;
  delay?: number;
  title: string;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(300)}>
      <View className="mb-5 px-3">
        <Text className="px-2 mb-2 text-secondary/60 text-[12px] font-medium uppercase tracking-wider">
          {title}
        </Text>
        <View>{children}</View>
      </View>
    </Animated.View>
  );
}

export default function SettingsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { t, locale } = useI18n();

  const [defaultModel, setDefaultModel] = useState<string>('');
  useEffect(() => {
    AsyncStorage.getItem('minkhub_default_model').then((v) => {
      if (v) setDefaultModel(v);
    });
  }, []);

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={t.settingsTitle}
        leftElement={
          <ArrowLeft
            color={isDark ? '#fff' : '#111'}
            size={22}
            strokeWidth={tokens.icon.strokeWidth}
          />
        }
        onPressLeft={() => navigation.goBack()}
      />

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40, paddingTop: 16 }}>
        <SettingsSection delay={50} title={t.settingsServer}>
          <SettingsRow
            icon={Server}
            iconColor="#4caf50"
            label={t.settingsServerConfig}
            subtitle={t.settingsServerConfigDesc}
            onPress={() => navigation.navigate('ServerConfig')}
          />
        </SettingsSection>

        <SettingsSection delay={100} title={t.settingsAiConfig}>
          <SettingsRow
            icon={Key}
            iconColor="#e83e8c"
            label={t.settingsAiProviders}
            subtitle={t.settingsAiProvidersDesc}
            onPress={() => navigation.navigate('AIProviders')}
          />
          <SettingsRow
            icon={Brain}
            iconColor="#007aff"
            label={t.settingsDefaultModel}
            subtitle={defaultModel || t.settingsNotConfigured}
            onPress={() => navigation.navigate('ModelPicker')}
          />
          <SettingsRow
            icon={Bot}
            iconColor="#007aff"
            label={t.settingsDefaultAgent}
            subtitle={t.settingsNotConfigured}
            onPress={() => navigation.navigate('AgentDetail', { identifier: 'default' })}
          />
        </SettingsSection>

        <SettingsSection delay={150} title={t.settingsGeneral}>
          <SettingsRow
            icon={Globe}
            iconColor="#f5a623"
            label={t.settingsLanguage}
            subtitle={LOCALE_DISPLAY_NAMES[locale] || locale}
            onPress={() => navigation.navigate('LanguagePicker')}
          />
          <SettingsRow
            icon={Palette}
            iconColor="#9c27b0"
            label={t.settingsTheme}
            subtitle={isDark ? t.themeDark : t.themeLight}
            onPress={() => navigation.navigate('ThemePicker')}
          />
        </SettingsSection>

        <SettingsSection delay={200} title={t.settingsDataStorage}>
          <SettingsRow
            icon={Cloud}
            iconColor="#03a9f4"
            label={t.settingsSyncBackup}
            subtitle={t.dataManageComingSoon}
          />
          <SettingsRow
            icon={Database}
            iconColor="#607d8b"
            label={t.settingsStorageManagement}
            subtitle={t.settingsStorageManagementDesc}
            onPress={() => navigation.navigate('DataManagement')}
          />
        </SettingsSection>

        <SettingsSection delay={250} title={t.settingsVoice}>
          <SettingsRow
            icon={Mic}
            iconColor="#ff5722"
            label={t.settingsSpeechRecognition}
            subtitle={t.dataManageComingSoon}
          />
          <SettingsRow
            icon={Volume2}
            iconColor="#4caf50"
            label={t.settingsTts}
            subtitle={t.dataManageComingSoon}
          />
        </SettingsSection>

        <SettingsSection delay={300} title={t.settingsAbout}>
          <SettingsRow
            icon={Shield}
            iconColor="#34c759"
            label={t.settingsPrivacyPolicy}
            onPress={() => Linking.openURL('https://lobehub.com/privacy')}
          />
          <SettingsRow
            icon={Info}
            iconColor="#8c8c8c"
            label={t.settingsAboutMinkhub}
            subtitle={t.settingsAboutMinkhubDesc}
            onPress={() => navigation.navigate('About')}
          />
        </SettingsSection>
      </ScrollView>
    </View>
  );
}
