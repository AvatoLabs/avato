/**
 * NotebookScreen — Personal documents and notes with Markdown support.
 *
 * Accessible from:
 *   1. ProfileScreen (standalone — uses a personal notes topic)
 *   2. ChatDetailScreen (per-topic — uses the chat's active topic)
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ArrowLeft,
  Edit3,
  Eye,
  FileText,
  NotebookPen,
  Plus,
  Trash2,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import PressableScale from '../components/ui/PressableScale';
import SwipeableRow from '../components/ui/SwipeableRow';
import { semanticColors } from '../constants/colors';
import { useToast } from '../components/ui/Toast';
import { notebookApi, type NotebookDocument, topicApi } from '../lib/api';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import { tokens } from '../theme/tokens';

const PERSONAL_TOPIC_KEY = 'avato_personal_notebook_topic_id';

// ── Markdown Styles ──────────────────────────────────────────────────

const mdStyles = {
  body: { color: '#1a1a1a', fontSize: 15, lineHeight: 24 },
  heading1: { color: semanticColors.foreground, fontSize: 24, fontWeight: '700' as const, marginBottom: 12, marginTop: 20 },
  heading2: { color: semanticColors.foreground, fontSize: 20, fontWeight: '700' as const, marginBottom: 10, marginTop: 18 },
  heading3: { color: semanticColors.foreground, fontSize: 17, fontWeight: '600' as const, marginBottom: 8, marginTop: 14 },
  paragraph: { marginBottom: 12 },
  bullet_list: { marginBottom: 12 },
  ordered_list: { marginBottom: 12 },
  list_item: { marginBottom: 4 },
  code_inline: {
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    color: '#e11d48',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  fence: {
    backgroundColor: '#1e1e2e',
    borderRadius: 12,
    color: '#cdd6f4',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 12,
    padding: 14,
  },
  blockquote: {
    backgroundColor: '#f8fafc',
    borderColor: semanticColors.primary,
    borderLeftWidth: 3,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  hr: { backgroundColor: '#e5e7eb', height: 1, marginVertical: 16 },
  link: { color: semanticColors.primary },
  strong: { fontWeight: '600' as const },
  table: { borderColor: '#e5e7eb', borderWidth: 0.5 },
  th: { backgroundColor: '#f9fafb', padding: 8 },
  td: { borderColor: '#e5e7eb', borderWidth: 0.5, padding: 8 },
};

// ── Document Editor ──────────────────────────────────────────────────

function DocEditor({
  doc,
  onBack,
  onSaved,
}: {
  doc: NotebookDocument;
  onBack: () => void;
  onSaved: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const toast = useToast();

  const [title, setTitle] = useState(doc.title || '');
  const [content, setContent] = useState(doc.content || '');
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);

  const savedTitleRef = useRef(doc.title || '');
  const savedContentRef = useRef(doc.content || '');

  const hasChanges = title !== savedTitleRef.current || content !== savedContentRef.current;

  const handleBack = useCallback(() => {
    if (!hasChanges) {
      onBack();
      return;
    }
    Alert.alert(t.notebookUnsavedTitle, t.notebookUnsavedDesc, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.notebookDiscard,
        style: 'destructive',
        onPress: onBack,
      },
      {
        text: t.save,
        style: 'default',
        onPress: async () => {
          await handleSave();
          onBack();
        },
      },
    ]);
  }, [hasChanges, onBack, t]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await notebookApi.update({ id: doc.id, title, content });
      savedTitleRef.current = title;
      savedContentRef.current = content;
      haptics.success();
      toast.show('success', t.notebookSaved);
      onSaved();
    } catch {
      toast.show('error', t.errorUnknown);
    } finally {
      setSaving(false);
    }
  }, [doc.id, title, content, t, toast, onSaved]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-background"
    >
      {/* Header */}
      <View
        className="flex-row items-center justify-between px-4"
        style={{ paddingTop: insets.top + 6, paddingBottom: 10 }}
      >
        <TouchableOpacity
          className="flex-row items-center"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          onPress={handleBack}
        >
          <ArrowLeft color={semanticColors.foreground} size={22} strokeWidth={tokens.icon.strokeWidth} />
        </TouchableOpacity>

        <View className="flex-row items-center gap-3">
          {/* Preview / Edit toggle */}
          <TouchableOpacity
            className="flex-row items-center rounded-full px-3 py-1.5"
            style={{ backgroundColor: previewing ? `${semanticColors.primary}10` : '#f3f4f6' }}
            onPress={() => setPreviewing(!previewing)}
          >
            {previewing ? (
              <>
                <Edit3 color={semanticColors.primary} size={14} strokeWidth={2} />
                <Text className="text-[12px] font-semibold ml-1.5" style={{ color: semanticColors.primary }}>
                  {t.notebookEdit}
                </Text>
              </>
            ) : (
              <>
                <Eye color={semanticColors.muted} size={14} strokeWidth={2} />
                <Text className="text-[12px] font-semibold text-secondary/60 ml-1.5">
                  {t.notebookPreview}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Save */}
          <TouchableOpacity disabled={saving || !hasChanges} onPress={handleSave}>
            <Text
              className="text-[15px] font-semibold"
              style={{ color: hasChanges ? semanticColors.primary : semanticColors.secondaryText }}
            >
              {t.save}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 60 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <View className="px-5 pt-5 pb-2">
          {previewing ? (
            <Text className="text-[22px] font-bold text-foreground tracking-tight">
              {title || t.notebookDocTitle}
            </Text>
          ) : (
            <TextInput
              className="text-[22px] font-bold text-foreground tracking-tight"
              placeholder={t.notebookDocTitlePlaceholder}
              placeholderTextColor={semanticColors.secondaryText}
              value={title}
              onChangeText={setTitle}
            />
          )}
        </View>

        {/* Body */}
        <View className="px-5 pt-2">
          {previewing ? (
            content.trim() ? (
              <Markdown style={mdStyles}>{content}</Markdown>
            ) : (
              <Text className="text-secondary/30 text-[15px] italic">
                {t.notebookDocContentPlaceholder}
              </Text>
            )
          ) : (
            <TextInput
              multiline
              className="text-foreground text-[15px] leading-6"
              placeholder={t.notebookDocContentPlaceholder}
              placeholderTextColor={semanticColors.secondaryText}
              style={{ minHeight: 400, textAlignVertical: 'top' }}
              value={content}
              onChangeText={setContent}
            />
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────

export default function NotebookScreen({ route, navigation }: any) {
  const sessionId = route.params?.sessionId;
  const initialTopicId = route.params?.topicId;
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const toast = useToast();

  const [topicId, setTopicId] = useState<string | null>(initialTopicId || null);
  const [documents, setDocuments] = useState<NotebookDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingDoc, setEditingDoc] = useState<NotebookDocument | null>(null);

  const isStandalone = !sessionId;

  // For standalone mode, use a personal notebook topic
  useEffect(() => {
    if (!isStandalone || topicId) return;

    (async () => {
      try {
        const stored = await AsyncStorage.getItem(PERSONAL_TOPIC_KEY);
        if (stored) {
          setTopicId(stored);
          return;
        }
      } catch { /* ignore */ }
    })();
  }, [isStandalone, topicId]);

  const ensureTopic = useCallback(async () => {
    if (topicId) return topicId;

    if (isStandalone) {
      // Need a session to create a topic — get or create a "Notebook" session
      const { sessionApi } = await import('../lib/api');
      const sid = await sessionApi.create({ title: 'Notebook' });
      const newTopicId = await topicApi.create(sid, 'Personal Notes');
      await AsyncStorage.setItem(PERSONAL_TOPIC_KEY, newTopicId);
      setTopicId(newTopicId);
      return newTopicId;
    }

    const newTopicId = await topicApi.create(sessionId, 'Notebook');
    setTopicId(newTopicId);
    return newTopicId;
  }, [sessionId, topicId, isStandalone]);

  const fetchDocuments = useCallback(async () => {
    if (!topicId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await notebookApi.list(topicId);
      setDocuments(result?.data || []);
    } catch {
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [topicId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleCreate = async () => {
    setCreating(true);
    haptics.light();
    try {
      const tid = await ensureTopic();
      if (!tid) return;
      const doc = await notebookApi.create({
        content: '',
        description: '',
        title: '',
        topicId: tid,
      });
      if (doc) {
        setEditingDoc(doc);
      }
      await fetchDocuments();
    } catch {
      toast.show('error', t.errorUnknown);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = useCallback(
    (doc: NotebookDocument) => {
      haptics.warning();
      Alert.alert(t.notebookDeleteConfirm, t.notebookDeleteDesc, [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.delete,
          style: 'destructive',
          onPress: async () => {
            try {
              await notebookApi.remove(doc.id);
              haptics.success();
              setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
            } catch { /* ignore */ }
          },
        },
      ]);
    },
    [t],
  );

  const handleOpenDoc = useCallback((doc: NotebookDocument) => {
    haptics.light();
    setEditingDoc(doc);
  }, []);

  // ── Editor ──────────────────────────────────────────────────────
  if (editingDoc) {
    return (
      <DocEditor
        doc={editingDoc}
        onBack={() => setEditingDoc(null)}
        onSaved={() => fetchDocuments()}
      />
    );
  }

  // ── Document List ───────────────────────────────────────────────

  const formatDate = (d?: string) => {
    if (!d) return '';
    try {
      return new Date(d).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  };

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View
        className="flex-row items-center justify-between px-4"
        style={{ paddingTop: insets.top + 6, paddingBottom: 10 }}
      >
        <TouchableOpacity
          className="flex-row items-center"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft color={semanticColors.foreground} size={22} strokeWidth={tokens.icon.strokeWidth} />
          <Text className="text-[17px] font-semibold text-foreground ml-3">
            {t.notebookTitle}
          </Text>
        </TouchableOpacity>

        <PressableScale disabled={creating} onPress={handleCreate}>
          <View className="flex-row items-center rounded-full px-3.5 py-1.5 bg-primary/10">
            <Plus color={semanticColors.primary} size={16} strokeWidth={2.5} />
            <Text className="text-[13px] font-semibold ml-1" style={{ color: semanticColors.primary }}>
              {t.notebookNewDoc}
            </Text>
          </View>
        </PressableScale>
      </View>

      {/* Content */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={semanticColors.primary} size="large" />
        </View>
      ) : documents.length === 0 ? (
        <Animated.View
          className="flex-1 items-center justify-center px-8"
          entering={FadeInDown.duration(350)}
        >
          <View
            className="items-center justify-center rounded-3xl bg-foreground/5 mb-5"
            style={{ width: 80, height: 80 }}
          >
            <NotebookPen color={semanticColors.secondaryText} size={36} strokeWidth={1.5} />
          </View>
          <Text className="text-foreground text-[17px] font-semibold text-center">
            {t.notebookEmpty}
          </Text>
          <Text className="text-secondary/40 text-[14px] text-center mt-2 mb-6">
            {t.notebookDesc}
          </Text>
          <PressableScale
            className="flex-row items-center gap-2 px-6 py-3.5 rounded-2xl"
            style={{ backgroundColor: semanticColors.primary }}
            onPress={handleCreate}
          >
            <Plus color="#fff" size={18} strokeWidth={2.5} />
            <Text className="text-white text-[15px] font-semibold">{t.notebookNewDoc}</Text>
          </PressableScale>
        </Animated.View>
      ) : (
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingBottom: 40 + insets.bottom,
            paddingTop: 12,
          }}
        >
          {documents.map((doc, index) => (
            <Animated.View entering={FadeInDown.delay(index * 40).duration(300)} key={doc.id}>
              <SwipeableRow onDelete={() => handleDelete(doc)}>
                <TouchableOpacity
                  activeOpacity={0.6}
                  className="flex-row items-center px-5 py-4 bg-background"
                  onPress={() => handleOpenDoc(doc)}
                >
                  <View
                    className="items-center justify-center rounded-xl bg-foreground/5 mr-3"
                    style={{ width: 44, height: 44 }}
                  >
                    <FileText color={semanticColors.primary} size={20} strokeWidth={1.5} />
                  </View>

                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text className="text-foreground text-[15px] font-semibold" numberOfLines={1}>
                      {doc.title || 'Untitled'}
                    </Text>
                    {doc.content ? (
                      <Text className="text-secondary/40 text-[13px] mt-0.5" numberOfLines={1}>
                        {doc.content.slice(0, 80).replace(/\n/g, ' ')}
                      </Text>
                    ) : null}
                    <Text className="text-secondary/30 text-[11px] mt-1">
                      {formatDate(doc.updatedAt || doc.createdAt)}
                      {doc.totalCharCount ? `  ·  ${doc.totalCharCount} chars` : ''}
                    </Text>
                  </View>
                </TouchableOpacity>
              </SwipeableRow>
              {index < documents.length - 1 && (
                <View className="mx-5 h-px bg-foreground/5" />
              )}
            </Animated.View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
