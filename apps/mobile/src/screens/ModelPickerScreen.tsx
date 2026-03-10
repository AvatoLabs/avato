/**
 * ModelPickerScreen — Select the default AI model.
 */
import { ArrowLeft, Check, Sparkles } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '../components/ui/ScreenHeader';
import { SearchField } from '../components/ui/SearchField';
import { useI18n } from '../lib/i18n';
import { tokens } from '../theme/tokens';

interface ModelOption {
  id: string;
  initial: string;
  name: string;
  provider: string;
  tags?: string[];
}

const MODELS: ModelOption[] = [
  { id: 'gpt-4o', initial: 'OA', name: 'GPT-4o', provider: 'OpenAI', tags: ['Popular', 'Multimodal'] },
  { id: 'gpt-4o-mini', initial: 'OA', name: 'GPT-4o Mini', provider: 'OpenAI', tags: ['Fast', 'Affordable'] },
  { id: 'gpt-4-turbo', initial: 'OA', name: 'GPT-4 Turbo', provider: 'OpenAI', tags: ['128K'] },
  { id: 'o1', initial: 'OA', name: 'o1', provider: 'OpenAI', tags: ['Reasoning'] },
  { id: 'o1-mini', initial: 'OA', name: 'o1 Mini', provider: 'OpenAI', tags: ['Reasoning', 'Fast'] },
  { id: 'claude-3.5-sonnet', initial: 'AN', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', tags: ['Popular'] },
  { id: 'claude-3-opus', initial: 'AN', name: 'Claude 3 Opus', provider: 'Anthropic', tags: ['Powerful'] },
  { id: 'claude-3-haiku', initial: 'AN', name: 'Claude 3 Haiku', provider: 'Anthropic', tags: ['Fast'] },
  { id: 'gemini-2.0-flash', initial: 'GE', name: 'Gemini 2.0 Flash', provider: 'Google', tags: ['Fast'] },
  { id: 'gemini-1.5-pro', initial: 'GE', name: 'Gemini 1.5 Pro', provider: 'Google', tags: ['1M context'] },
  { id: 'deepseek-chat', initial: 'DS', name: 'DeepSeek Chat', provider: 'DeepSeek', tags: ['Open', 'Affordable'] },
  { id: 'deepseek-reasoner', initial: 'DS', name: 'DeepSeek R1', provider: 'DeepSeek', tags: ['Reasoning'] },
  { id: 'llama-3.3-70b', initial: 'GQ', name: 'Llama 3.3 70B', provider: 'Groq', tags: ['Fast', 'Open'] },
  { id: 'mixtral-8x7b', initial: 'GQ', name: 'Mixtral 8x7B', provider: 'Groq', tags: ['Open', 'MoE'] },
  { id: 'qwen-2.5-72b', initial: 'OL', name: 'Qwen 2.5 72B', provider: 'Ollama', tags: ['Local'] },
];

export default function ModelPickerScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { t } = useI18n();

  const [selected, setSelected] = useState('gpt-4o-mini');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = MODELS.filter(
    (m) =>
      !searchQuery ||
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.provider.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const grouped = filtered.reduce<Record<string, ModelOption[]>>((acc, m) => {
    (acc[m.provider] = acc[m.provider] || []).push(m);
    return acc;
  }, {});

  const handleSelect = (id: string) => {
    setSelected(id);
    setTimeout(() => navigation.goBack(), 200);
  };

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={t.modelPickerTitle}
        leftElement={
          <ArrowLeft color={isDark ? '#fff' : '#111'} size={22} strokeWidth={tokens.icon.strokeWidth} />
        }
        onPressLeft={() => navigation.goBack()}
      />

      {/* Search */}
      <View className="px-5 py-2 bg-background z-10">
        <SearchField
          placeholder={t.modelPickerSearch}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40, paddingTop: 8 }}>
        {Object.entries(grouped).map(([provider, models], gi) => (
          <Animated.View entering={FadeInDown.delay(gi * 60).duration(250)} key={provider}>
            <Text className="px-5 mt-4 mb-2 text-secondary/60 text-[12px] font-medium uppercase tracking-wider">
              {provider}
            </Text>
            <View className="mx-4 bg-foreground/5 dark:bg-white/5 rounded-2xl overflow-hidden">
              {models.map((model) => (
                <TouchableOpacity
                  activeOpacity={0.6}
                  className="flex-row items-center px-4 py-3.5 active:bg-foreground/5"
                  key={model.id}
                  onPress={() => handleSelect(model.id)}
                >
                  <View className="w-8 h-8 rounded-full bg-foreground/5 dark:bg-white/5 items-center justify-center mr-3">
                    <Text className="text-foreground/60 text-[10px] font-semibold">{model.initial}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className={`text-[15px] font-medium tracking-tight ${selected === model.id ? 'text-primary' : 'text-foreground'}`}>
                      {model.name}
                    </Text>
                    {model.tags && model.tags.length > 0 && (
                      <View className="flex-row flex-wrap gap-1 mt-1">
                        {model.tags.map((tag) => (
                          <View
                            className="bg-foreground/5 dark:bg-white/5 px-2 py-0.5 rounded-full"
                            key={tag}
                          >
                            <Text className="text-secondary/60 text-[10px] font-medium">{tag}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                  {selected === model.id && <Check color="#007aff" size={20} strokeWidth={tokens.icon.strokeWidth} />}
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        ))}
      </ScrollView>
    </View>
  );
}
