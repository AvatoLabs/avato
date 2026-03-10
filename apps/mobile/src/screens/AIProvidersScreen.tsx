/**
 * AIProvidersScreen — Manage AI service provider API keys.
 */
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Eye,
  EyeOff,
  Key,
  Plus,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useState } from 'react';
import {
  Alert,
  Image as RNImage,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '../components/ui/ScreenHeader';
import { useI18n } from '../lib/i18n';
import { tokens } from '../theme/tokens';

interface Provider {
  apiKey: string;
  color: string;
  enabled: boolean;
  endpoint: string;
  id: string;
  initial: string;
  name: string;
}

const DEFAULT_PROVIDERS: Provider[] = [
  { apiKey: '', color: '#10a37f', enabled: false, endpoint: '', id: 'openai', initial: 'OA', name: 'OpenAI' },
  { apiKey: '', color: '#c96442', enabled: false, endpoint: '', id: 'anthropic', initial: 'AN', name: 'Anthropic' },
  { apiKey: '', color: '#0066ff', enabled: false, endpoint: '', id: 'google', initial: 'GE', name: 'Google Gemini' },
  { apiKey: '', color: '#4a6cf7', enabled: false, endpoint: '', id: 'deepseek', initial: 'DS', name: 'DeepSeek' },
  { apiKey: '', color: '#ff6600', enabled: false, endpoint: '', id: 'openrouter', initial: 'OR', name: 'OpenRouter' },
  { apiKey: '', color: '#6c3baa', enabled: false, endpoint: '', id: 'ollama', initial: 'OL', name: 'Ollama (Local)' },
  { apiKey: '', color: '#333', enabled: false, endpoint: '', id: 'groq', initial: 'GQ', name: 'Groq' },
  { apiKey: '', color: '#1a1a2e', enabled: false, endpoint: '', id: 'custom', initial: 'CU', name: 'Custom Provider' },
];

export default function AIProvidersScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { t } = useI18n();

  const [providers, setProviders] = useState<Provider[]>(DEFAULT_PROVIDERS);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  const toggleProvider = (id: string) => {
    setProviders((prev) =>
      prev.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p)),
    );
  };

  const updateApiKey = (id: string, key: string) => {
    setProviders((prev) =>
      prev.map((p) => (p.id === id ? { ...p, apiKey: key } : p)),
    );
  };

  const updateEndpoint = (id: string, endpoint: string) => {
    setProviders((prev) =>
      prev.map((p) => (p.id === id ? { ...p, endpoint } : p)),
    );
  };

  const handleSave = (id: string) => {
    const provider = providers.find((p) => p.id === id);
    if (provider?.apiKey) {
      Alert.alert('Saved', `${provider.name} configuration saved.`);
      setExpandedId(null);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={t.aiProvidersTitle}
        leftElement={
          <ArrowLeft color={isDark ? '#fff' : '#111'} size={22} strokeWidth={tokens.icon.strokeWidth} />
        }
        onPressLeft={() => navigation.goBack()}
      />

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40, paddingTop: 16 }}>
        {/* Description */}
        <Text className="px-5 mb-4 text-secondary/70 text-[14px] leading-5 font-medium">
          {t.aiProvidersDesc}
        </Text>

        {/* Provider List */}
        {providers.map((provider, index) => (
          <Animated.View
            entering={FadeInDown.delay(index * 40).duration(250)}
            key={provider.id}
          >
            <View className="mx-5 mb-3 bg-foreground/5 dark:bg-white/5 rounded-2xl overflow-hidden">
              {/* Provider Header */}
              <TouchableOpacity
                activeOpacity={0.7}
                className="flex-row items-center px-4 py-4"
                onPress={() =>
                  setExpandedId(expandedId === provider.id ? null : provider.id)
                }
              >
                <View className="w-9 h-9 rounded-full bg-foreground/5 dark:bg-white/10 items-center justify-center mr-3">
                  <Text className="text-foreground/70 text-[11px] font-semibold">{provider.initial}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-foreground font-medium text-[15px] tracking-tight">
                    {provider.name}
                  </Text>
                  {provider.apiKey && (
                    <Text className="text-[#4caf50] text-[11px] mt-0.5 font-medium">
                      {t.aiProvidersEnabled}
                    </Text>
                  )}
                </View>
                <Switch
                  onValueChange={() => toggleProvider(provider.id)}
                  thumbColor="#fff"
                  trackColor={{ false: '#e0e0e0', true: '#4caf50' }}
                  value={provider.enabled}
                />
              </TouchableOpacity>

              {/* Expanded Config */}
              {expandedId === provider.id && (
                <View className="px-4 py-4">
                  {/* API Key */}
                  <Text className="text-secondary/60 text-[12px] font-medium mb-2 uppercase tracking-wider">
                    {t.aiProvidersApiKey}
                  </Text>
                  <View className="flex-row items-center bg-foreground/5 dark:bg-white/5 rounded-xl px-3 h-11 mb-3">
                    <Key color={isDark ? '#888' : '#999'} size={14} strokeWidth={tokens.icon.strokeWidth} />
                    <TextInput
                      autoCapitalize="none"
                      className="flex-1 ml-2 text-foreground text-[14px]"
                      onChangeText={(v) => updateApiKey(provider.id, v)}
                      placeholder="sk-..."
                      placeholderTextColor="#8c8c8c"
                      secureTextEntry={!showKeys[provider.id]}
                      value={provider.apiKey}
                    />
                    <TouchableOpacity
                      onPress={() =>
                        setShowKeys((prev) => ({
                          ...prev,
                          [provider.id]: !prev[provider.id],
                        }))
                      }
                    >
                      {showKeys[provider.id] ? (
                        <EyeOff color="#999" size={16} strokeWidth={tokens.icon.strokeWidth} />
                      ) : (
                        <Eye color="#999" size={16} strokeWidth={tokens.icon.strokeWidth} />
                      )}
                    </TouchableOpacity>
                  </View>

                  {/* Custom Endpoint */}
                  <Text className="text-secondary/60 text-[12px] font-medium mb-2 uppercase tracking-wider">
                    {t.aiProvidersEndpoint}
                  </Text>
                  <View className="bg-foreground/5 dark:bg-white/5 rounded-xl px-3 h-11 mb-4">
                    <TextInput
                      autoCapitalize="none"
                      className="flex-1 text-foreground text-[14px]"
                      onChangeText={(v) => updateEndpoint(provider.id, v)}
                      placeholder="https://api.example.com/v1"
                      placeholderTextColor="#8c8c8c"
                      value={provider.endpoint}
                    />
                  </View>

                  {/* Save */}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    className="bg-primary rounded-xl py-3 items-center active:opacity-90"
                    onPress={() => handleSave(provider.id)}
                  >
                    <Text className="text-white font-medium text-[14px]">
                      {t.aiProvidersSave}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </Animated.View>
        ))}
      </ScrollView>
    </View>
  );
}
