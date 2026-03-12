/**
 * SkillDetailScreen — View agent skill content and metadata.
 */
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, Code, FileText, Package } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { ScreenHeader } from '../components/ui/ScreenHeader';
import { agentSkillApi } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { tokens } from '../theme/tokens';

export default function SkillDetailScreen() {
  const { t } = useI18n();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const skillId: string = route.params?.skillId;
  const skillName: string = route.params?.skillName || 'Skill';

  const [skill, setSkill] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchSkill = useCallback(async () => {
    try {
      const data = await agentSkillApi.getById(skillId);
      setSkill(data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [skillId]);

  useEffect(() => {
    fetchSkill();
  }, [fetchSkill]);

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        leftElement={<ChevronLeft color="#111" size={22} strokeWidth={tokens.icon.strokeWidth} />}
        title={skillName}
        onPressLeft={() => nav.goBack()}
      />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#007aff" size="large" />
        </View>
      ) : !skill ? (
        <View className="flex-1 items-center justify-center px-8">
          <Package color="#d1d5db" size={48} strokeWidth={1.2} />
          <Text className="text-secondary/50 text-[15px] font-medium mt-4">
            {t.skillsDetailNotFound || 'Skill not found'}
          </Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 20, paddingTop: 16 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Metadata Card */}
          <View className="bg-foreground/[0.02] rounded-2xl p-4 mb-4">
            <View className="flex-row items-center gap-2 mb-2">
              <Package color="#007aff" size={16} strokeWidth={tokens.icon.strokeWidth} />
              <Text className="text-foreground text-[15px] font-semibold">
                {skill.name || skillName}
              </Text>
            </View>
            {skill.description && (
              <Text className="text-secondary/60 text-[13px] leading-5">{skill.description}</Text>
            )}
            <View className="flex-row flex-wrap gap-2 mt-3">
              {skill.source && (
                <View className="px-2 py-0.5 rounded-full bg-primary/10">
                  <Text className="text-primary text-[11px] font-medium">{skill.source}</Text>
                </View>
              )}
              {skill.identifier && (
                <View className="px-2 py-0.5 rounded-full bg-foreground/5">
                  <Text className="text-secondary/50 text-[11px]">{skill.identifier}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Content */}
          {skill.content && (
            <View className="mb-4">
              <View className="flex-row items-center gap-2 mb-2">
                <FileText color="#666" size={14} strokeWidth={tokens.icon.strokeWidth} />
                <Text className="text-foreground text-[14px] font-semibold">
                  {t.skillsDetailContent || 'Content'}
                </Text>
              </View>
              <View className="bg-foreground/[0.02] rounded-2xl p-4">
                <Text className="text-secondary/70 text-[13px] leading-5 font-mono">
                  {skill.content}
                </Text>
              </View>
            </View>
          )}

          {/* Manifest */}
          {skill.manifest && (
            <View className="mb-4">
              <View className="flex-row items-center gap-2 mb-2">
                <Code color="#666" size={14} strokeWidth={tokens.icon.strokeWidth} />
                <Text className="text-foreground text-[14px] font-semibold">
                  {t.skillsDetailManifest || 'Manifest'}
                </Text>
              </View>
              <View className="bg-foreground/[0.02] rounded-2xl p-4">
                <Text
                  className="text-secondary/70 text-[12px] leading-5 font-mono"
                  numberOfLines={30}
                >
                  {JSON.stringify(skill.manifest, null, 2)}
                </Text>
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}
