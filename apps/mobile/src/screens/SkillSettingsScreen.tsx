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
  FileArchive,
  Github,
  Link as LinkIcon,
  Plus,
  Puzzle,
  RefreshCw,
  ShoppingBag,
  Trash2,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
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
import { semanticColors } from '../constants/colors';
import { agentSkillApi, mcpApi, pluginApi } from '../lib/api';
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
  onPress,
}: {
  index: number;
  onDelete: (id: string) => void;
  onPress?: () => void;
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
          <TouchableOpacity
            activeOpacity={0.7}
            className="flex-row items-center flex-1 mr-2"
            disabled={!onPress}
            onPress={onPress}
          >
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
                <Text
                  className="text-secondary/50 text-[11px] font-medium mt-0.5"
                  numberOfLines={1}
                >
                  {skill.description}
                </Text>
              ) : null}
            </View>
          </TouchableOpacity>
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
            {avatar && /^\p{Emoji_Presentation}$/u.test(avatar) ? (
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

// ── Simple Import Modal (URL or GitHub) ───────────────────────────
function SimpleImportModal({
  visible,
  onClose,
  onImport,
  title,
  placeholder,
  buttonText,
}: {
  buttonText: string;
  onClose: () => void;
  onImport: (value: string) => Promise<void>;
  placeholder: string;
  t: any;
  title: string;
  visible: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [value, setValue] = useState('');
  const [importing, setImporting] = useState(false);

  const handleImport = async () => {
    if (!value.trim()) return;
    setImporting(true);
    try {
      await onImport(value.trim());
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
      <Pressable
        className="flex-1 justify-end"
        style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
        onPress={onClose}
      >
        <Pressable
          className="bg-white rounded-t-3xl"
          style={{ paddingBottom: insets.bottom + 16 }}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Handle */}
          <View className="items-center pt-3 pb-1">
            <View className="w-10 h-1 rounded-full bg-black/10" />
          </View>

          <View className="px-5 pb-4 pt-2">
            <Text className="text-foreground text-[18px] font-bold tracking-tight mb-4">
              {title}
            </Text>

            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              className="bg-foreground/5 rounded-xl px-4 py-3 text-foreground text-[14px] mb-4"
              editable={!importing}
              placeholder={placeholder}
              placeholderTextColor="#999"
              value={value}
              onChangeText={setValue}
            />

            <Pressable
              className={`rounded-xl py-3.5 items-center ${value.trim() ? 'bg-primary' : 'bg-foreground/5'}`}
              disabled={!value.trim() || importing}
              onPress={handleImport}
            >
              {importing ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text
                  className={`font-semibold text-[15px] ${value.trim() ? 'text-white' : 'text-secondary/40'}`}
                >
                  {buttonText}
                </Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Quick Import JSON parser (HTTP only) ──────────────────────────
function parseMcpJsonInput(value: string): {
  error?: string;
  identifier?: string;
  url?: string;
} {
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { error: 'invalidJson' };
    }

    // { "mcpServers": { "name": { "url": "..." } } }
    if ('mcpServers' in parsed && typeof parsed.mcpServers === 'object') {
      const keys = Object.keys(parsed.mcpServers);
      if (keys.length === 0) return { error: 'invalidStructure' };
      const id = keys[0];
      const cfg = parsed.mcpServers[id];
      if (cfg?.url) return { identifier: id, url: cfg.url };
      return { error: 'invalidStructure' };
    }

    // { "name": { "url": "..." } }
    const topKeys = Object.keys(parsed);
    if (topKeys.length === 1) {
      const id = topKeys[0];
      const cfg = parsed[id];
      if (cfg?.url) return { identifier: id, url: cfg.url };
    }

    return { error: 'invalidStructure' };
  } catch {
    return { error: 'invalidJson' };
  }
}

// ── Add Custom MCP Modal (aligned with web DevModal) ─────────────
function AddCustomMcpModal({
  visible,
  onClose,
  onSave,
  t,
}: {
  onClose: () => void;
  onSave: (params: {
    auth?: { token?: string; type: 'none' | 'bearer' };
    avatar?: string;
    description?: string;
    headers?: Record<string, string>;
    identifier: string;
    url: string;
  }) => void;
  t: any;
  visible: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [identifier, setIdentifier] = useState('');
  const [url, setUrl] = useState('');
  const [authType, setAuthType] = useState<'none' | 'bearer'>('none');
  const [token, setToken] = useState('');
  const [description, setDescription] = useState('');
  const [avatar, setAvatar] = useState('');
  const [headers, setHeaders] = useState<{ key: string; value: string }[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showQuickImport, setShowQuickImport] = useState(false);
  const [quickImportText, setQuickImportText] = useState('');
  const [quickImportError, setQuickImportError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'failed' | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isConnectionReady = Boolean(identifier.trim() && url.trim());
  const isQuickImportReady = Boolean(quickImportText.trim());

  const resetForm = () => {
    setIdentifier('');
    setUrl('');
    setAuthType('none');
    setToken('');
    setDescription('');
    setAvatar('');
    setHeaders([]);
    setShowAdvanced(false);
    setShowQuickImport(false);
    setQuickImportText('');
    setQuickImportError(null);
    setSaving(false);
    setTesting(false);
    setTestResult(null);
    setErrors({});
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!identifier.trim()) errs.identifier = t.skillsCustomMcpIdentifierRequired;
    else if (!/^[\w-]+$/.test(identifier.trim()))
      errs.identifier = t.skillsCustomMcpIdentifierInvalid;
    if (!url.trim()) errs.url = t.skillsCustomMcpUrlRequired;
    else {
      try {
        new URL(url.trim());
      } catch {
        errs.url = t.skillsCustomMcpUrlInvalid;
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleQuickImport = () => {
    const text = quickImportText.trim();
    if (!text) {
      setQuickImportError(t.skillsCustomMcpQuickImportError);
      return;
    }
    const result = parseMcpJsonInput(text);
    if (result.error === 'invalidJson') {
      setQuickImportError(t.skillsCustomMcpQuickImportInvalidJson);
      return;
    }
    if (result.error === 'invalidStructure') {
      setQuickImportError(t.skillsCustomMcpQuickImportInvalidStructure);
      return;
    }
    if (result.identifier) setIdentifier(result.identifier);
    if (result.url) setUrl(result.url);
    setShowQuickImport(false);
    setQuickImportError(null);
    setTestResult(null);
  };

  const handleTestConnection = async () => {
    if (!validate()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const { mcpApi } = await import('../lib/api');
      const headersObj = headers.reduce<Record<string, string>>((acc, h) => {
        if (h.key.trim()) acc[h.key.trim()] = h.value;
        return acc;
      }, {});
      await mcpApi.getStreamableMcpServerManifest({
        auth: authType === 'bearer' ? { token, type: 'bearer' } : { type: 'none' },
        headers: Object.keys(headersObj).length > 0 ? headersObj : undefined,
        identifier: identifier.trim(),
        metadata: {
          avatar: avatar.trim() || undefined,
          description: description.trim() || undefined,
        },
        url: url.trim(),
      });
      setTestResult('success');
    } catch {
      setTestResult('failed');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const headersObj = headers.reduce<Record<string, string>>((acc, h) => {
        if (h.key.trim()) acc[h.key.trim()] = h.value;
        return acc;
      }, {});
      await onSave({
        auth: authType === 'bearer' ? { token, type: 'bearer' } : undefined,
        avatar: avatar.trim() || undefined,
        description: description.trim() || undefined,
        headers: Object.keys(headersObj).length > 0 ? headersObj : undefined,
        identifier: identifier.trim(),
        url: url.trim(),
      });
      resetForm();
      onClose();
    } catch {
      // error handled by caller
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={handleClose}>
      <Pressable
        className="flex-1 justify-end"
        style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
        onPress={handleClose}
      >
        <Pressable
          className="bg-white rounded-t-3xl"
          style={{ maxHeight: '90%', paddingBottom: insets.bottom + 16 }}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Handle */}
          <View className="items-center pt-3 pb-1">
            <View className="w-10 h-1 rounded-full bg-black/10" />
          </View>

          <ScrollView
            bounces={false}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View className="px-5 pb-4 pt-2">
              {/* Header */}
              <Text className="text-foreground text-[18px] font-bold tracking-tight mb-4">
                {t.skillsAddCustomMcp}
              </Text>

              {/* Quick Import */}
              {showQuickImport ? (
                <View className="mb-4">
                  {quickImportError && (
                    <View
                      className="rounded-xl px-4 py-2.5 mb-2"
                      style={{ backgroundColor: 'rgba(255,59,48,0.12)' }}
                    >
                      <Text className="text-red-500 text-[13px]">{quickImportError}</Text>
                    </View>
                  )}
                  <TextInput
                    multiline
                    autoCapitalize="none"
                    autoCorrect={false}
                    className="bg-foreground/5 rounded-xl px-4 py-3 text-foreground text-[13px] mb-2"
                    numberOfLines={8}
                    placeholder={t.skillsCustomMcpQuickImportPlaceholder}
                    placeholderTextColor="#999"
                    value={quickImportText}
                    style={{
                      borderColor: 'rgba(0,0,0,0.08)',
                      borderWidth: 1,
                      minHeight: 160,
                      textAlignVertical: 'top',
                    }}
                    onChangeText={(v) => {
                      setQuickImportText(v);
                      if (quickImportError) setQuickImportError(null);
                    }}
                  />
                  <View className="flex-row gap-2">
                    <Pressable
                      className="flex-1 py-2.5 px-4 rounded-lg items-center"
                      style={{ borderColor: 'rgba(0,0,0,0.1)', borderWidth: 1 }}
                      onPress={() => setShowQuickImport(false)}
                    >
                      <Text className="text-secondary/60 text-[13px] font-semibold">
                        {t.cancel}
                      </Text>
                    </Pressable>
                    <Pressable
                      className={`flex-1 rounded-lg py-2.5 px-4 items-center active:opacity-80 ${isQuickImportReady ? 'bg-primary' : 'bg-foreground/10'}`}
                      disabled={!isQuickImportReady}
                      onPress={handleQuickImport}
                    >
                      <Text
                        className={`text-[13px] font-semibold ${isQuickImportReady ? 'text-white' : 'text-secondary/40'}`}
                      >
                        {t.confirm}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable
                  className="rounded-2xl py-3.5 items-center mb-4 active:opacity-80"
                  style={{
                    backgroundColor: 'rgba(0,122,255,0.06)',
                    borderColor: 'rgba(0,122,255,0.35)',
                    borderRadius: 16,
                    borderStyle: 'dashed',
                    borderWidth: 1.5,
                  }}
                  onPress={() => {
                    setQuickImportError(null);
                    setShowQuickImport(true);
                  }}
                >
                  <Text className="text-primary text-[14px] font-semibold">
                    {t.skillsCustomMcpQuickImport}
                  </Text>
                </Pressable>
              )}

              {/* Identifier */}
              <Text className="text-foreground/70 text-[13px] font-medium mb-1.5">
                {t.skillsCustomMcpIdentifier}
              </Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                className={`bg-foreground/5 rounded-xl px-4 py-3 text-foreground text-[14px] mb-1 ${errors.identifier ? 'border border-red-500' : ''}`}
                editable={!saving}
                placeholder={t.skillsCustomMcpIdentifierPlaceholder}
                placeholderTextColor="#999"
                value={identifier}
                onChangeText={(v) => {
                  setIdentifier(v);
                  if (errors.identifier) setErrors((e) => ({ ...e, identifier: '' }));
                  setTestResult(null);
                }}
              />
              {errors.identifier ? (
                <Text className="text-red-500 text-[11px] mb-2">{errors.identifier}</Text>
              ) : (
                <View className="mb-2" />
              )}

              {/* URL */}
              <Text className="text-foreground/70 text-[13px] font-medium mb-1.5">
                {t.skillsCustomMcpUrl}
              </Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                className={`bg-foreground/5 rounded-xl px-4 py-3 text-foreground text-[14px] mb-1 ${errors.url ? 'border border-red-500' : ''}`}
                editable={!saving}
                keyboardType="url"
                placeholder={t.skillsCustomMcpUrlPlaceholder}
                placeholderTextColor="#999"
                value={url}
                onChangeText={(v) => {
                  setUrl(v);
                  if (errors.url) setErrors((e) => ({ ...e, url: '' }));
                  setTestResult(null);
                }}
              />
              {errors.url ? (
                <Text className="text-red-500 text-[11px] mb-2">{errors.url}</Text>
              ) : (
                <View className="mb-2" />
              )}

              {/* Auth */}
              <Text className="text-foreground/70 text-[13px] font-medium mb-1.5">
                {t.skillsCustomMcpAuth}
              </Text>
              <View
                className="flex-row mb-3 bg-foreground/5 rounded-xl p-1"
                style={{ borderColor: 'rgba(0,0,0,0.06)', borderWidth: 1 }}
              >
                <Pressable
                  className={`flex-1 py-2.5 rounded-lg items-center border ${
                    authType === 'none' ? 'bg-primary/10 border-primary/20' : 'border-transparent'
                  }`}
                  onPress={() => setAuthType('none')}
                >
                  <Text
                    className={`text-[13px] font-semibold ${authType === 'none' ? 'text-primary' : 'text-secondary/60'}`}
                  >
                    {t.skillsCustomMcpAuthNone}
                  </Text>
                </Pressable>
                <Pressable
                  className={`flex-1 py-2.5 rounded-lg items-center border ${
                    authType === 'bearer' ? 'bg-primary/10 border-primary/20' : 'border-transparent'
                  }`}
                  onPress={() => setAuthType('bearer')}
                >
                  <Text
                    className={`text-[13px] font-semibold ${authType === 'bearer' ? 'text-primary' : 'text-secondary/60'}`}
                  >
                    {t.skillsCustomMcpAuthBearer}
                  </Text>
                </Pressable>
              </View>

              {authType === 'bearer' && (
                <>
                  <Text className="text-foreground/70 text-[13px] font-medium mb-1.5">
                    {t.skillsCustomMcpToken}
                  </Text>
                  <TextInput
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    className="bg-foreground/5 rounded-xl px-4 py-3 text-foreground text-[14px] mb-3"
                    editable={!saving}
                    placeholder={t.skillsCustomMcpTokenPlaceholder}
                    placeholderTextColor="#999"
                    value={token}
                    onChangeText={setToken}
                  />
                </>
              )}

              {/* Test Connection */}
              <View className="mb-3">
                <Pressable
                  disabled={!isConnectionReady || testing}
                  style={{ borderColor: 'rgba(0,0,0,0.08)', borderWidth: 1 }}
                  className={`rounded-xl py-3 items-center active:opacity-80 ${
                    isConnectionReady ? 'bg-primary' : 'bg-foreground/5'
                  }`}
                  onPress={handleTestConnection}
                >
                  {testing ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text
                      className={`text-[13px] font-semibold ${isConnectionReady ? 'text-white' : 'text-secondary/40'}`}
                    >
                      {t.skillsCustomMcpTestConnection}
                    </Text>
                  )}
                </Pressable>
              </View>

              {testResult && (
                <View
                  className={`rounded-xl px-4 py-2.5 mb-3 ${testResult === 'success' ? 'bg-green-500/10' : 'bg-red-500/10'}`}
                >
                  <Text
                    className={`text-[13px] ${testResult === 'success' ? 'text-green-600' : 'text-red-500'}`}
                  >
                    {testResult === 'success'
                      ? t.skillsCustomMcpTestSuccess
                      : t.skillsCustomMcpTestFailed}
                  </Text>
                </View>
              )}

              {/* Advanced Toggle */}
              <Pressable
                className="flex-row items-center justify-between px-3 py-3 rounded-xl mb-2 active:opacity-80"
                style={{
                  backgroundColor: 'rgba(0,0,0,0.03)',
                  borderColor: 'rgba(0,0,0,0.06)',
                  borderWidth: 1,
                }}
                onPress={() => setShowAdvanced(!showAdvanced)}
              >
                <Text
                  className={`text-[13px] font-semibold ${showAdvanced ? 'text-primary' : 'text-foreground/70'}`}
                >
                  {t.skillsCustomMcpAdvanced}
                </Text>
                <ChevronRight
                  color={showAdvanced ? semanticColors.primary : '#999'}
                  size={16}
                  strokeWidth={tokens.icon.strokeWidth}
                  style={{ transform: [{ rotate: showAdvanced ? '90deg' : '0deg' }] }}
                />
              </Pressable>

              {showAdvanced && (
                <>
                  {/* Headers */}
                  <Text className="text-foreground/70 text-[13px] font-medium mb-1.5">
                    {t.skillsCustomMcpHeaders}
                  </Text>
                  {headers.map((h, i) => (
                    <View className="flex-row gap-2 mb-2" key={i}>
                      <TextInput
                        autoCapitalize="none"
                        autoCorrect={false}
                        className="flex-1 bg-foreground/5 rounded-xl px-3 py-2.5 text-foreground text-[13px]"
                        placeholder={t.skillsCustomMcpHeaderKey}
                        placeholderTextColor="#999"
                        value={h.key}
                        onChangeText={(v) => {
                          const newH = [...headers];
                          newH[i] = { ...newH[i], key: v };
                          setHeaders(newH);
                        }}
                      />
                      <TextInput
                        autoCapitalize="none"
                        autoCorrect={false}
                        className="flex-1 bg-foreground/5 rounded-xl px-3 py-2.5 text-foreground text-[13px]"
                        placeholder={t.skillsCustomMcpHeaderValue}
                        placeholderTextColor="#999"
                        value={h.value}
                        onChangeText={(v) => {
                          const newH = [...headers];
                          newH[i] = { ...newH[i], value: v };
                          setHeaders(newH);
                        }}
                      />
                      <Pressable
                        className="justify-center px-1 active:opacity-60"
                        onPress={() => setHeaders(headers.filter((_, idx) => idx !== i))}
                      >
                        <Trash2 color="#ff3b30" size={16} strokeWidth={tokens.icon.strokeWidth} />
                      </Pressable>
                    </View>
                  ))}
                  <Pressable
                    className="mb-3 active:opacity-60"
                    onPress={() => setHeaders([...headers, { key: '', value: '' }])}
                  >
                    <Text className="text-primary text-[13px] font-medium">
                      + {t.skillsCustomMcpHeadersAdd}
                    </Text>
                  </Pressable>

                  {/* Description */}
                  <Text className="text-foreground/70 text-[13px] font-medium mb-1.5">
                    {t.skillsCustomMcpDesc}
                  </Text>
                  <TextInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    className="bg-foreground/5 rounded-xl px-4 py-3 text-foreground text-[14px] mb-3"
                    editable={!saving}
                    placeholder={t.skillsCustomMcpDescPlaceholder}
                    placeholderTextColor="#999"
                    value={description}
                    onChangeText={setDescription}
                  />

                  {/* Avatar */}
                  <Text className="text-foreground/70 text-[13px] font-medium mb-1.5">
                    {t.skillsCustomMcpAvatar}
                  </Text>
                  <TextInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    className="bg-foreground/5 rounded-xl px-4 py-3 text-foreground text-[14px] mb-3"
                    editable={!saving}
                    keyboardType="url"
                    placeholder={t.skillsCustomMcpAvatarPlaceholder}
                    placeholderTextColor="#999"
                    value={avatar}
                    onChangeText={setAvatar}
                  />
                </>
              )}

              {/* Save button */}
              <Pressable
                className={`rounded-xl py-3.5 items-center mt-2 active:opacity-80 ${isConnectionReady ? 'bg-primary' : 'bg-foreground/5'}`}
                disabled={!isConnectionReady || saving}
                style={{ borderColor: 'rgba(0,0,0,0.08)', borderWidth: 1 }}
                onPress={handleSave}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text
                    className={`font-semibold text-[15px] ${isConnectionReady ? 'text-white' : 'text-secondary/40'}`}
                  >
                    {t.save}
                  </Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
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
  const [importUrlVisible, setImportUrlVisible] = useState(false);
  const [importGithubVisible, setImportGithubVisible] = useState(false);
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

  const handleAddCustomMcp = async (params: {
    auth?: { token?: string; type: 'none' | 'bearer' };
    avatar?: string;
    description?: string;
    headers?: Record<string, string>;
    identifier: string;
    url: string;
  }) => {
    try {
      const mcpConfig: Record<string, any> = { type: 'http', url: params.url };
      if (params.auth && params.auth.type !== 'none') {
        mcpConfig.auth = params.auth;
      }
      if (params.headers) {
        mcpConfig.headers = params.headers;
      }

      let manifest: Record<string, any>;
      try {
        manifest = await mcpApi.getStreamableMcpServerManifest({
          auth: params.auth
            ? { token: params.auth.token, type: params.auth.type as 'none' | 'bearer' }
            : undefined,
          headers: params.headers,
          identifier: params.identifier.trim(),
          metadata: {
            avatar: params.avatar,
            description: params.description,
          },
          url: params.url.trim(),
        });
      } catch {
        manifest = {
          identifier: params.identifier,
          meta: {
            avatar: params.avatar,
            description: params.description || params.url,
            title: params.identifier,
          },
        };
      }

      await pluginApi.createOrInstall({
        customParams: {
          avatar: params.avatar,
          description: params.description,
          mcp: mcpConfig,
        },
        identifier: params.identifier,
        manifest,
        type: 'customPlugin',
      });
      toast.show('success', t.skillsCustomMcpSaved);
      await fetchAll();
    } catch {
      toast.show('error', t.errorSaveFailed);
      throw new Error('save failed');
    }
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={t.skillsTitle}
        leftElement={
          canGoBack ? (
            <ArrowLeft color="#111" size={22} strokeWidth={tokens.icon.strokeWidth} />
          ) : undefined
        }
        rightElement={
          <View className="flex-row items-center gap-1">
            <TouchableOpacity
              activeOpacity={0.6}
              className="w-10 h-10 items-center justify-center"
              onPress={() => navigation.navigate('SkillMarket')}
            >
              <ShoppingBag color="#007aff" size={20} strokeWidth={tokens.icon.strokeWidth} />
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.6}
              className="w-10 h-10 items-center justify-center"
              onPress={onRefresh}
            >
              <RefreshCw color="#007aff" size={20} strokeWidth={tokens.icon.strokeWidth} />
            </TouchableOpacity>
          </View>
        }
        onPressLeft={canGoBack ? () => navigation.goBack() : undefined}
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
                      onPress={() =>
                        navigation.navigate('SkillDetail', {
                          skillId: skill.id,
                          skillName: skill.name,
                        })
                      }
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
                      onPress={() =>
                        navigation.navigate('SkillDetail', {
                          skillId: skill.id,
                          skillName: skill.name,
                        })
                      }
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

          {/* Action Buttons — aligned with web AddSkillButton dropdown */}
          <View className="px-5 mt-6 gap-2">
            <Animated.View entering={FadeInDown.delay(200).duration(300)}>
              <PressableScale
                className="bg-foreground/5 rounded-2xl overflow-hidden"
                onPress={() => setImportUrlVisible(true)}
              >
                <View className="flex-row items-center px-4 py-3.5">
                  <View className="w-8 h-8 rounded-full bg-blue-500/10 items-center justify-center mr-3">
                    <LinkIcon color="#007aff" size={16} strokeWidth={tokens.icon.strokeWidth} />
                  </View>
                  <Text className="flex-1 text-foreground font-medium text-[15px]">
                    {t.skillsImportUrl}
                  </Text>
                  <ChevronRight color="#c0c0c0" size={18} strokeWidth={tokens.icon.strokeWidth} />
                </View>
              </PressableScale>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(225).duration(300)}>
              <PressableScale
                className="bg-foreground/5 rounded-2xl overflow-hidden"
                onPress={() => setImportGithubVisible(true)}
              >
                <View className="flex-row items-center px-4 py-3.5">
                  <View className="w-8 h-8 rounded-full bg-foreground/10 items-center justify-center mr-3">
                    <Github color="#333" size={16} strokeWidth={tokens.icon.strokeWidth} />
                  </View>
                  <Text className="flex-1 text-foreground font-medium text-[15px]">
                    {t.skillsImportGithub}
                  </Text>
                  <ChevronRight color="#c0c0c0" size={18} strokeWidth={tokens.icon.strokeWidth} />
                </View>
              </PressableScale>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(250).duration(300)}>
              <PressableScale
                className="bg-foreground/5 rounded-2xl overflow-hidden"
                onPress={() => {
                  // TODO: Upload ZIP (requires file picker integration)
                  toast.show('info', 'Coming soon');
                }}
              >
                <View className="flex-row items-center px-4 py-3.5">
                  <View className="w-8 h-8 rounded-full bg-orange-500/10 items-center justify-center mr-3">
                    <FileArchive color="#f97316" size={16} strokeWidth={tokens.icon.strokeWidth} />
                  </View>
                  <Text className="flex-1 text-foreground font-medium text-[15px]">
                    {t.skillsUploadZip}
                  </Text>
                  <ChevronRight color="#c0c0c0" size={18} strokeWidth={tokens.icon.strokeWidth} />
                </View>
              </PressableScale>
            </Animated.View>

            {/* Divider */}
            <View className="h-px bg-foreground/10 mx-2 my-1" />

            <Animated.View entering={FadeInDown.delay(275).duration(300)}>
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
      <SimpleImportModal
        buttonText={t.skillsImportUrl}
        placeholder={t.skillsImportUrlPlaceholder}
        t={t}
        title={t.skillsImportUrl}
        visible={importUrlVisible}
        onClose={() => setImportUrlVisible(false)}
        onImport={handleImportUrl}
      />
      <SimpleImportModal
        buttonText={t.skillsImportGithub}
        placeholder={t.skillsImportGithubPlaceholder}
        t={t}
        title={t.skillsImportGithub}
        visible={importGithubVisible}
        onClose={() => setImportGithubVisible(false)}
        onImport={handleImportGitHub}
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
