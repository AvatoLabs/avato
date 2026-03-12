/**
 * SkillSettingsScreen — Skill management aligned 1:1 with web /settings/skill.
 *
 * Shows three sections:
 *   1. Agent Skills (builtin / market / user)
 *   2. Community MCP (type === 'plugin')
 *   3. Custom MCP (type === 'customPlugin')
 *
 * Supports: install / uninstall, import (URL/GitHub), add custom MCP.
 */
import {
  ArrowLeft,
  Blocks,
  ChevronRight,
  Download,
  Plus,
  Puzzle,
  RefreshCw,
  Trash2,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
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
import { agentSkillApi, pluginApi } from '../lib/api';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import { tokens } from '../theme/tokens';
import type { AgentSkillItem, InstalledPlugin } from '../types';

// ── Source Tag ─────────────────────────────────────────────────────
function SourceTag({ label, color = '#007aff' }: { color?: string; label: string }) {
  return (
    <View
      style={{
        backgroundColor: color + '18',
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 2,
      }}
    >
      <Text style={{ color, fontSize: 10, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

// ── Section Header ────────────────────────────────────────────────
function SectionHeader({ title, delay = 0 }: { delay?: number; title: string }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(300)}>
      <Text className="px-7 mb-2 mt-4 text-secondary/60 text-[12px] font-medium uppercase tracking-wider">
        {title}
      </Text>
    </Animated.View>
  );
}

// ── Agent Skill Row ───────────────────────────────────────────────
function AgentSkillRow({
  skill,
  index,
  t,
  onDelete,
}: {
  index: number;
  onDelete: (id: string) => void;
  skill: AgentSkillItem;
  t: any;
}) {
  const sourceLabel =
    skill.source === 'builtin'
      ? t.skillsBuiltin
      : skill.source === 'market'
        ? t.skillsMarket
        : t.skillsUser;
  const sourceColor =
    skill.source === 'builtin' ? '#4caf50' : skill.source === 'market' ? '#9c27b0' : '#007aff';

  return (
    <Animated.View entering={FadeInDown.delay(index * 25).duration(200)}>
      <View className="mx-5 mb-2 bg-foreground/5 rounded-2xl overflow-hidden">
        <View className="flex-row items-center px-4 py-3.5">
          <View className="w-9 h-9 rounded-full bg-foreground/10 items-center justify-center mr-3">
            <Puzzle color="#007aff" size={18} strokeWidth={tokens.icon.strokeWidth} />
          </View>
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Text
                className="text-foreground font-medium text-[15px] tracking-tight"
                numberOfLines={1}
              >
                {skill.name}
              </Text>
              <SourceTag color={sourceColor} label={sourceLabel} />
            </View>
            {skill.description ? (
              <Text className="text-secondary/50 text-[11px] font-medium mt-0.5" numberOfLines={1}>
                {skill.description}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity
            hitSlop={12}
            onPress={() => {
              Alert.alert(t.skillsDeleteConfirm, t.skillsDeleteDesc, [
                { style: 'cancel', text: t.cancel },
                {
                  onPress: () => onDelete(skill.id),
                  style: 'destructive',
                  text: t.delete,
                },
              ]);
            }}
          >
            <Trash2 color="#ff3b30" size={18} strokeWidth={tokens.icon.strokeWidth} />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

// ── Plugin Row (community / custom MCP) ───────────────────────────
function PluginRow({
  plugin,
  index,
  t,
  onUninstall,
}: {
  index: number;
  onUninstall: (identifier: string) => void;
  plugin: InstalledPlugin;
  t: any;
}) {
  const isMCP = plugin.runtimeType === 'mcp';
  const isCustom = plugin.type === 'customPlugin';
  const title = plugin.manifest?.meta?.title || plugin.manifest?.identifier || plugin.identifier;
  const avatar = plugin.manifest?.meta?.avatar;

  const tagLabel = isCustom ? 'MCP' : isMCP ? 'MCP' : t.skillsPlugin;
  const tagColor = isMCP ? '#e83e8c' : '#607d8b';
  const sourceLabel = isCustom ? t.skillsUser : t.skillsCommunity;
  const sourceColor = isCustom ? '#007aff' : '#9c27b0';

  return (
    <Animated.View entering={FadeInDown.delay(index * 25).duration(200)}>
      <View className="mx-5 mb-2 bg-foreground/5 rounded-2xl overflow-hidden">
        <View className="flex-row items-center px-4 py-3.5">
          <View className="w-9 h-9 rounded-full bg-foreground/10 items-center justify-center mr-3">
            {avatar ? (
              <Text style={{ fontSize: 18 }}>{avatar}</Text>
            ) : (
              <Blocks color={tagColor} size={18} strokeWidth={tokens.icon.strokeWidth} />
            )}
          </View>
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Text
                className="text-foreground font-medium text-[15px] tracking-tight"
                numberOfLines={1}
              >
                {title}
              </Text>
              <SourceTag color={tagColor} label={tagLabel} />
              <SourceTag color={sourceColor} label={sourceLabel} />
            </View>
            {plugin.manifest?.meta?.description ? (
              <Text className="text-secondary/50 text-[11px] font-medium mt-0.5" numberOfLines={1}>
                {plugin.manifest.meta.description}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity
            hitSlop={12}
            onPress={() => {
              Alert.alert(t.skillsUninstallConfirm, t.skillsUninstallDesc, [
                { style: 'cancel', text: t.cancel },
                {
                  onPress: () => onUninstall(plugin.identifier),
                  style: 'destructive',
                  text: t.skillsUninstall,
                },
              ]);
            }}
          >
            <Trash2 color="#ff3b30" size={18} strokeWidth={tokens.icon.strokeWidth} />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

// ── Import Modal ──────────────────────────────────────────────────
function ImportModal({
  visible,
  onClose,
  onImportUrl,
  onImportGitHub,
  t,
}: {
  onClose: () => void;
  onImportGitHub: (url: string) => void;
  onImportUrl: (url: string) => void;
  t: any;
  visible: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<'url' | 'github'>('url');
  const [value, setValue] = useState('');
  const [importing, setImporting] = useState(false);

  const handleImport = async () => {
    if (!value.trim()) return;
    setImporting(true);
    try {
      if (mode === 'github') {
        await onImportGitHub(value.trim());
      } else {
        await onImportUrl(value.trim());
      }
      setValue('');
      onClose();
    } catch {
      // error handled by caller
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <View className="bg-background rounded-t-3xl" style={{ paddingBottom: insets.bottom + 16 }}>
          <View className="px-6 pt-6 pb-4">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-foreground text-[18px] font-semibold">{t.skillsImport}</Text>
              <TouchableOpacity onPress={onClose}>
                <Text className="text-blue-500 text-[15px] font-medium">{t.done}</Text>
              </TouchableOpacity>
            </View>

            {/* Tab switcher */}
            <View className="flex-row mb-4 bg-foreground/5 rounded-xl p-1">
              <TouchableOpacity
                className={`flex-1 py-2 rounded-lg items-center ${mode === 'url' ? 'bg-background' : ''}`}
                onPress={() => setMode('url')}
              >
                <Text
                  className={`text-[13px] font-medium ${mode === 'url' ? 'text-foreground' : 'text-secondary/60'}`}
                >
                  {t.skillsImportUrl}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`flex-1 py-2 rounded-lg items-center ${mode === 'github' ? 'bg-background' : ''}`}
                onPress={() => setMode('github')}
              >
                <Text
                  className={`text-[13px] font-medium ${mode === 'github' ? 'text-foreground' : 'text-secondary/60'}`}
                >
                  {t.skillsImportGithub}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Input */}
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              className="bg-foreground/5 rounded-xl px-4 py-3 text-foreground text-[14px] mb-4"
              editable={!importing}
              placeholderTextColor="#999"
              value={value}
              placeholder={
                mode === 'url' ? t.skillsImportUrlPlaceholder : t.skillsImportGithubPlaceholder
              }
              onChangeText={setValue}
            />

            {/* Import button */}
            <TouchableOpacity
              className={`rounded-xl py-3.5 items-center ${value.trim() ? 'bg-blue-500' : 'bg-foreground/10'}`}
              disabled={!value.trim() || importing}
              onPress={handleImport}
            >
              {importing ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text
                  className={`font-semibold text-[15px] ${value.trim() ? 'text-white' : 'text-secondary/40'}`}
                >
                  {t.skillsImport}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Add Custom MCP Modal ──────────────────────────────────────────
function AddCustomMcpModal({
  visible,
  onClose,
  onSave,
  t,
}: {
  onClose: () => void;
  onSave: (name: string, url: string) => void;
  t: any;
  visible: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !url.trim()) return;
    setSaving(true);
    try {
      await onSave(name.trim(), url.trim());
      setName('');
      setUrl('');
      onClose();
    } catch {
      // error handled by caller
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <View className="bg-background rounded-t-3xl" style={{ paddingBottom: insets.bottom + 16 }}>
          <View className="px-6 pt-6 pb-4">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-foreground text-[18px] font-semibold">
                {t.skillsAddCustomMcp}
              </Text>
              <TouchableOpacity onPress={onClose}>
                <Text className="text-blue-500 text-[15px] font-medium">{t.done}</Text>
              </TouchableOpacity>
            </View>

            {/* Name */}
            <Text className="text-foreground/70 text-[13px] font-medium mb-1.5">
              {t.skillsCustomMcpName}
            </Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              className="bg-foreground/5 rounded-xl px-4 py-3 text-foreground text-[14px] mb-3"
              editable={!saving}
              placeholder={t.skillsCustomMcpNamePlaceholder}
              placeholderTextColor="#999"
              value={name}
              onChangeText={setName}
            />

            {/* URL */}
            <Text className="text-foreground/70 text-[13px] font-medium mb-1.5">
              {t.skillsCustomMcpUrl}
            </Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              className="bg-foreground/5 rounded-xl px-4 py-3 text-foreground text-[14px] mb-4"
              editable={!saving}
              placeholder={t.skillsCustomMcpUrlPlaceholder}
              placeholderTextColor="#999"
              value={url}
              onChangeText={setUrl}
            />

            {/* Save button */}
            <TouchableOpacity
              className={`rounded-xl py-3.5 items-center ${name.trim() && url.trim() ? 'bg-blue-500' : 'bg-foreground/10'}`}
              disabled={!name.trim() || !url.trim() || saving}
              onPress={handleSave}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text
                  className={`font-semibold text-[15px] ${name.trim() && url.trim() ? 'text-white' : 'text-secondary/40'}`}
                >
                  {t.save}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Main Screen ───────────────────────────────────────────────────
export default function SkillSettingsScreen({ navigation }: any) {
  const { t } = useI18n();
  const toast = useToast();
  const canGoBack = navigation.canGoBack() && navigation.getState()?.type !== 'tab';

  const [agentSkills, setAgentSkills] = useState<AgentSkillItem[]>([]);
  const [plugins, setPlugins] = useState<InstalledPlugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [importVisible, setImportVisible] = useState(false);
  const [addMcpVisible, setAddMcpVisible] = useState(false);

  // ── Fetch data ────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    try {
      const [skills, installedPlugins] = await Promise.all([
        agentSkillApi.list(),
        pluginApi.list(),
      ]);
      setAgentSkills(Array.isArray(skills) ? skills : []);
      setPlugins(Array.isArray(installedPlugins) ? installedPlugins : []);
    } catch {
      toast.show('error', t.errorNetwork);
    }
  }, [t, toast]);

  useEffect(() => {
    fetchAll().finally(() => setLoading(false));
  }, [fetchAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    haptics.light();
    await fetchAll();
    setRefreshing(false);
  }, [fetchAll]);

  // ── Separate plugins into community and custom ────────────────
  const { communityPlugins, customPlugins } = useMemo(() => {
    const community = plugins.filter((p) => p.type === 'plugin');
    const custom = plugins.filter((p) => p.type === 'customPlugin');
    return { communityPlugins: community, customPlugins: custom };
  }, [plugins]);

  // ── Separate agent skills by source ───────────────────────────
  const { builtinSkills, marketSkills, userSkills } = useMemo(() => {
    const builtin = agentSkills.filter((s) => s.source === 'builtin');
    const market = agentSkills.filter((s) => s.source === 'market');
    const user = agentSkills.filter((s) => !s.source || s.source === 'user');
    return { builtinSkills: builtin, marketSkills: market, userSkills: user };
  }, [agentSkills]);

  const hasAny = agentSkills.length > 0 || communityPlugins.length > 0 || customPlugins.length > 0;

  // ── Handlers ──────────────────────────────────────────────────
  const handleDeleteSkill = async (id: string) => {
    haptics.selection();
    try {
      await agentSkillApi.delete(id);
      setAgentSkills((prev) => prev.filter((s) => s.id !== id));
      toast.show('success', t.toastSaved);
    } catch {
      toast.show('error', t.errorDeleteFailed);
    }
  };

  const handleUninstallPlugin = async (identifier: string) => {
    haptics.selection();
    try {
      await pluginApi.remove(identifier);
      setPlugins((prev) => prev.filter((p) => p.identifier !== identifier));
      toast.show('success', t.toastSaved);
    } catch {
      toast.show('error', t.errorDeleteFailed);
    }
  };

  const handleImportUrl = async (url: string) => {
    try {
      await agentSkillApi.importFromUrl(url);
      toast.show('success', t.skillsImportSuccess);
      await fetchAll();
    } catch {
      toast.show('error', t.skillsImportFailed);
      throw new Error('import failed');
    }
  };

  const handleImportGitHub = async (gitUrl: string) => {
    try {
      await agentSkillApi.importFromGitHub(gitUrl);
      toast.show('success', t.skillsImportSuccess);
      await fetchAll();
    } catch {
      toast.show('error', t.skillsImportFailed);
      throw new Error('import failed');
    }
  };

  const handleAddCustomMcp = async (name: string, url: string) => {
    try {
      const identifier = `custom-mcp-${Date.now()}`;
      await pluginApi.create({
        customParams: {
          mcp: { type: 'http', url },
          name,
        },
        identifier,
        manifest: {
          identifier,
          meta: { description: url, title: name },
        },
        type: 'customPlugin',
      });
      toast.show('success', t.skillsCustomMcpSaved);
      await fetchAll();
    } catch {
      toast.show('error', t.errorNetwork);
      throw new Error('save failed');
    }
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        leftElement={
          canGoBack ? (
            <ArrowLeft color="#111" size={22} strokeWidth={tokens.icon.strokeWidth} />
          ) : undefined
        }
        rightElement={<RefreshCw color="#007aff" size={20} strokeWidth={tokens.icon.strokeWidth} />}
        title={t.skillsTitle}
        onPressLeft={canGoBack ? () => navigation.goBack() : undefined}
        onPressRight={onRefresh}
      />

      {loading ? (
        <View className="flex-1 items-center pt-20">
          <ActivityIndicator color="#007aff" size="small" />
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              colors={['#007aff']}
              refreshing={refreshing}
              tintColor="#007aff"
              onRefresh={onRefresh}
            />
          }
        >
          {!hasAny ? (
            <View className="items-center pt-20 px-8">
              <Blocks color="#ccc" size={48} strokeWidth={1} />
              <Text className="text-secondary/50 text-[16px] mt-4 font-medium text-center">
                {t.skillsEmpty}
              </Text>
              <Text className="text-secondary/40 text-[13px] mt-2 text-center">
                {t.skillsEmptyDesc}
              </Text>
            </View>
          ) : (
            <>
              {/* Agent Skills — Integrations */}
              {agentSkills.length > 0 && (
                <>
                  <SectionHeader delay={50} title={t.skillsIntegrations} />
                  {[...builtinSkills, ...marketSkills].map((skill, i) => (
                    <AgentSkillRow
                      index={i}
                      key={skill.id}
                      skill={skill}
                      t={t}
                      onDelete={handleDeleteSkill}
                    />
                  ))}
                </>
              )}

              {/* Community MCP */}
              {communityPlugins.length > 0 && (
                <>
                  <SectionHeader delay={100} title={t.skillsCommunityMcp} />
                  {communityPlugins.map((plugin, i) => (
                    <PluginRow
                      index={i}
                      key={plugin.identifier}
                      plugin={plugin}
                      t={t}
                      onUninstall={handleUninstallPlugin}
                    />
                  ))}
                </>
              )}

              {/* Custom (user skills + custom MCP) */}
              {(userSkills.length > 0 || customPlugins.length > 0) && (
                <>
                  <SectionHeader delay={150} title={t.skillsCustom} />
                  {userSkills.map((skill, i) => (
                    <AgentSkillRow
                      index={i}
                      key={skill.id}
                      skill={skill}
                      t={t}
                      onDelete={handleDeleteSkill}
                    />
                  ))}
                  {customPlugins.map((plugin, i) => (
                    <PluginRow
                      index={i + userSkills.length}
                      key={plugin.identifier}
                      plugin={plugin}
                      t={t}
                      onUninstall={handleUninstallPlugin}
                    />
                  ))}
                </>
              )}
            </>
          )}

          {/* Action Buttons */}
          <View className="px-5 mt-6 gap-3">
            <Animated.View entering={FadeInDown.delay(200).duration(300)}>
              <PressableScale
                className="bg-foreground/5 rounded-2xl overflow-hidden"
                onPress={() => setImportVisible(true)}
              >
                <View className="flex-row items-center px-4 py-3.5">
                  <View className="w-8 h-8 rounded-full bg-blue-500/10 items-center justify-center mr-3">
                    <Download color="#007aff" size={16} strokeWidth={tokens.icon.strokeWidth} />
                  </View>
                  <Text className="flex-1 text-foreground font-medium text-[15px]">
                    {t.skillsImport}
                  </Text>
                  <ChevronRight color="#c0c0c0" size={18} strokeWidth={tokens.icon.strokeWidth} />
                </View>
              </PressableScale>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(250).duration(300)}>
              <PressableScale
                className="bg-foreground/5 rounded-2xl overflow-hidden"
                onPress={() => setAddMcpVisible(true)}
              >
                <View className="flex-row items-center px-4 py-3.5">
                  <View className="w-8 h-8 rounded-full bg-pink-500/10 items-center justify-center mr-3">
                    <Plus color="#e83e8c" size={16} strokeWidth={tokens.icon.strokeWidth} />
                  </View>
                  <Text className="flex-1 text-foreground font-medium text-[15px]">
                    {t.skillsAddCustomMcp}
                  </Text>
                  <ChevronRight color="#c0c0c0" size={18} strokeWidth={tokens.icon.strokeWidth} />
                </View>
              </PressableScale>
            </Animated.View>
          </View>
        </ScrollView>
      )}

      {/* Modals */}
      <ImportModal
        t={t}
        visible={importVisible}
        onClose={() => setImportVisible(false)}
        onImportGitHub={handleImportGitHub}
        onImportUrl={handleImportUrl}
      />
      <AddCustomMcpModal
        t={t}
        visible={addMcpVisible}
        onClose={() => setAddMcpVisible(false)}
        onSave={handleAddCustomMcp}
      />
    </View>
  );
}
