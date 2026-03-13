/**
 * NotebookScreen — View and manage documents associated with a topic.
 */
import { ArrowLeft, FileText, NotebookPen, Plus, Trash2 } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { notebookApi, type NotebookDocument, topicApi } from '../lib/api';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import { tokens } from '../theme/tokens';

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

  // Document editor state
  const [editingDoc, setEditingDoc] = useState<NotebookDocument | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');

  const ensureTopic = useCallback(async () => {
    if (topicId) return topicId;
    try {
      const newTopicId = await topicApi.create(sessionId, 'Notebook');
      setTopicId(newTopicId);
      return newTopicId;
    } catch {
      return null;
    }
  }, [sessionId, topicId]);

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
        title: 'Untitled',
        topicId: tid,
      });
      if (doc) {
        setEditingDoc(doc);
        setEditTitle(doc.title || '');
        setEditContent(doc.content || '');
      }
      await fetchDocuments();
    } catch {
      /* ignore */
    } finally {
      setCreating(false);
    }
  };

  const handleSave = async () => {
    if (!editingDoc) return;
    try {
      await notebookApi.update({
        id: editingDoc.id,
        title: editTitle,
        content: editContent,
      });
      toast.show('success', t.notebookSaved);
      setEditingDoc(null);
      fetchDocuments();
    } catch {
      /* ignore */
    }
  };

  const handleDelete = (doc: NotebookDocument) => {
    Alert.alert(t.notebookDeleteConfirm, t.notebookDeleteDesc, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete,
        style: 'destructive',
        onPress: async () => {
          haptics.light();
          try {
            await notebookApi.remove(doc.id);
            fetchDocuments();
          } catch {
            /* ignore */
          }
        },
      },
    ]);
  };

  const handleOpenDoc = (doc: NotebookDocument) => {
    haptics.light();
    setEditingDoc(doc);
    setEditTitle(doc.title || '');
    setEditContent(doc.content || '');
  };

  // Document editor view
  if (editingDoc) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader
          title={editTitle || t.notebookDocTitle}
          leftElement={<ArrowLeft color="#111" size={22} strokeWidth={tokens.icon.strokeWidth} />}
          rightElement={<Text className="text-primary font-medium text-[15px]">{t.save}</Text>}
          onPressLeft={() => setEditingDoc(null)}
          onPressRight={handleSave}
        />
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="mx-5 mt-4">
            <TextInput
              className="text-foreground text-[18px] font-semibold mb-4"
              placeholder={t.notebookDocTitlePlaceholder}
              placeholderTextColor="#8c8c8c"
              value={editTitle}
              onChangeText={setEditTitle}
            />
            <TextInput
              multiline
              className="text-foreground text-[14px] leading-6 min-h-[400px]"
              placeholder="Write something..."
              placeholderTextColor="#8c8c8c"
              style={{ textAlignVertical: 'top' }}
              value={editContent}
              onChangeText={setEditContent}
            />
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={t.notebookTitle}
        leftElement={<ArrowLeft color="#111" size={22} strokeWidth={tokens.icon.strokeWidth} />}
        rightElement={
          <PressableScale disabled={creating} onPress={handleCreate}>
            <Plus color="#007aff" size={22} strokeWidth={tokens.icon.strokeWidth} />
          </PressableScale>
        }
        onPressLeft={() => navigation.goBack()}
      />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#007aff" size="large" />
        </View>
      ) : documents.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <NotebookPen color="#d1d5db" size={48} strokeWidth={1.2} />
          <Text className="text-secondary/50 text-[15px] font-medium mt-4">{t.notebookEmpty}</Text>
          <PressableScale
            className="mt-6 flex-row items-center gap-2 px-6 py-3 bg-primary rounded-xl"
            onPress={handleCreate}
          >
            <Plus color="#fff" size={18} strokeWidth={tokens.icon.strokeWidth} />
            <Text className="text-white text-[15px] font-semibold">{t.notebookNewDoc}</Text>
          </PressableScale>
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
          {documents.map((doc, index) => (
            <Animated.View entering={FadeInDown.delay(index * 50).duration(300)} key={doc.id}>
              <PressableScale
                className="bg-foreground/[0.03] rounded-2xl p-4 mb-3"
                onPress={() => handleOpenDoc(doc)}
              >
                <View className="flex-row items-start justify-between">
                  <View className="flex-row items-center flex-1 mr-3">
                    <FileText
                      color="#007aff"
                      size={16}
                      strokeWidth={tokens.icon.strokeWidth}
                      style={{ marginRight: 10, marginTop: 2 }}
                    />
                    <View className="flex-1">
                      <Text className="text-foreground text-[15px] font-semibold" numberOfLines={1}>
                        {doc.title || 'Untitled'}
                      </Text>
                      {doc.description ? (
                        <Text className="text-secondary/60 text-[13px] mt-1" numberOfLines={2}>
                          {doc.description}
                        </Text>
                      ) : null}
                      <Text className="text-secondary/40 text-[11px] mt-1.5">
                        {doc.totalCharCount ?? 0} chars
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    hitSlop={12}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleDelete(doc);
                    }}
                  >
                    <Trash2 color="#ff3b30" size={16} strokeWidth={tokens.icon.strokeWidth} />
                  </TouchableOpacity>
                </View>
              </PressableScale>
            </Animated.View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
