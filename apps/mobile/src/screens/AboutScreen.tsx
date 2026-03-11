/**
 * AboutScreen — App info, version, links, and credits.
 */
import { ArrowLeft, ExternalLink, Github, Heart } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React from 'react';
import { Image as RNImage, Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import PressableScale from '../components/ui/PressableScale';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import { tokens } from '../theme/tokens';

const APP_VERSION = '1.0.0';

function LinkRow({
  icon: IconComp,
  iconColor,
  label,
  url,
  isDark,
}: {
  icon: any;
  iconColor: string;
  isDark: boolean;
  label: string;
  url: string;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.6}
      className="flex-row items-center px-4 py-3.5 mb-1 rounded-2xl active:bg-foreground/5"
      onPress={() => {
        haptics.light();
        Linking.openURL(url);
      }}
    >
      <View className="w-8 h-8 rounded-full bg-foreground/5 dark:bg-white/5 items-center justify-center mr-4">
        <IconComp color={iconColor} size={16} strokeWidth={tokens.icon.strokeWidth} />
      </View>
      <Text className="flex-1 text-foreground text-[15.5px] font-medium tracking-tight">
        {label}
      </Text>
      <ExternalLink
        color={isDark ? '#636366' : '#c0c0c0'}
        size={16}
        strokeWidth={tokens.icon.strokeWidth}
      />
    </TouchableOpacity>
  );
}

export default function AboutScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { t } = useI18n();

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-2.5">
        <PressableScale
          className="w-9 h-9 items-center justify-center rounded-full"
          onPress={() => {
            haptics.light();
            navigation.goBack();
          }}
        >
          <ArrowLeft
            color={isDark ? '#fff' : '#111'}
            size={22}
            strokeWidth={tokens.icon.strokeWidth}
          />
        </PressableScale>
        <Text className="text-[17px] font-semibold text-foreground">{t.meAbout}</Text>
        <View className="w-9 h-9" />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 60, alignItems: 'center' }}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo + Name */}
        <Animated.View
          className="items-center mt-10 mb-6"
          entering={FadeInDown.delay(50).duration(350)}
        >
          <View className="w-20 h-20 rounded-3xl bg-foreground/5 dark:bg-white/5 items-center justify-center mb-4 overflow-hidden">
            <RNImage className="w-16 h-16 rounded-2xl" source={require('../../assets/icon.png')} />
          </View>
          <Text className="text-foreground text-[22px] font-bold tracking-tight">MinkHub</Text>
          <Text className="text-secondary/60 text-[14px] font-medium mt-1">v{APP_VERSION}</Text>
          <Text className="text-secondary/40 text-[13px] font-medium mt-0.5">Built on LobeHub</Text>
        </Animated.View>

        {/* Description */}
        <Animated.View className="px-8 mb-8" entering={FadeInDown.delay(100).duration(350)}>
          <Text className="text-center text-secondary/60 text-[14px] leading-5">
            An open-source, modern-design AI Agent Workspace. Your personal AI companion, running on
            your own server.
          </Text>
        </Animated.View>

        {/* Links */}
        <Animated.View className="w-full px-5" entering={FadeInDown.delay(150).duration(350)}>
          <Text className="px-3 mb-2 text-secondary/60 text-[12px] font-medium uppercase tracking-wider">
            Links
          </Text>
          <LinkRow
            icon={Github}
            iconColor={isDark ? '#d0d0d0' : '#333'}
            isDark={isDark}
            label="GitHub Repository"
            url="https://github.com/lobehub/lobe-chat"
          />
          <LinkRow
            icon={ExternalLink}
            iconColor="#007aff"
            isDark={isDark}
            label="Official Website"
            url="https://lobehub.com"
          />
          <LinkRow
            icon={Heart}
            iconColor="#ff3b30"
            isDark={isDark}
            label="Sponsor"
            url="https://opencollective.com/lobehub"
          />
        </Animated.View>

        {/* Footer */}
        <Animated.View className="mt-10" entering={FadeInDown.delay(200).duration(350)}>
          <Text className="text-secondary/30 text-[12px] font-medium text-center">
            Made with ❤️ by LobeHub
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}
