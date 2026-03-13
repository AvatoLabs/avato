/**
 * SkillDetailScreen — Complete agent skill detail view with:
 * - Markdown content rendering
 * - Resource file tree
 * - Install/Uninstall actions
 * - Manifest syntax highlighting
 * - External links
 */
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  ChevronLeft,
  Code,
  FileText,
  Link as LinkIcon,
  Package,
  RefreshCw,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SyntaxHighlighter from 'react-native-syntax-highlighter';

import PressableScale from '../components/ui/PressableScale';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { useToast } from '../components/ui/Toast';
import { agentSkillApi, pluginApi } from '../lib/api';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import { tokens } from '../theme/tokens';
import type { AgentSkillItem, InstalledPlugin } from '../types';

interface SkillResource {
  children?: SkillResource[];
  content?: string;
  path: string;
  type: 'file' | 'directory';
}

interface SkillDetailParams {
  skillId: string;
  skillName: string;
  skillType?: 'agent' | 'plugin';
}

export default function SkillDetailScreen() {
  const { t } = useI18n();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const params = route.params as SkillDetailParams;
  const skillId: string = params?.skillId;
  const skillName: string = params?.skillName || 'Skill';
  const skillType: 'agent' | 'plugin' = params?.skillType || 'agent';

  const [skill, setSkill] = useState<AgentSkillItem | null>(null);
  const [plugin, setPlugin] = useState<InstalledPlugin | null>(null);
  const [resources, setResources] = useState<SkillResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const toast = useToast();
  const insets = useSafeAreaInsets();

  const fetchSkill = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (skillType === 'plugin') {
        // Fetch plugin details
        const plugins = await pluginApi.list();
        const foundPlugin = plugins.find((p) => p.identifier === skillId);
        if (foundPlugin) {
          setPlugin(foundPlugin);
        } else {
          setError(t.skillsDetailNotFound || 'Skill not found');
        }
      } else {
        // Fetch agent skill details
        const data = await agentSkillApi.getById(skillId);
        if (data) {
          setSkill(data);
        } else {
          setError(t.skillsDetailNotFound || 'Skill not found');
        }
      }
    } catch (err) {
      console.error('Failed to fetch skill details:', err);
      setError(t.skillsMarketUnavailable || 'Failed to load skill details');
    } finally {
      setLoading(false);
    }
  }, [skillId, skillType, t]);

  // Handle install for Lobehub skills
  const handleInstall = async () => {
    if (!skill || skill.source !== 'market' || !skill.identifier) return;

    setActionLoading(true);
    haptics.light();

    try {
      await agentSkillApi.importFromMarket(skill.identifier);
      toast.show('success', t.skillsInstallSuccess);
      fetchSkill(); // Refresh
    } catch (error) {
      toast.show('error', t.skillsInstallFailed);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUninstall = async () => {
    if (!skill) return;

    Alert.alert(t.skillsUninstallConfirm, t.skillsUninstallDesc, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete,
        style: 'destructive',
        onPress: async () => {
          setActionLoading(true);
          haptics.light();
          try {
            await agentSkillApi.delete(skill.id);
            toast.show('success', t.toastSaved);
            nav.goBack();
          } catch (error) {
            toast.show('error', t.errorDeleteFailed);
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handlePluginUninstall = async () => {
    if (!plugin) return;

    Alert.alert(t.skillsUninstallConfirm, t.skillsUninstallDesc, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete,
        style: 'destructive',
        onPress: async () => {
          setActionLoading(true);
          haptics.light();
          try {
            await pluginApi.remove(plugin.identifier);
            toast.show('success', t.toastSaved);
            nav.goBack();
          } catch (error) {
            toast.show('error', t.errorDeleteFailed);
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  useEffect(() => {
    fetchSkill();
  }, [fetchSkill]);

  // Handle retry on error
  const handleRetry = useCallback(() => {
    haptics.light();
    fetchSkill();
  }, [fetchSkill]);

  // Render action buttons based on skill type and status
  const renderActions = () => {
    if (skillType === 'plugin' && plugin) {
      return (
        <View className="flex-row gap-2 mb-4">
          <PressableScale
            className="flex-1 bg-red-500/10 rounded-xl py-3 items-center"
            disabled={actionLoading}
            onPress={handlePluginUninstall}
          >
            <Text className="text-red-500 text-[14px] font-semibold">{t.skillsUninstall}</Text>
          </PressableScale>
        </View>
      );
    }

    if (skill) {
      const isInstalled = skill.source === 'user' || skill.source === 'builtin';
      const isMarket = skill.source === 'market';

      return (
        <View className="flex-row gap-2 mb-4">
          {isMarket && (
            <PressableScale
              className="flex-1 bg-primary rounded-xl py-3 items-center"
              disabled={actionLoading}
              onPress={handleInstall}
            >
              <Text className="text-white text-[14px] font-semibold">{t.skillsInstall}</Text>
            </PressableScale>
          )}
          {isInstalled && (
            <PressableScale
              className="flex-1 bg-red-500/10 rounded-xl py-3 items-center"
              disabled={actionLoading}
              onPress={handleUninstall}
            >
              <Text className="text-red-500 text-[14px] font-semibold">{t.skillsUninstall}</Text>
            </PressableScale>
          )}
        </View>
      );
    }

    return null;
  };

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
      ) : error ? (
        <View className="flex-1 items-center justify-center px-8">
          <Package color="#d1d5db" size={48} strokeWidth={1.2} />
          <Text className="text-secondary/50 text-[15px] font-medium mt-4 text-center">
            {error}
          </Text>
          <TouchableOpacity
            className="mt-6 flex-row items-center gap-2 px-6 py-3 bg-primary rounded-xl"
            onPress={handleRetry}
          >
            <RefreshCw color="#fff" size={18} strokeWidth={tokens.icon.strokeWidth} />
            <Text className="text-white text-[15px] font-semibold">{t.retry}</Text>
          </TouchableOpacity>
        </View>
      ) : !skill && !plugin ? (
        <View className="flex-1 items-center justify-center px-8">
          <Package color="#d1d5db" size={48} strokeWidth={1.2} />
          <Text className="text-secondary/50 text-[15px] font-medium mt-4">
            {t.skillsDetailNotFound || 'Skill not found'}
          </Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingBottom: 40 + insets.bottom,
            paddingHorizontal: 20,
            paddingTop: 16,
          }}
        >
          {/* Action Buttons */}
          {renderActions()}

          {/* Metadata Card */}
          <View className="bg-foreground/[0.02] rounded-2xl p-4 mb-4">
            <View className="flex-row items-center gap-2 mb-2">
              <Package color="#007aff" size={16} strokeWidth={tokens.icon.strokeWidth} />
              <Text className="text-foreground text-[15px] font-semibold">
                {skill?.name || plugin?.manifest?.meta?.title || skillName}
              </Text>
            </View>
            {(skill?.description || plugin?.manifest?.meta?.description) && (
              <Text className="text-secondary/60 text-[13px] leading-5">
                {skill?.description || plugin?.manifest?.meta?.description}
              </Text>
            )}
            <View className="flex-row flex-wrap gap-2 mt-3">
              {skill?.source && (
                <View className="px-2 py-0.5 rounded-full bg-primary/10">
                  <Text className="text-primary text-[11px] font-medium">{skill.source}</Text>
                </View>
              )}
              {(skill?.identifier || plugin?.identifier) && (
                <View className="px-2 py-0.5 rounded-full bg-foreground/5">
                  <Text className="text-secondary/50 text-[11px]">
                    {skill?.identifier || plugin?.identifier}
                  </Text>
                </View>
              )}
              {skill?.manifest?.version && (
                <View className="px-2 py-0.5 rounded-full bg-foreground/5">
                  <Text className="text-secondary/50 text-[11px]">v{skill.manifest.version}</Text>
                </View>
              )}
              {skill?.manifest?.author && (
                <View className="px-2 py-0.5 rounded-full bg-foreground/5">
                  <Text className="text-secondary/50 text-[11px]">{skill.manifest.author}</Text>
                </View>
              )}
            </View>
            {skill?.manifest?.authorUrl && (
              <TouchableOpacity
                className="flex-row items-center gap-1 mt-2"
                onPress={() => {
                  /* TODO: Open URL */
                }}
              >
                <LinkIcon color="#007aff" size={12} strokeWidth={tokens.icon.strokeWidth} />
                <Text className="text-primary text-[11px] font-medium">
                  {skill.manifest.authorUrl}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Content with Markdown Rendering */}
          {skill?.content && (
            <View className="mb-4">
              <View className="flex-row items-center gap-2 mb-2">
                <FileText color="#666" size={14} strokeWidth={tokens.icon.strokeWidth} />
                <Text className="text-foreground text-[14px] font-semibold">
                  {t.skillsDetailContent || 'Content'}
                </Text>
              </View>
              <View className="bg-foreground/[0.02] rounded-2xl overflow-hidden">
                <Markdown
                  style={{
                    body: {
                      padding: 16,
                      fontSize: 13,
                      lineHeight: 20,
                      color: '#666',
                    },
                    heading1: { fontSize: 18, fontWeight: '600', color: '#111' },
                    heading2: { fontSize: 16, fontWeight: '600', color: '#111' },
                    code_inline: {
                      backgroundColor: 'rgba(0,0,0,0.05)',
                      paddingHorizontal: 4,
                      paddingVertical: 2,
                      borderRadius: 4,
                      fontSize: 12,
                    },
                    blockquote: {
                      borderLeftWidth: 3,
                      borderLeftColor: '#007aff',
                      paddingLeft: 12,
                      opacity: 0.7,
                    },
                  }}
                >
                  {skill.content}
                </Markdown>
              </View>
            </View>
          )}

          {/* Manifest with Syntax Highlighting */}
          {(skill?.manifest || plugin?.manifest) && (
            <View className="mb-4">
              <View className="flex-row items-center gap-2 mb-2">
                <Code color="#666" size={14} strokeWidth={tokens.icon.strokeWidth} />
                <Text className="text-foreground text-[14px] font-semibold">
                  {t.skillsDetailManifest || 'Manifest'}
                </Text>
              </View>
              <View className="bg-foreground/[0.02] rounded-2xl overflow-hidden">
                <SyntaxHighlighter
                  wrapLines
                  highlightLineNumbers={false}
                  language="json"
                  customStyle={{
                    padding: 16,
                    fontSize: 11,
                    lineHeight: 16,
                    backgroundColor: 'rgba(0,0,0,0.02)',
                  }}
                  style={{
                    code: {
                      color: '#d73a49',
                      fontSize: 11,
                      lineHeight: 16,
                    },
                    comment: {
                      color: '#6a737d',
                      fontStyle: 'italic',
                    },
                    keyword: {
                      color: '#d73a49',
                    },
                    string: {
                      color: '#032f62',
                    },
                    number: {
                      color: '#005cc5',
                    },
                    boolean: {
                      color: '#005cc5',
                    },
                    operator: {
                      color: '#d73a49',
                    },
                    punctuation: {
                      color: '#24292e',
                    },
                    property: {
                      color: '#005cc5',
                    },
                  }}
                >
                  {JSON.stringify(skill?.manifest || plugin?.manifest, null, 2)}
                </SyntaxHighlighter>
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}
