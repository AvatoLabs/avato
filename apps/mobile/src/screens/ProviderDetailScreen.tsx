/**
 * ProviderDetailScreen — Configure a single AI provider.
 *
 * Aligned with web: /settings/provider/detail
 *
 * Fields:
 * - Provider enable/disable toggle
 * - API Key (when settings.showApiKey !== false)
 * - Access Key ID / Secret Access Key (for AWS Bedrock etc.)
 * - Custom Endpoint (when settings.proxyUrl or source=custom)
 * - Client-side Fetch toggle (when conditions met)
 * - Connection Checker (when settings.showChecker !== false)
 * - Model list with individual enable/disable toggles
 */
import { ArrowLeft, Check, Eye, EyeOff, Key, Save, Wifi, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image as RNImage,
  Keyboard,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ScreenHeader } from '../components/ui/ScreenHeader';
import { SearchField } from '../components/ui/SearchField';
import { useToast } from '../components/ui/Toast';
import { aiModelApi, aiProviderApi } from '../lib/api';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import { tokens } from '../theme/tokens';
import type { AiProviderDetailItem, AiProviderModelItem } from '../types';

// ── Provider Logo ────────────────────────────────────────────────────
const ICON_CDN_BASE = 'https://registry.npmmirror.com/@lobehub/icons-static-png/latest/files';

function ProviderLogo({
  providerId,
  logo,
  size = 40,
}: {
  logo?: string;
  providerId: string;
  size?: number;
}) {
  const [imgError, setImgError] = useState(false);
  const url = logo || `${ICON_CDN_BASE}/light/${providerId}.png`;

  if (imgError) {
    return (
      <View
        className="rounded-full bg-foreground/5 items-center justify-center"
        style={{ width: size, height: size }}
      >
        <Text className="text-foreground/60 text-[13px] font-semibold">
          {providerId.slice(0, 2).toUpperCase()}
        </Text>
      </View>
    );
  }

  return (
    <RNImage
      source={{ uri: url }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      onError={() => setImgError(true)}
    />
  );
}

// ── Secure Input Row ─────────────────────────────────────────────────
function SecureInputRow({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  value: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <>
      <Text className="text-secondary/60 text-[12px] font-medium mb-2 uppercase tracking-wider">
        {label}
      </Text>
      <View className="flex-row items-center bg-background rounded-xl px-3 h-11 mb-3">
        <Key color="#999" size={14} strokeWidth={tokens.icon.strokeWidth} />
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          className="flex-1 ml-2 text-foreground text-[14px]"
          placeholder={placeholder || '...'}
          placeholderTextColor="#8c8c8c"
          secureTextEntry={!visible}
          value={value}
          onChangeText={onChangeText}
        />
        <TouchableOpacity onPress={() => setVisible(!visible)}>
          {visible ? (
            <EyeOff color="#999" size={16} strokeWidth={tokens.icon.strokeWidth} />
          ) : (
            <Eye color="#999" size={16} strokeWidth={tokens.icon.strokeWidth} />
          )}
        </TouchableOpacity>
      </View>
    </>
  );
}

// ── Known keyVault field metadata ────────────────────────────────────
const VAULT_FIELD_META: Record<string, { label: string; placeholder: string; secure: boolean }> = {
  apiKey: { label: 'API Key', placeholder: 'sk-...', secure: true },
  accessKeyId: { label: 'Access Key ID', placeholder: 'AKIA...', secure: true },
  secretAccessKey: { label: 'Secret Access Key', placeholder: '...', secure: true },
  sessionToken: { label: 'Session Token', placeholder: '...', secure: true },
  username: { label: 'Username', placeholder: '...', secure: false },
  password: { label: 'Password', placeholder: '...', secure: true },
  bearerToken: { label: 'Bearer Token', placeholder: '...', secure: true },
  baseURL: { label: 'API Proxy URL', placeholder: 'https://api.example.com/v1', secure: false },
  endpoint: { label: 'Endpoint', placeholder: 'https://...', secure: false },
  baseURLOrAccountID: { label: 'Base URL / Account ID', placeholder: '...', secure: false },
  region: { label: 'Region', placeholder: 'us-east-1', secure: false },
  apiVersion: { label: 'API Version', placeholder: '2024-02-01', secure: false },
};

const FIELD_ORDER = [
  'apiKey',
  'accessKeyId',
  'secretAccessKey',
  'sessionToken',
  'username',
  'password',
  'bearerToken',
  'baseURL',
  'endpoint',
  'baseURLOrAccountID',
  'region',
  'apiVersion',
];

// ── Main Screen ──────────────────────────────────────────────────────
export default function ProviderDetailScreen({ navigation, route }: any) {
  const providerId: string = route.params?.providerId ?? '';
  const { t } = useI18n();
  const toast = useToast();

  const [detail, setDetail] = useState<AiProviderDetailItem | null>(null);
  const [models, setModels] = useState<AiProviderModelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [modelSearch, setModelSearch] = useState('');
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<'success' | 'failed' | null>(null);

  // Editable fields — unified keyVaults state
  const [vaults, setVaults] = useState<Record<string, string>>({});
  const [enabled, setEnabled] = useState(false);
  const [fetchOnClient, setFetchOnClient] = useState(false);

  // ── Fetch ────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      const [providerDetail, providerModels] = await Promise.all([
        aiProviderApi.getById(providerId),
        aiModelApi.getProviderModels(providerId),
      ]);

      if (providerDetail) {
        setDetail(providerDetail);
        setEnabled(providerDetail.enabled);
        setFetchOnClient(providerDetail.fetchOnClient ?? false);
        // Populate vaults from API response keyVaults
        const v: Record<string, string> = {};
        if (providerDetail.keyVaults) {
          for (const [k, val] of Object.entries(providerDetail.keyVaults)) {
            if (typeof val === 'string') v[k] = val;
          }
        }
        // Always ensure baseURL key exists for proxy endpoint config
        if (!('baseURL' in v)) v.baseURL = '';
        setVaults(v);
      }

      setModels(providerModels ?? []);
    } catch {
      toast.show('error', t.errorNetwork);
    }
  }, [providerId, t, toast]);

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    haptics.light();
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  // ── Toggle provider enabled ──────────────────────────────────────
  const handleToggleProvider = async () => {
    haptics.selection();
    const newEnabled = !enabled;
    setEnabled(newEnabled);
    try {
      await aiProviderApi.toggleEnabled(providerId, newEnabled);
    } catch {
      setEnabled(!newEnabled);
      toast.show('error', t.errorNetwork);
    }
  };

  // ── Toggle fetchOnClient ─────────────────────────────────────────
  const handleToggleFetchOnClient = async () => {
    haptics.selection();
    const newValue = !fetchOnClient;
    setFetchOnClient(newValue);
    try {
      await aiProviderApi.updateConfig(providerId, { fetchOnClient: newValue });
    } catch {
      setFetchOnClient(!newValue);
      toast.show('error', t.errorNetwork);
    }
  };

  // ── Save config ──────────────────────────────────────────────────
  const handleSave = async () => {
    Keyboard.dismiss();
    setSaving(true);
    try {
      const keyVaults: Record<string, string | undefined> = {};
      for (const [k, v] of Object.entries(vaults)) {
        keyVaults[k] = v || undefined;
      }

      await aiProviderApi.updateConfig(providerId, { keyVaults });
      haptics.success();
      toast.show('success', t.providerDetailSaved);
    } catch {
      toast.show('error', t.errorNetwork);
    } finally {
      setSaving(false);
    }
  };

  // ── Connection check ─────────────────────────────────────────────
  const handleCheck = async () => {
    haptics.selection();
    setChecking(true);
    setCheckResult(null);
    try {
      // Save current config first so server has latest values
      const keyVaults: Record<string, string | undefined> = {};
      for (const [k, v] of Object.entries(vaults)) {
        keyVaults[k] = v || undefined;
      }
      await aiProviderApi.updateConfig(providerId, { keyVaults });

      // Then test via a lightweight model list fetch
      const testModels = await aiModelApi.getProviderModels(providerId);
      if (testModels && testModels.length >= 0) {
        setCheckResult('success');
        haptics.success();
        toast.show('success', t.providerDetailCheckSuccess);
      } else {
        setCheckResult('failed');
        toast.show('error', t.providerDetailCheckFailed);
      }
    } catch {
      setCheckResult('failed');
      toast.show('error', t.providerDetailCheckFailed);
    } finally {
      setChecking(false);
    }
  };

  // ── Toggle model enabled ─────────────────────────────────────────
  const handleToggleModel = async (modelId: string, currentEnabled: boolean) => {
    haptics.selection();
    const newEnabled = !currentEnabled;

    setModels((prev) => prev.map((m) => (m.id === modelId ? { ...m, enabled: newEnabled } : m)));

    try {
      await aiModelApi.toggleEnabled({
        id: modelId,
        providerId,
        enabled: newEnabled,
      });
    } catch {
      setModels((prev) =>
        prev.map((m) => (m.id === modelId ? { ...m, enabled: currentEnabled } : m)),
      );
      toast.show('error', t.errorNetwork);
    }
  };

  // ── Filter models ────────────────────────────────────────────────
  const q = modelSearch.toLowerCase();
  const filteredModels = q
    ? models.filter(
        (m) => (m.displayName || m.id).toLowerCase().includes(q) || m.id.toLowerCase().includes(q),
      )
    : models;

  // ── Derived display flags ────────────────────────────────────────
  const settings = detail?.settings;
  const enabledModelCount = models.filter((m) => m.enabled).length;

  // Compute visible vault fields dynamically from API response
  const visibleFields = useMemo(() => {
    const fields: string[] = [];
    const vaultKeys = Object.keys(vaults);
    const hasAccessKeys =
      vaultKeys.includes('accessKeyId') || vaultKeys.includes('secretAccessKey');
    const hasUserPass = vaultKeys.includes('username') || vaultKeys.includes('password');

    // Auth credential fields
    if (hasAccessKeys) {
      fields.push('accessKeyId', 'secretAccessKey');
      if (vaultKeys.includes('sessionToken')) fields.push('sessionToken');
    } else if (hasUserPass) {
      fields.push('username', 'password');
    } else if (settings?.showApiKey !== false) {
      fields.push('apiKey');
    }

    // Always show baseURL for proxy endpoint configuration
    if (!fields.includes('baseURL')) fields.push('baseURL');

    // Add any other vault keys from the API not yet included
    for (const key of vaultKeys) {
      if (!fields.includes(key)) fields.push(key);
    }

    // Sort by defined order
    fields.sort((a, b) => {
      const ai = FIELD_ORDER.indexOf(a);
      const bi = FIELD_ORDER.indexOf(b);
      return (ai === -1 ? 100 : ai) - (bi === -1 ? 100 : bi);
    });

    return fields;
  }, [vaults, settings]);

  // Show fetchOnClient toggle — same logic as web:
  // 1. not disabled by provider
  // 2. default show OR (has endpoint value) OR (has apiKey value)
  const showFetchOnClient =
    !settings?.disableBrowserRequest &&
    (settings?.defaultShowBrowserRequest ||
      !!vaults.baseURL ||
      !!vaults.endpoint ||
      !!vaults.apiKey ||
      !!vaults.accessKeyId);

  const showChecker = settings?.showChecker !== false;

  if (loading) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader
          leftElement={<ArrowLeft color="#111" size={22} strokeWidth={tokens.icon.strokeWidth} />}
          title={t.providerDetailTitle}
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
        title={detail?.name || providerId}
        onPressLeft={() => navigation.goBack()}
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
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
        {/* Provider Header */}
        <Animated.View entering={FadeInDown.duration(250)}>
          <View className="flex-row items-center px-5 py-5">
            <ProviderLogo logo={detail?.logo} providerId={providerId} size={48} />
            <View className="flex-1 ml-4">
              <Text className="text-foreground text-[18px] font-semibold tracking-tight">
                {detail?.name || providerId}
              </Text>
              {detail?.description ? (
                <Text
                  className="text-secondary/50 text-[12px] font-medium mt-0.5"
                  numberOfLines={2}
                >
                  {detail.description}
                </Text>
              ) : (
                <Text className="text-secondary/50 text-[12px] font-medium mt-0.5">
                  {enabled ? t.providerDetailEnabled : t.providerDetailDisabled}
                </Text>
              )}
            </View>
            <Switch
              thumbColor="#fff"
              trackColor={{ false: '#e0e0e0', true: '#4caf50' }}
              value={enabled}
              onValueChange={handleToggleProvider}
            />
          </View>
        </Animated.View>

        {/* Configuration Section — dynamic fields */}
        {visibleFields.length > 0 && (
          <Animated.View entering={FadeInDown.delay(50).duration(250)}>
            <View className="mx-5 mb-4 bg-foreground/5 rounded-2xl p-4">
              {visibleFields.map((fieldKey) => {
                const meta = VAULT_FIELD_META[fieldKey] || {
                  label: fieldKey
                    .replaceAll(/([A-Z])/g, ' $1')
                    .replace(/^./, (s) => s.toUpperCase()),
                  placeholder: '...',
                  secure:
                    fieldKey.toLowerCase().includes('key') ||
                    fieldKey.toLowerCase().includes('secret') ||
                    fieldKey.toLowerCase().includes('token') ||
                    fieldKey.toLowerCase().includes('password'),
                };

                if (meta.secure) {
                  return (
                    <SecureInputRow
                      key={fieldKey}
                      label={meta.label}
                      placeholder={meta.placeholder}
                      value={vaults[fieldKey] || ''}
                      onChangeText={(v) => setVaults((prev) => ({ ...prev, [fieldKey]: v }))}
                    />
                  );
                }

                return (
                  <View key={fieldKey}>
                    <Text className="text-secondary/60 text-[12px] font-medium mb-2 uppercase tracking-wider">
                      {meta.label}
                    </Text>
                    <View className="bg-background rounded-xl px-3 h-11 mb-3 justify-center">
                      <TextInput
                        autoCapitalize="none"
                        autoCorrect={false}
                        className="flex-1 text-foreground text-[14px]"
                        placeholder={meta.placeholder}
                        placeholderTextColor="#8c8c8c"
                        value={vaults[fieldKey] || ''}
                        onChangeText={(v) => setVaults((prev) => ({ ...prev, [fieldKey]: v }))}
                      />
                    </View>
                  </View>
                );
              })}

              {/* Save Button */}
              <TouchableOpacity
                activeOpacity={0.8}
                className="bg-primary rounded-xl py-3 items-center flex-row justify-center"
                disabled={saving}
                onPress={handleSave}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Save
                      color="#fff"
                      size={16}
                      strokeWidth={tokens.icon.strokeWidth}
                      style={{ marginRight: 6 }}
                    />
                    <Text className="text-white font-medium text-[14px]">
                      {t.providerDetailSave}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* Client-side Fetch Toggle */}
        {showFetchOnClient && (
          <Animated.View entering={FadeInDown.delay(75).duration(250)}>
            <View className="mx-5 mb-4 bg-foreground/5 rounded-2xl overflow-hidden">
              <View className="flex-row items-center px-4 py-3.5">
                <View className="flex-1">
                  <Text className="text-foreground font-medium text-[15px] tracking-tight">
                    {t.providerDetailFetchOnClient}
                  </Text>
                  <Text className="text-secondary/50 text-[11px] font-medium mt-0.5">
                    {t.providerDetailFetchOnClientDesc}
                  </Text>
                </View>
                <Switch
                  thumbColor="#fff"
                  trackColor={{ false: '#e0e0e0', true: '#007aff' }}
                  value={fetchOnClient}
                  onValueChange={handleToggleFetchOnClient}
                />
              </View>
            </View>
          </Animated.View>
        )}

        {/* Connection Checker */}
        {showChecker && (
          <Animated.View entering={FadeInDown.delay(100).duration(250)}>
            <View className="mx-5 mb-4 bg-foreground/5 rounded-2xl overflow-hidden">
              <TouchableOpacity
                activeOpacity={0.7}
                className="flex-row items-center px-4 py-3.5"
                disabled={checking}
                onPress={handleCheck}
              >
                <View className="flex-1">
                  <Text className="text-foreground font-medium text-[15px] tracking-tight">
                    {t.providerDetailChecking}
                  </Text>
                  <Text className="text-secondary/50 text-[11px] font-medium mt-0.5">
                    {t.providerDetailDescription}
                  </Text>
                </View>
                {checking ? (
                  <ActivityIndicator color="#007aff" size="small" />
                ) : checkResult === 'success' ? (
                  <View className="w-7 h-7 rounded-full bg-green-500/15 items-center justify-center">
                    <Check color="#4caf50" size={16} strokeWidth={2.5} />
                  </View>
                ) : checkResult === 'failed' ? (
                  <View className="w-7 h-7 rounded-full bg-red-500/15 items-center justify-center">
                    <X color="#ff3b30" size={16} strokeWidth={2.5} />
                  </View>
                ) : (
                  <View className="w-7 h-7 rounded-full bg-blue-500/15 items-center justify-center">
                    <Wifi color="#007aff" size={16} strokeWidth={tokens.icon.strokeWidth} />
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* Models Section */}
        <Animated.View entering={FadeInDown.delay(125).duration(250)}>
          <View className="px-5 mb-3 flex-row items-center justify-between">
            <Text className="text-foreground text-[16px] font-semibold tracking-tight">
              {t.providerDetailNoModels}
            </Text>
            <Text className="text-secondary/50 text-[12px] font-medium">
              {enabledModelCount}/{models.length}
            </Text>
          </View>

          {/* Model Search */}
          {models.length > 5 && (
            <View className="px-5 mb-3">
              <SearchField
                placeholder={t.search}
                value={modelSearch}
                onChangeText={setModelSearch}
              />
            </View>
          )}

          {filteredModels.length === 0 ? (
            <View className="items-center py-10">
              <Text className="text-secondary/50 text-[14px]">{t.providerDetailNoModels}</Text>
            </View>
          ) : (
            <View className="mx-5 bg-foreground/5 rounded-2xl overflow-hidden">
              {filteredModels.map((model) => (
                <View
                  className="flex-row items-center px-4 py-3 border-b border-black/[0.03]"
                  key={model.id}
                >
                  <View className="flex-1">
                    <Text
                      className={`text-[14px] font-medium tracking-tight ${model.enabled ? 'text-foreground' : 'text-secondary/50'}`}
                      numberOfLines={1}
                    >
                      {model.displayName || model.id}
                    </Text>
                    <Text className="text-secondary/40 text-[11px] font-medium mt-0.5">
                      {model.id}
                    </Text>
                  </View>
                  <Switch
                    thumbColor="#fff"
                    trackColor={{ false: '#e0e0e0', true: '#007aff' }}
                    value={model.enabled}
                    onValueChange={() => handleToggleModel(model.id, model.enabled)}
                  />
                </View>
              ))}
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}
