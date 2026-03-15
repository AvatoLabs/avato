/**
 * MessageBubble — Renders a single chat message with actions.
 * Includes collapsible Thinking section, model info, token stats, save-to-topic.
 */
import * as Clipboard from 'expo-clipboard';
import {
  Bookmark,
  ChevronDown,
  ChevronRight,
  Copy,
  Pencil,
  RefreshCw,
  Trash2,
  User,
} from 'lucide-react-native';
import React, { memo, useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image as RNImage,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { getProviderIconUrl } from '../../constants/cdn';
import { haptics } from '../../lib/haptics';
import { useI18n } from '../../lib/i18n';
import { useChatStore } from '../../store/chat';
import { tokens } from '../../theme/tokens';
import type { ChatMessage } from '../../types';
import { useToast } from './Toast';
import TypingIndicator from './TypingIndicator';

interface MessageBubbleProps {
  generating?: boolean;
  message: ChatMessage;
  onSaveToTopic?: () => void;
  sessionId: string;
}

const MessageBubble = memo<MessageBubbleProps>(
  ({ message, sessionId, generating, onSaveToTopic }) => {
    const isUser = message.role === 'user';
    const { t } = useI18n();
    const toast = useToast();

    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(message.content);
    const [showActions, setShowActions] = useState(false);
    const [showStats, setShowStats] = useState(false);

    const deleteMessage = useChatStore((s) => s.deleteMessage);
    const editMessage = useChatStore((s) => s.editMessage);
    const regenerateMessage = useChatStore((s) => s.regenerateMessage);
    const isReasoning = useChatStore((s) => s.isReasoning);

    const handleCopy = useCallback(async () => {
      await Clipboard.setStringAsync(message.content);
      haptics.success();
      toast.show('success', t.toastCopied);
    }, [message.content, t, toast]);

    const handleEdit = useCallback(() => {
      haptics.light();
      setIsEditing(true);
      setEditText(message.content);
    }, [message.content]);

    const handleEditSubmit = useCallback(() => {
      if (editText.trim() && editText !== message.content) {
        editMessage(sessionId, message.id, editText.trim());
        haptics.success();
      }
      setIsEditing(false);
    }, [editText, message.content, message.id, sessionId, editMessage]);

    const handleRegenerate = useCallback(() => {
      haptics.light();
      regenerateMessage(sessionId, message.id);
    }, [sessionId, message.id, regenerateMessage]);

    const handleDelete = useCallback(() => {
      haptics.light();
      Alert.alert(t.deleteMessageConfirm, t.deleteMessageDesc, [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.delete,
          style: 'destructive',
          onPress: () => {
            haptics.warning();
            deleteMessage(sessionId, message.id);
            toast.show('info', t.toastMessageDeleted);
          },
        },
      ]);
    }, [sessionId, message.id, deleteMessage, t, toast]);

    const handlePress = useCallback(() => {
      if (!generating) {
        haptics.light();
        setShowActions((prev) => !prev);
      }
    }, [generating]);

    const handleSaveToTopic = useCallback(() => {
      haptics.light();
      onSaveToTopic?.();
    }, [onSaveToTopic]);

    const mc = tokens.markdownColors;

    const reasoningMarkdownStyles = {
      body: {
        color: mc.text + '99',
        fontSize: 13,
        lineHeight: 20,
      },
      code_inline: {
        backgroundColor: mc.codeInlineBg,
        borderRadius: 4,
        color: mc.codeInlineColor + '99',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        fontSize: 12,
        paddingHorizontal: 4,
      },
      paragraph: { marginBottom: 2, marginTop: 2 },
      link: { color: mc.link + '99' },
    };

    const tableStyles = {
      tableWrapper: { marginVertical: 8 },
      table: {
        borderColor: 'rgba(0,0,0,0.08)',
        borderRadius: 8,
        borderWidth: 1,
        overflow: 'hidden' as const,
      },
      thead: { backgroundColor: 'rgba(0,0,0,0.04)' },
      th: {
        borderColor: 'rgba(0,0,0,0.08)',
        borderWidth: 0.5,
        color: mc.heading,
        flex: 1,
        fontSize: 13,
        fontWeight: '600' as const,
        padding: 8,
      },
      tr: { borderColor: 'rgba(0,0,0,0.06)', borderBottomWidth: 0.5 },
      td: {
        borderColor: 'rgba(0,0,0,0.06)',
        borderWidth: 0.5,
        color: mc.text,
        flex: 1,
        fontSize: 13,
        lineHeight: 18,
        padding: 8,
      },
    };

    const markdownStyles = {
      body: { color: mc.text, fontSize: 15, lineHeight: 22 },
      code_inline: {
        backgroundColor: mc.codeInlineBg,
        borderRadius: 6,
        color: mc.codeInlineColor,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        fontSize: 13,
        paddingHorizontal: 5,
      },
      fence: {
        backgroundColor: mc.codeBlockBg,
        borderColor: mc.codeBlockBorder,
        borderRadius: tokens.radius.md,
        borderWidth: 0.5,
        padding: 12,
      },
      code_block: {
        backgroundColor: mc.codeBlockBg,
        borderRadius: tokens.radius.md,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        fontSize: 13,
        padding: 12,
      },
      paragraph: { marginBottom: 4, marginTop: 4 },
      link: { color: mc.link },
      heading1: {
        color: mc.heading,
        fontSize: 18,
        fontWeight: '700' as const,
        marginBottom: 8,
        marginTop: 12,
      },
      heading2: {
        color: mc.heading,
        fontSize: 16,
        fontWeight: '600' as const,
        marginBottom: 6,
        marginTop: 10,
      },
      heading3: {
        color: mc.heading,
        fontSize: 15,
        fontWeight: '600' as const,
        marginBottom: 6,
        marginTop: 8,
      },
      list_item: { marginBottom: 4 },
      hr: { backgroundColor: 'rgba(0,0,0,0.08)', height: 1, marginVertical: 12 },
      ...tableStyles,
    };

    const userMarkdownStyles = {
      ...markdownStyles,
      body: { ...markdownStyles.body, color: '#ffffff' },
      code_inline: {
        ...markdownStyles.code_inline,
        backgroundColor: 'rgba(255,255,255,0.2)',
        color: '#ffffff',
      },
      fence: {
        ...markdownStyles.fence,
        backgroundColor: 'rgba(255,255,255,0.12)',
        borderColor: 'rgba(255,255,255,0.1)',
      },
      code_block: {
        ...markdownStyles.code_block,
        backgroundColor: 'rgba(255,255,255,0.12)',
        color: '#ffffff',
      },
      link: { color: '#b3d9ff' },
      heading1: { ...markdownStyles.heading1, color: '#fff' },
      heading2: { ...markdownStyles.heading2, color: '#fff' },
      heading3: { ...markdownStyles.heading3, color: '#fff' },
      hr: { ...markdownStyles.hr, backgroundColor: 'rgba(255,255,255,0.15)' },
      table: { ...tableStyles.table, borderColor: 'rgba(255,255,255,0.2)' },
      thead: { backgroundColor: 'rgba(255,255,255,0.1)' },
      th: { ...tableStyles.th, borderColor: 'rgba(255,255,255,0.15)', color: '#fff' },
      tr: { ...tableStyles.tr, borderColor: 'rgba(255,255,255,0.12)' },
      td: { ...tableStyles.td, borderColor: 'rgba(255,255,255,0.1)', color: '#fff' },
    };

    const markdownRules = {
      table: (node: any, children: any, _parent: any, styles: any) => (
        <ScrollView
          horizontal
          key={node.key}
          showsHorizontalScrollIndicator={false}
          style={styles.tableWrapper}
        >
          <View style={styles.table}>{children}</View>
        </ScrollView>
      ),
    };

    const totalTokens = message.usage?.totalTokens ?? 0;
    const hasStats = !isUser && totalTokens > 0;

    return (
      <Animated.View
        entering={
          isUser ? FadeInUp.duration(250).springify() : FadeInDown.duration(250).springify()
        }
      >
        <TouchableOpacity
          activeOpacity={0.95}
          className={`flex-row w-full mb-5 px-4 ${isUser ? 'justify-end' : 'justify-start'}`}
          onPress={handlePress}
        >
          {/* Avatar: model icon for assistant, user icon for user */}
          {!isUser && (
            <View className="w-9 h-9 mt-0.5 rounded-full bg-foreground/5 items-center justify-center mr-3 overflow-hidden">
              {message.provider ? (
                <RNImage
                  className="w-5 h-5"
                  defaultSource={require('../../../assets/avato-icon.png')}
                  resizeMode="contain"
                  source={{ uri: getProviderIconUrl(message.provider) }}
                />
              ) : (
                <RNImage
                  className="w-7 h-7 rounded-lg"
                  source={require('../../../assets/avato-icon.png')}
                />
              )}
            </View>
          )}

          <View className="max-w-[78%]">
            {/* Model name label */}
            {!isUser && message.model && (
              <Text className="text-[11px] text-foreground/40 mb-1 ml-1" numberOfLines={1}>
                {message.model}
              </Text>
            )}

            <View
              className={`px-4 py-3 ${
                isUser
                  ? 'bg-primary rounded-3xl rounded-tr-[6px]'
                  : 'bg-foreground/5 rounded-3xl rounded-tl-[6px]'
              }`}
            >
              {isEditing ? (
                <View>
                  <TextInput
                    autoFocus
                    multiline
                    className="text-[15.5px] leading-6 min-h-[40px]"
                    style={{ color: isUser ? '#ffffff' : mc.text }}
                    value={editText}
                    onBlur={handleEditSubmit}
                    onChangeText={setEditText}
                    onSubmitEditing={handleEditSubmit}
                  />
                  <View className="flex-row justify-end mt-2 gap-2">
                    <TouchableOpacity
                      className="px-3 py-1.5 rounded-lg"
                      style={{
                        backgroundColor: isUser ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.05)',
                      }}
                      onPress={() => setIsEditing(false)}
                    >
                      <Text
                        style={{
                          color: isUser ? '#ffffff' : mc.text,
                          fontSize: 12,
                          fontWeight: '500',
                        }}
                      >
                        {t.editCancel}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className="px-3 py-1.5 rounded-lg bg-primary"
                      style={isUser ? { backgroundColor: '#ffffff' } : undefined}
                      onPress={handleEditSubmit}
                    >
                      <Text
                        style={{
                          color: isUser ? '#000' : '#ffffff',
                          fontSize: 12,
                          fontWeight: '500',
                        }}
                      >
                        {t.editSave}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <>
                  {!isUser && (message.reasoning?.content || (generating && isReasoning)) && (
                    <ThinkingBlock
                      content={message.reasoning?.content}
                      duration={message.reasoning?.duration}
                      markdownStyles={reasoningMarkdownStyles}
                      thinking={generating && isReasoning && message.id.startsWith('assistant-')}
                    />
                  )}
                  {!message.content && generating ? (
                    isReasoning ? null : (
                      <TypingIndicator color="#636366" />
                    )
                  ) : message.content ? (
                    <Markdown
                      rules={markdownRules}
                      style={isUser ? userMarkdownStyles : markdownStyles}
                    >
                      {message.content}
                    </Markdown>
                  ) : null}
                </>
              )}
            </View>

            {/* Token stats badge (clickable) */}
            {hasStats && !generating && (
              <TouchableOpacity
                className="flex-row items-center mt-1 ml-1"
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                onPress={() => {
                  haptics.light();
                  setShowStats(true);
                }}
              >
                <Text className="text-[11px] text-foreground/35">
                  {totalTokens.toLocaleString()} {t.msgStatTokens}
                </Text>
              </TouchableOpacity>
            )}

            {/* Action Bar */}
            {!generating && !isEditing && (showActions || !isUser) && (
              <Animated.View
                className={`flex-row items-center mt-1.5 px-1 gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                entering={FadeInUp.duration(200)}
              >
                {!isUser && (
                  <TouchableOpacity
                    accessibilityLabel={t.msgActionRegenerate}
                    activeOpacity={0.6}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    onPress={handleRegenerate}
                  >
                    <RefreshCw color={mc.text + '66'} size={14} strokeWidth={2} />
                  </TouchableOpacity>
                )}
                {isUser && (
                  <TouchableOpacity
                    accessibilityLabel={t.msgActionEdit}
                    activeOpacity={0.6}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    onPress={handleEdit}
                  >
                    <Pencil color={mc.text + '66'} size={14} strokeWidth={2} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  accessibilityLabel={t.msgActionCopy}
                  activeOpacity={0.6}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={handleCopy}
                >
                  <Copy color={mc.text + '66'} size={14} strokeWidth={2} />
                </TouchableOpacity>
                {!isUser && onSaveToTopic && (
                  <TouchableOpacity
                    accessibilityLabel={t.msgActionSaveToTopic}
                    activeOpacity={0.6}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    onPress={handleSaveToTopic}
                  >
                    <Bookmark color={mc.text + '66'} size={14} strokeWidth={2} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  accessibilityLabel={t.msgActionDelete}
                  activeOpacity={0.6}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={handleDelete}
                >
                  <Trash2 color={mc.text + '66'} size={14} strokeWidth={2} />
                </TouchableOpacity>
              </Animated.View>
            )}
          </View>

          {isUser && (
            <View className="w-9 h-9 mt-0.5 rounded-full bg-foreground/5 items-center justify-center ml-3">
              <User color="#555" size={18} strokeWidth={tokens.icon.strokeWidth} />
            </View>
          )}
        </TouchableOpacity>

        {/* Token Stats Modal */}
        {showStats && message.usage && (
          <UsageStatsModal
            model={message.model}
            performance={message.performance}
            usage={message.usage}
            onClose={() => setShowStats(false)}
          />
        )}
      </Animated.View>
    );
  },
);

MessageBubble.displayName = 'MessageBubble';

// ── UsageStatsModal ──

interface UsageStatsModalProps {
  model?: string;
  onClose: () => void;
  performance?: ChatMessage['performance'];
  usage: NonNullable<ChatMessage['usage']>;
}

const UsageStatsModal = memo<UsageStatsModalProps>(({ usage, performance, model, onClose }) => {
  const { t } = useI18n();

  const uncached =
    usage.inputCacheMissTokens ?? (usage.totalInputTokens ?? 0) - (usage.inputCachedTokens ?? 0);
  const cached = usage.inputCachedTokens ?? 0;
  const output = usage.totalOutputTokens ?? 0;
  const total = usage.totalTokens ?? 0;
  const tps = performance?.tps;
  const ttft = performance?.ttft;

  const rows: [string, string, string?][] = [
    [t.msgStatUncachedInput, uncached.toLocaleString(), '#8E8E93'],
    [t.msgStatCachedInput, cached.toLocaleString(), '#FF9500'],
    [t.msgStatOutput, output.toLocaleString(), '#34C759'],
  ];

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity
        activeOpacity={1}
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
        onPress={onClose}
      >
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View className="bg-[#1c1c1e] rounded-2xl p-5 mx-8" style={{ minWidth: 280 }}>
            {/* Progress bar */}
            <View
              className="h-2 rounded-full overflow-hidden flex-row mb-4"
              style={{ backgroundColor: '#333' }}
            >
              {total > 0 && (
                <>
                  <View
                    style={{ flex: uncached / total, backgroundColor: '#8E8E93', borderRadius: 4 }}
                  />
                  <View
                    style={{ flex: cached / total, backgroundColor: '#FF9500', borderRadius: 4 }}
                  />
                  <View
                    style={{ flex: output / total, backgroundColor: '#34C759', borderRadius: 4 }}
                  />
                </>
              )}
            </View>

            {rows.map(([label, value, dotColor]) => (
              <View className="flex-row items-center justify-between py-1.5" key={label}>
                <View className="flex-row items-center">
                  <View
                    className="w-2 h-2 rounded-full mr-2"
                    style={{ backgroundColor: dotColor }}
                  />
                  <Text className="text-white/70 text-[14px]">{label}</Text>
                </View>
                <Text className="text-white text-[14px] font-semibold">{value}</Text>
              </View>
            ))}

            <View className="h-px bg-white/10 my-2" />

            <View className="flex-row items-center justify-between py-1.5">
              <Text className="text-white/70 text-[14px]">{t.msgStatTotal}</Text>
              <Text className="text-white text-[14px] font-semibold">{total.toLocaleString()}</Text>
            </View>

            {tps !== undefined && tps > 0 && (
              <View className="flex-row items-center justify-between py-1.5">
                <Text className="text-white/70 text-[14px]">{t.msgStatTPS}</Text>
                <Text className="text-white text-[14px] font-semibold">{tps.toFixed(2)}</Text>
              </View>
            )}

            {ttft !== undefined && ttft > 0 && (
              <View className="flex-row items-center justify-between py-1.5">
                <Text className="text-white/70 text-[14px]">{t.msgStatTTFT}</Text>
                <Text className="text-white text-[14px] font-semibold">
                  {(ttft / 1000).toFixed(2)}s
                </Text>
              </View>
            )}

            {model && (
              <>
                <View className="h-px bg-white/10 my-2" />
                <Text className="text-white/40 text-[12px] text-center">{model}</Text>
              </>
            )}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
});

UsageStatsModal.displayName = 'UsageStatsModal';

// ── ThinkingBlock (collapsible reasoning, mirrors web Thinking component) ──

interface ThinkingBlockProps {
  content?: string;
  duration?: number;
  markdownStyles: Record<string, any>;
  thinking?: boolean;
}

const ThinkingBlock = memo<ThinkingBlockProps>(
  ({ content, duration, thinking, markdownStyles }) => {
    const { t } = useI18n();
    const [expanded, setExpanded] = useState(false);

    const durationLabel = duration
      ? `${t.chatThoughtWithDuration} ${(duration / 1000).toFixed(1)}s`
      : t.chatThought;

    const showContent = expanded && !thinking && !!content;

    return (
      <View className="mb-2">
        <TouchableOpacity
          activeOpacity={0.7}
          className="flex-row items-center py-1"
          onPress={() => !thinking && setExpanded((v) => !v)}
        >
          {thinking ? (
            <ActivityIndicator color="#007aff" size={12} style={{ marginRight: 4 }} />
          ) : expanded ? (
            <ChevronDown color="#999" size={14} strokeWidth={2.5} />
          ) : (
            <ChevronRight color="#999" size={14} strokeWidth={2.5} />
          )}
          {thinking ? (
            <Text className="text-primary text-[12px] font-medium ml-1">{t.chatThinking}</Text>
          ) : (
            <Text className="text-secondary/50 text-[12px] font-medium ml-1">{durationLabel}</Text>
          )}
        </TouchableOpacity>

        {showContent ? (
          <View className="ml-4 mt-1">
            <ScrollView
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 240 }}
            >
              <Markdown style={markdownStyles}>{content}</Markdown>
            </ScrollView>
          </View>
        ) : null}
      </View>
    );
  },
);

ThinkingBlock.displayName = 'ThinkingBlock';

export default MessageBubble;
