import { ArrowLeft, Save } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { ScreenHeader } from '../components/ui/ScreenHeader';
import { useToast } from '../components/ui/Toast';
import { semanticColors } from '../constants/colors';
import { useI18n } from '../lib/i18n';
import { useAgentStore } from '../store/agent';
import { useSessionStore } from '../store/session';
import { tokens } from '../theme/tokens';

export default function AgentConfigScreen({ navigation, route }: any) {
  const { t } = useI18n();
  const toast = useToast();
  const agentId = route.params?.agentId as string | undefined;

  const agents = useAgentStore((s) => s.agents);
  const initialized = useAgentStore((s) => s.initialized);
  const loadAgents = useAgentStore((s) => s.loadAgents);
  const createAgent = useAgentStore((s) => s.createAgent);
  const updateAgent = useAgentStore((s) => s.updateAgent);
  const attachSession = useAgentStore((s) => s.attachSession);

  const sessions = useSessionStore((s) => s.sessions);
  const fetchSessions = useSessionStore((s) => s.fetchSessions);
  const createSession = useSessionStore((s) => s.createSession);

  const target = useMemo(() => agents.find((item) => item.id === agentId), [agentId, agents]);

  const [title, setTitle] = useState(target?.title || '');
  const [avatar, setAvatar] = useState(target?.avatar || '🤖');
  const [systemRole, setSystemRole] = useState(target?.systemRole || '');
  const [model, setModel] = useState(target?.model || '');
  const [provider, setProvider] = useState(target?.provider || '');

  useEffect(() => {
    if (!initialized) {
      void loadAgents();
    }
  }, [initialized, loadAgents]);

  useEffect(() => {
    void fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    if (!target) return;
    setTitle(target.title);
    setAvatar(target.avatar || '🤖');
    setSystemRole(target.systemRole || '');
    setModel(target.model || '');
    setProvider(target.provider || '');
  }, [target]);

  const saveAgent = async () => {
    const payload = {
      avatar: avatar || '🤖',
      model: model || undefined,
      provider: provider || undefined,
      systemRole: systemRole || undefined,
      title: title || t.settingsDefaultAgent,
    };

    if (agentId) {
      await updateAgent(agentId, payload);
      return agentId;
    }

    return createAgent(payload);
  };

  const handleSave = async () => {
    try {
      await saveAgent();
      toast.show('success', t.toastSaved);
      navigation.goBack();
    } catch {
      toast.show('error', t.errorSaveFailed);
    }
  };

  const handleStartChat = async () => {
    try {
      const id = await saveAgent();
      const sessionId = await createSession({
        agentId: id,
        avatar: avatar || '🤖',
        model: model || undefined,
        provider: provider || undefined,
        systemPrompt: systemRole || undefined,
        title: title || t.chatListNewConversation,
      });
      await attachSession(id, sessionId);
      navigation.navigate('ChatDetail', { sessionId });
    } catch {
      toast.show('error', t.errorNetwork);
    }
  };

  const relatedSessions = sessions.filter((session) => session.agentId === agentId);

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={t.settingsDefaultAgent}
        leftElement={<ArrowLeft color={semanticColors.foreground} size={22} strokeWidth={tokens.icon.strokeWidth} />}
        rightElement={<Save color={semanticColors.primary} size={20} strokeWidth={tokens.icon.strokeWidth} />}
        onPressLeft={() => navigation.goBack()}
        onPressRight={() => void handleSave()}
      />

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 80, paddingTop: 12 }}>
        <View className="mx-5 mb-3">
          <Text className="text-secondary/60 text-[11px] font-semibold uppercase tracking-widest mb-2">
            Basic
          </Text>
          <View className="bg-foreground/[0.02] rounded-2xl p-4">
            <Text className="text-secondary/60 text-[12px] mb-1">Title</Text>
            <TextInput className="bg-foreground/[0.04] rounded-xl px-3 py-2.5 text-foreground mb-3" value={title} onChangeText={setTitle} />
            <Text className="text-secondary/60 text-[12px] mb-1">Avatar</Text>
            <TextInput className="bg-foreground/[0.04] rounded-xl px-3 py-2.5 text-foreground mb-3" value={avatar} onChangeText={setAvatar} />
            <Text className="text-secondary/60 text-[12px] mb-1">Model</Text>
            <TextInput className="bg-foreground/[0.04] rounded-xl px-3 py-2.5 text-foreground mb-3" value={model} onChangeText={setModel} />
            <Text className="text-secondary/60 text-[12px] mb-1">Provider</Text>
            <TextInput className="bg-foreground/[0.04] rounded-xl px-3 py-2.5 text-foreground" value={provider} onChangeText={setProvider} />
          </View>
        </View>

        <View className="mx-5 mb-3">
          <Text className="text-secondary/60 text-[11px] font-semibold uppercase tracking-widest mb-2">
            Prompt
          </Text>
          <View className="bg-foreground/[0.02] rounded-2xl p-4">
            <TextInput
              multiline
              className="bg-foreground/[0.04] rounded-xl px-3 py-2.5 text-foreground min-h-[120px]"
              placeholder={t.chatSettingsSystemPrompt}
              placeholderTextColor={semanticColors.muted}
              textAlignVertical="top"
              value={systemRole}
              onChangeText={setSystemRole}
            />
          </View>
        </View>

        {agentId && (
          <View className="mx-5 mb-4">
            <Text className="text-secondary/60 text-[11px] font-semibold uppercase tracking-widest mb-2">
              Chats
            </Text>
            <View className="bg-foreground/[0.02] rounded-2xl overflow-hidden">
              {relatedSessions.length === 0 ? (
                <Text className="text-secondary/60 px-4 py-4 text-[13px]">{t.storeEmpty}</Text>
              ) : (
                relatedSessions.map((session) => (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    className="px-4 py-3 border-b border-foreground/[0.05]"
                    key={session.id}
                    onPress={() => navigation.navigate('ChatDetail', { sessionId: session.id })}
                  >
                    <Text className="text-foreground text-[14px] font-medium" numberOfLines={1}>
                      {session.title}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          </View>
        )}
      </ScrollView>

      <View className="px-5 pb-8 pt-2 bg-background">
        <TouchableOpacity
          activeOpacity={0.8}
          className="bg-primary rounded-xl py-3.5 items-center"
          onPress={() => void handleStartChat()}
        >
          <Text className="text-white text-[15px] font-semibold">{t.discoverUseAgent}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
