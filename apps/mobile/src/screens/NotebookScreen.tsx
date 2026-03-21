/**
 * NotebookScreen — Personal documents and notes with Markdown support.
 *
 * Accessible from:
 *   1. ProfileScreen (standalone — uses a personal notes topic)
 *   2. ChatDetailScreen (per-topic — uses the chat's active topic)
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ArrowLeft, Edit3, Eye, FileText, NotebookPen, Plus } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { useToast } from '../components/ui/Toast';
import { notebookApi, type NotebookDocument, topicApi } from '../lib/api';
import { classifyError } from '../lib/errorHandler';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import { codeInlineRules } from '../lib/markdownRules';
import { useThemeColors } from '../theme/colors';
import { tokens } from '../theme/tokens';

const PERSONAL_TOPIC_KEY = 'avato_personal_notebook_topic_id';
const NOTEBOOK_SESSION_TITLE = 'Notebook';
const NOTEBOOK_PERSONAL_TOPIC_TITLE = 'Personal Notes';
const NOTEBOOK_TOPIC_TITLE = 'Notebook';

const isStaleNotebookTopicError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? '');

  return (
    (message.includes('Failed query') && message.includes('topic_id')) ||
    /topic_documents.*topics_id_fk/i.test(message)
  );
};

function getMdStyles(colors: {
  foreground: string;
  primary: string;
  markdownCodeInlineBg: string;
  markdownCodeInlineColor: string;
  markdownCodeBlockBg: string;
  markdownText: string;
  fillTertiary: string;
  divider: string;
}) {
  return {
    body: { color: colors.foreground, fontSize: 15, lineHeight: 24 },
    text: { color: colors.foreground },
    textgroup: { color: colors.foreground },
    heading1: {
      color: colors.foreground,
      fontSize: 24,
      fontWeight: '700' as const,
      marginBottom: 12,
      marginTop: 20,
    },
    heading2: {
      color: colors.foreground,
      fontSize: 20,
      fontWeight: '700' as const,
      marginBottom: 10,
      marginTop: 18,
    },
    heading3: {
      color: colors.foreground,
      fontSize: 17,
      fontWeight: '600' as const,
      marginBottom: 8,
      marginTop: 14,
    },
    paragraph: { marginBottom: 12 },
    bullet_list: { marginBottom: 12 },
    ordered_list: { marginBottom: 12 },
    list_item: { marginBottom: 4 },
    code_inline: {
      backgroundColor: colors.markdownCodeInlineBg,
      borderRadius: 4,
      color: colors.markdownCodeInlineColor,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 13,
      paddingHorizontal: 5,
      paddingVertical: 2,
    },
    fence: {
      backgroundColor: colors.markdownCodeBlockBg,
      borderRadius: 12,
      color: colors.markdownText,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 13,
      lineHeight: 20,
      marginBottom: 12,
      padding: 14,
    },
    blockquote: {
      backgroundColor: colors.fillTertiary,
      borderColor: colors.primary,
      borderLeftWidth: 3,
      marginBottom: 12,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    hr: { backgroundColor: colors.divider, height: 1, marginVertical: 16 },
    link: { color: colors.primary },
    strong: { fontWeight: '600' as const },
    table: { borderColor: colors.divider, borderWidth: 0.5 },
    th: { backgroundColor: colors.fillTertiary, padding: 8 },
    td: { borderColor: colors.divider, borderWidth: 0.5, padding: 8 },
  };
}

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
  const colors = useThemeColors();

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
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-background"
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 56 : 0}
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
          <ArrowLeft color={colors.foreground} size={22} strokeWidth={tokens.icon.strokeWidth} />
        </TouchableOpacity>

        <View className="flex-row items-center gap-3">
          {/* Preview / Edit toggle */}
          <TouchableOpacity
            className="flex-row items-center rounded-full px-3 py-1.5"
            style={{ backgroundColor: previewing ? `${colors.primary}10` : colors.fillTertiary }}
            onPress={() => setPreviewing(!previewing)}
          >
            {previewing ? (
              <>
                <Edit3 color={colors.primary} size={14} strokeWidth={2} />
                <Text
                  className="text-[12px] font-semibold ml-1.5"
                  style={{ color: colors.primary }}
                >
                  {t.notebookEdit}
                </Text>
              </>
            ) : (
              <>
                <Eye color={colors.muted} size={14} strokeWidth={2} />
                <Text
                  className="ml-1.5 text-[12px] font-semibold"
                  style={{ color: colors.secondaryText }}
                >
                  {t.notebookPreview}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Save */}
          <TouchableOpacity disabled={saving || !hasChanges} onPress={handleSave}>
            <Text
              className="text-[15px] font-semibold"
              style={{ color: hasChanges ? colors.primary : colors.secondaryText }}
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
            <Text
              className="text-[22px] font-bold tracking-tight"
              style={{ color: colors.foreground }}
            >
              {title || t.notebookDocTitle}
            </Text>
          ) : (
            <TextInput
              className="text-[22px] font-bold tracking-tight"
              placeholder={t.notebookDocTitlePlaceholder}
              placeholderTextColor={colors.secondaryText}
              style={{ color: colors.foreground }}
              value={title}
              onChangeText={setTitle}
            />
          )}
        </View>

        {/* Body */}
        <View className="px-5 pt-2">
          {previewing ? (
            content.trim() ? (
              <Markdown rules={codeInlineRules} style={getMdStyles(colors)}>
                {content}
              </Markdown>
            ) : (
              <Text className="text-[15px] italic" style={{ color: colors.tertiaryText }}>
                {t.notebookDocContentPlaceholder}
              </Text>
            )
          ) : (
            <TextInput
              multiline
              className="text-[15px] leading-6"
              placeholder={t.notebookDocContentPlaceholder}
              placeholderTextColor={colors.secondaryText}
              style={{ color: colors.foreground, minHeight: 400, textAlignVertical: 'top' }}
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
  const colors = useThemeColors();

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
      } catch {
        /* ignore */
      }
    })();
  }, [isStandalone, topicId]);

  const createTopic = useCallback(async () => {
    if (isStandalone) {
      // Need a session to create a topic — get or create a "Notebook" session
      const { sessionApi } = await import('../lib/api');
      const sid = await sessionApi.create({ title: NOTEBOOK_SESSION_TITLE });
      const newTopicId = await topicApi.create(sid, NOTEBOOK_PERSONAL_TOPIC_TITLE);

      await AsyncStorage.setItem(PERSONAL_TOPIC_KEY, newTopicId);
      setTopicId(newTopicId);

      return newTopicId;
    }

    if (!sessionId) {
      throw new Error('Missing sessionId for notebook topic creation');
    }

    const newTopicId = await topicApi.create(sessionId, NOTEBOOK_TOPIC_TITLE);
    setTopicId(newTopicId);

    return newTopicId;
  }, [isStandalone, sessionId]);

  const ensureTopic = useCallback(
    async (options?: { forceNew?: boolean }) => {
      if (!options?.forceNew && topicId) return topicId;

      return createTopic();
    },
    [createTopic, topicId],
  );

  const fetchDocuments = useCallback(
    async (targetTopicId = topicId) => {
      if (!targetTopicId) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const result = await notebookApi.list(targetTopicId);
        setDocuments(result?.data || []);
      } catch {
        setDocuments([]);
      } finally {
        setLoading(false);
      }
    },
    [topicId],
  );

  useEffect(() => {
    void fetchDocuments();
  }, [fetchDocuments]);

  const handleCreate = useCallback(async () => {
    if (creating) return;

    setCreating(true);
    haptics.light();

    const createDocument = (nextTopicId: string) =>
      notebookApi.create({
        content: '',
        description: '',
        title: '',
        topicId: nextTopicId,
      });

    try {
      let nextTopicId = await ensureTopic();
      let doc: NotebookDocument;

      try {
        doc = await createDocument(nextTopicId);
      } catch (error) {
        if (!isStaleNotebookTopicError(error)) throw error;

        if (isStandalone) {
          await AsyncStorage.removeItem(PERSONAL_TOPIC_KEY);
          setTopicId(null);
        }

        nextTopicId = await ensureTopic({ forceNew: true });
        doc = await createDocument(nextTopicId);
      }

      setEditingDoc(doc);
      await fetchDocuments(nextTopicId);
    } catch (error) {
      console.error('Failed to create notebook document', error);
      const { messageKey } = classifyError(error);
      toast.show('error', t[messageKey] ?? t.errorUnknown);
    } finally {
      setCreating(false);
    }
  }, [creating, ensureTopic, fetchDocuments, isStandalone, t, toast]);

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
            } catch {
              /* ignore */
            }
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
      <View style={{ zIndex: 1 }}>
        <ScreenHeader
          title={t.notebookTitle}
          leftElement={
            <ArrowLeft color={colors.primary} size={22} strokeWidth={tokens.icon.strokeWidth} />
          }
          onPressLeft={() => navigation.goBack()}
        />
      </View>

      {/* Content */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : documents.length === 0 ? (
        <Animated.View
          className="items-center justify-center px-8"
          entering={FadeInDown.duration(350)}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}
        >
          <View
            className="mb-5 items-center justify-center rounded-3xl"
            style={{ backgroundColor: colors.fillTertiary, height: 80, width: 80 }}
          >
            <NotebookPen color={colors.secondaryText} size={36} strokeWidth={1.5} />
          </View>
          <Text
            className="text-center text-[17px] font-semibold"
            style={{ color: colors.foreground }}
          >
            {t.notebookEmpty}
          </Text>
          <Text
            className="mb-6 mt-2 text-center text-[14px]"
            style={{ color: colors.secondaryText }}
          >
            {t.notebookDesc}
          </Text>
          <PressableScale
            className="flex-row items-center gap-2 px-6 py-3.5 rounded-xl"
            disabled={creating}
            style={{ backgroundColor: colors.primary, opacity: creating ? 0.7 : 1 }}
            onPress={handleCreate}
          >
            {creating ? (
              <ActivityIndicator color={colors.iconOnPrimary} size="small" />
            ) : (
              <Plus color={colors.iconOnPrimary} size={18} strokeWidth={2.5} />
            )}
            <Text className="text-[15px] font-semibold" style={{ color: colors.iconOnPrimary }}>
              {t.notebookNewDoc}
            </Text>
          </PressableScale>
        </Animated.View>
      ) : (
        <FlatList
          className="flex-1"
          data={documents}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => (
            <View className="mx-5 h-px" style={{ backgroundColor: colors.divider }} />
          )}
          contentContainerStyle={{
            paddingBottom: 40 + insets.bottom,
            paddingTop: 12,
          }}
          renderItem={({ item: doc }) => (
            <TouchableOpacity
              activeOpacity={0.6}
              className="flex-row items-center px-5 py-4 bg-background"
              onPress={() => handleOpenDoc(doc)}
              onLongPress={() => {
                haptics.medium();
                handleDelete(doc);
              }}
            >
              <View
                className="mr-3 items-center justify-center rounded-xl"
                style={{ backgroundColor: colors.fillTertiary, height: 44, width: 44 }}
              >
                <FileText color={colors.primary} size={20} strokeWidth={1.5} />
              </View>

              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  className="text-[15px] font-semibold"
                  numberOfLines={1}
                  style={{ color: colors.foreground }}
                >
                  {doc.title || 'Untitled'}
                </Text>
                {doc.content ? (
                  <Text
                    className="mt-0.5 text-[13px]"
                    numberOfLines={1}
                    style={{ color: colors.secondaryText }}
                  >
                    {doc.content.slice(0, 80).replaceAll('\n', ' ')}
                  </Text>
                ) : null}
                <Text className="mt-1 text-[11px]" style={{ color: colors.tertiaryText }}>
                  {formatDate(doc.updatedAt || doc.createdAt)}
                  {doc.totalCharCount ? `  ·  ${doc.totalCharCount} chars` : ''}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}
