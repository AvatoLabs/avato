/**
 * AboutScreen — App info, version, links, and credits.
 */
import { ArrowLeft, ExternalLink, Github, Heart, Info } from 'lucide-react-native';
import React from 'react';
import { Image as RNImage, Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import PressableScale from '../components/ui/PressableScale';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { semanticColors } from '../constants/colors';
import { haptics } from '../lib/haptics';
import { APP_NAME, APP_VERSION } from '../lib/appInfo';
import { useI18n } from '../lib/i18n';
import { tokens } from '../theme/tokens';
const PROJECT_URL = 'https://github.com/AvatoLabs/avatohub';
const ORG_URL = 'https://github.com/AvatoLabs';

function LinkRow({
  icon: IconComp,
  iconColor,
  label,
  url,
}: {
  icon: any;
  iconColor: string;
  label: string;
  url: string;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.6}
      className="flex-row items-center px-5 py-3.5 mb-2 rounded-2xl bg-foreground/[0.02] active:bg-foreground/[0.04]"
      onPress={() => {
        haptics.light();
        Linking.openURL(url).catch(() => {});
      }}
    >
      <View className="w-8 h-8 rounded-full bg-foreground/5 items-center justify-center mr-4">
        <IconComp color={iconColor} size={16} strokeWidth={tokens.icon.strokeWidth} />
      </View>
      <Text className="flex-1 text-foreground text-[15.5px] font-medium tracking-tight">
        {label}
      </Text>
      <ExternalLink color="#c0c0c0" size={16} strokeWidth={tokens.icon.strokeWidth} />
    </TouchableOpacity>
  );
}

export default function AboutScreen({ navigation }: any) {
  const { t } = useI18n();

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        leftElement={<ArrowLeft color={semanticColors.primary} size={22} strokeWidth={tokens.icon.strokeWidth} />}
        title={t.meAbout}
        onPressLeft={() => {
          haptics.light();
          navigation.goBack();
        }}
      />

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
          <View className="w-20 h-20 rounded-3xl bg-foreground/5 items-center justify-center mb-4 overflow-hidden">
            <RNImage
              className="w-16 h-16 rounded-2xl"
              source={require('../../assets/avato-icon.png')}
            />
          </View>
          <Text className="text-foreground text-[22px] font-bold tracking-tight">{APP_NAME}</Text>
          <Text className="text-secondary/60 text-[14px] font-medium mt-1">v{APP_VERSION}</Text>
          <Text className="text-secondary/40 text-[13px] font-medium mt-0.5">
            {t.aboutBuiltOn.replace('{name}', APP_NAME)}
          </Text>
        </Animated.View>

        {/* Description */}
        <Animated.View className="px-8 mb-8" entering={FadeInDown.delay(100).duration(350)}>
          <Text className="text-center text-secondary/60 text-[14px] leading-5">
            {t.aboutDescription}
          </Text>
        </Animated.View>

        {/* Links */}
        <Animated.View className="w-full px-5" entering={FadeInDown.delay(150).duration(350)}>
          <Text className="px-2 mb-2 text-secondary/60 text-[11px] font-semibold uppercase tracking-widest">
            {t.aboutLinks}
          </Text>
          <LinkRow
            icon={Github}
            iconColor="#333"
            label={t.aboutGithubRepository}
            url={PROJECT_URL}
          />
          <LinkRow
            icon={ExternalLink}
            iconColor={semanticColors.primary}
            label={t.aboutOfficialWebsite}
            url={PROJECT_URL}
          />
          <LinkRow
            icon={Heart}
            iconColor={semanticColors.danger}
            label={t.aboutSponsor}
            url={ORG_URL}
          />
        </Animated.View>

        {/* Footer */}
        <Animated.View className="mt-10" entering={FadeInDown.delay(200).duration(350)}>
          <Text className="text-secondary/30 text-[12px] font-medium text-center">
            {t.aboutMadeWith.replace('{name}', APP_NAME)}
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}
