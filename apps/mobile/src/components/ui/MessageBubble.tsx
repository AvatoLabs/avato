/**
 * MessageBubble — Renders a single chat message with actions.
 * Includes collapsible Thinking section, model info, token stats, save-to-topic.
 */
import * as Clipboard from 'expo-clipboard';
import {
  Ban,
  Bookmark,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Globe,
  Hand,
  Pause,
  Pencil,
  RefreshCw,
  Trash2,
  User,
  Wrench,
  X,
} from 'lucide-react-native';
import React, { memo, useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image as RNImage,
  Linking,
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
import { semanticColors } from '../../constants/colors';
import { haptics } from '../../lib/haptics';
import { useI18n } from '../../lib/i18n';
import { useChatStore } from '../../store/chat';
import { tokens } from '../../theme/tokens';
import type {
  ChatMessage,
  ChatToolPayload,
  CitationItem,
  GroundingSearch,
  ImageCitationItem,
  MessageContentPart,
} from '../../types';
import ImageViewer from './ImageViewer';
import { useToast } from './Toast';
import TypingIndicator from './TypingIndicator';

interface MessageBubbleProps {
  generating?: boolean;
  message: ChatMessage;
  onSaveToTopic?: () => void;
  sessionId: string;
}

const chatAccent = {
  badgeBg: 'rgba(0,122,255,0.12)',
  badgeText: '#1d4ed8',
  bubbleBg: 'rgba(0,122,255,0.065)',
  bubbleBorder: 'rgba(0,122,255,0.11)',
  chipBg: 'rgba(0,122,255,0.08)',
  chipBorder: 'rgba(0,122,255,0.12)',
  elevatedBg: 'rgba(255,255,255,0.9)',
  sectionBg: 'rgba(0,122,255,0.055)',
  sectionBorder: 'rgba(0,122,255,0.11)',
  subtleBg: 'rgba(0,122,255,0.045)',
} as const;

const MessageBubble = memo<MessageBubbleProps>(
  ({ message, sessionId, generating, onSaveToTopic }) => {
    const isUser = message.role === 'user';
    const isToolMessage = message.role === 'tool';
    const { t } = useI18n();
    const toast = useToast();

    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(message.content);
    const [showActions, setShowActions] = useState(false);
    const [showImageViewer, setShowImageViewer] = useState(false);
    const [showStats, setShowStats] = useState(false);
    const [viewerUri, setViewerUri] = useState<string | null>(null);

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

    const handleOpenLink = useCallback(
      async (url?: string) => {
        if (!url) return;

        try {
          await Linking.openURL(url);
        } catch {
          toast.show('error', t.errorNetwork);
        }
      },
      [t, toast],
    );

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
    const hasStats = !isUser && !isToolMessage && totalTokens > 0;
    const hasAttachments =
      (message.imageList?.length ?? 0) > 0 || (message.fileList?.length ?? 0) > 0;
    const hasSearch =
      !isUser &&
      !!message.search &&
      !!(
        message.search.citations?.length ||
        message.search.searchQueries?.length ||
        message.search.imageResults?.length ||
        message.search.imageSearchQueries?.length
      );
    const hasTools = !isUser && (message.tools?.length ?? 0) > 0;
    const multimodalContentParts =
      !isToolMessage && message.metadata?.isMultimodal
        ? parseMessageContentParts(message.metadata?.tempDisplayContent)
        : null;
    const multimodalReasoningParts = message.reasoning?.isMultimodal
      ? parseMessageContentParts(
          message.reasoning?.tempDisplayContent || message.reasoning?.content,
        )
      : null;
    const renderedContent = injectCitationLinks(message.content, message.search?.citations);
    const renderedReasoning = injectCitationLinks(
      message.reasoning?.content,
      message.search?.citations,
    );
    const assistantContentWidth = { maxWidth: '100%' as const, width: '100%' as const };
    const userContentWidth = { maxWidth: '84%' as const };
    const showStandaloneUserAttachments = isUser && hasAttachments;
    const showMessageBubble =
      !showStandaloneUserAttachments ||
      !!renderedContent ||
      !!multimodalContentParts?.length ||
      isToolMessage;

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
          <View className={isUser ? 'items-end' : 'flex-1 min-w-0'}>
            {!isUser && (
              <View className="flex-row items-center mb-1.5">
                <View className="w-9 h-9 rounded-full bg-foreground/5 items-center justify-center mr-3 overflow-hidden">
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
                {message.model ? (
                  <Text className="text-[11px] text-foreground/40 flex-1" numberOfLines={1}>
                    {message.model}
                  </Text>
                ) : null}
              </View>
            )}

            <View style={isUser ? userContentWidth : assistantContentWidth}>
              {showStandaloneUserAttachments ? (
                <View className="mb-2">
                  <AttachmentBlock
                    fileList={message.fileList}
                    imageList={message.imageList}
                    isUser={isUser}
                    onOpenImage={(url) => {
                      setViewerUri(url);
                      setShowImageViewer(true);
                    }}
                  />
                </View>
              ) : null}
              {showMessageBubble ? (
                <View
                  className={`px-4 py-3 rounded-3xl ${
                    isUser ? 'bg-primary rounded-tr-[6px]' : 'rounded-tl-[6px] border'
                  }`}
                  style={
                    isUser
                      ? undefined
                      : {
                          backgroundColor: chatAccent.bubbleBg,
                          borderColor: chatAccent.bubbleBorder,
                        }
                  }
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
                  {!showStandaloneUserAttachments && hasAttachments ? (
                    <View className="mb-3">
                      <AttachmentBlock
                        fileList={message.fileList}
                        imageList={message.imageList}
                        isUser={isUser}
                        onOpenImage={(url) => {
                          setViewerUri(url);
                          setShowImageViewer(true);
                        }}
                      />
                    </View>
                  ) : null}

                {hasSearch && message.search && <SearchGroundingBlock search={message.search} />}

                {hasTools && message.tools && <ToolCallsBlock tools={message.tools} />}

                {!isUser &&
                  !isToolMessage &&
                  (renderedReasoning || (generating && isReasoning)) && (
                    <ThinkingBlock
                      content={renderedReasoning}
                      duration={message.reasoning?.duration}
                      isMultimodal={message.reasoning?.isMultimodal}
                      markdownStyles={reasoningMarkdownStyles}
                      tempDisplayContent={multimodalReasoningParts || undefined}
                      thinking={generating && isReasoning && message.id.startsWith('assistant-')}
                    />
                  )}
                {isToolMessage ? (
                  <ToolResultBlock message={message} />
                ) : !message.content && !multimodalContentParts && generating ? (
                  isReasoning ? null : (
                    <TypingIndicator color="#636366" />
                  )
                ) : multimodalContentParts?.length ? (
                  <RichContentPartsBlock
                    citations={message.search?.citations}
                    markdownStyles={isUser ? userMarkdownStyles : markdownStyles}
                    parts={multimodalContentParts}
                    onOpenLink={handleOpenLink}
                  />
                ) : renderedContent ? (
                  <Markdown
                    rules={markdownRules}
                    style={isUser ? userMarkdownStyles : markdownStyles}
                    onLinkPress={(url) => {
                      handleOpenLink(url);
                      return false;
                    }}
                  >
                    {renderedContent}
                  </Markdown>
                ) : null}
                  {!isUser && message.search?.citations?.length ? (
                    <CitationFootnotesBlock
                      citations={message.search.citations}
                      onOpenLink={handleOpenLink}
                    />
                  ) : null}
                </>
              )}
                </View>
              ) : null}

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
                  {!isUser && !isToolMessage && (
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
        <ImageViewer
          uri={viewerUri ?? ''}
          visible={showImageViewer}
          onClose={() => {
            setShowImageViewer(false);
            setViewerUri(null);
          }}
        />
      </Animated.View>
    );
  },
);

MessageBubble.displayName = 'MessageBubble';

const formatToolArguments = (argumentsString: string) => {
  if (!argumentsString) return '';

  try {
    return JSON.stringify(JSON.parse(argumentsString), null, 2);
  } catch {
    return argumentsString;
  }
};

const stripHtml = (html: string) =>
  html
    .replaceAll(/<[^>]*>/g, '')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&nbsp;', ' ');

const getUrlHost = (value?: string) => {
  if (!value) return undefined;

  try {
    return new URL(value).host;
  } catch {
    return undefined;
  }
};

const getCitationFavicon = (citation: CitationItem) => {
  const host = citation.favicon || getUrlHost(citation.url);
  return host ? `https://icons.duckduckgo.com/ip3/${host}.ico` : undefined;
};

const getImageResultFavicon = (item: ImageCitationItem) => {
  const host = item.domain || getUrlHost(item.sourceUri);
  return host ? `https://icons.duckduckgo.com/ip3/${host}.ico` : undefined;
};

const formatToolDisplayTitle = (tool: Pick<ChatToolPayload, 'apiName' | 'arguments' | 'identifier'>) => {
  const titleSegments = [tool.identifier, tool.apiName].filter(Boolean);
  const args = safeParseJsonRecord(tool.arguments);

  const params = Object.entries(args)
    .slice(0, 1)
    .map(([key, value]) => `${key}: ${formatToolArgumentValue(value)}`);

  return {
    params,
    title: titleSegments.join(' > '),
  };
};

const formatToolArgumentValue = (value: unknown) => {
  if (typeof value === 'string') return value.length > 40 ? `${value.slice(0, 40)}...` : value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
    const serialized = JSON.stringify(value);
    return serialized.length > 40 ? `${serialized.slice(0, 40)}...` : serialized;
  }

  return String(value);
};

const safeParseJsonRecord = (value?: string) => {
  if (!value) return {};

  try {
    const parsed = JSON.parse(value);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
};

const escapeMarkdownLinkLabel = (label: string) =>
  label.replaceAll('[', '\\[').replaceAll(']', '\\]');

const injectCitationLinks = (content: string | undefined, citations?: CitationItem[] | null) => {
  if (!content || !citations?.length) return content ?? '';

  return content.replaceAll(/\[(\d+)\]/g, (token, rawIndex) => {
    const citation = citations[Number(rawIndex) - 1];

    if (!citation?.url) return token;

    return `[${escapeMarkdownLinkLabel(token)}](${citation.url})`;
  });
};

const parseMessageContentParts = (
  raw: MessageContentPart[] | string | null | undefined,
): MessageContentPart[] | null => {
  if (!raw) return null;

  if (Array.isArray(raw)) {
    return raw.filter((part): part is MessageContentPart => !!part?.type);
  }

  if (typeof raw !== 'string') return null;

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((part): part is MessageContentPart => !!part?.type);
    }
  } catch {
    return null;
  }

  return null;
};

const RichContentPartsBlock = memo<{
  citations?: CitationItem[] | null;
  markdownStyles: Record<string, any>;
  onOpenLink: (url?: string) => void;
  parts: MessageContentPart[];
}>(({ parts, markdownStyles, onOpenLink, citations }) => (
  <View className="gap-2">
    {parts.map((part, index) => {
      if (part.type === 'image' && part.image) {
        return (
          <RNImage
            key={`${part.image}-${index}`}
            resizeMode="cover"
            source={{ uri: part.image }}
            style={{
              backgroundColor: 'rgba(0,0,0,0.04)',
              borderRadius: 16,
              height: 180,
              width: '100%',
            }}
          />
        );
      }

      if (part.type === 'text' && part.text) {
        return (
          <Markdown
            key={`${part.text.slice(0, 24)}-${index}`}
            style={markdownStyles}
            onLinkPress={(url) => {
              onOpenLink(url);
              return false;
            }}
          >
            {injectCitationLinks(part.text, citations)}
          </Markdown>
        );
      }

      return null;
    })}
  </View>
));

RichContentPartsBlock.displayName = 'RichContentPartsBlock';

const AttachmentBlock = memo<{
  fileList?: ChatMessage['fileList'];
  imageList?: ChatMessage['imageList'];
  isUser: boolean;
  onOpenImage: (url: string) => void;
}>(({ imageList, fileList, isUser, onOpenImage }) => (
  <View className="gap-2">
    {imageList?.length ? (
      <ScrollView
        horizontal
        contentContainerStyle={{ gap: 8 }}
        showsHorizontalScrollIndicator={false}
      >
        {imageList.map((image) => (
          <TouchableOpacity
            activeOpacity={0.9}
            key={image.id}
            onPress={() => onOpenImage(image.url)}
          >
            <RNImage
              source={{ uri: image.url }}
              style={{
                backgroundColor: isUser ? 'rgba(255,255,255,0.14)' : chatAccent.subtleBg,
                borderRadius: 14,
                height: 120,
                width: 120,
              }}
            />
          </TouchableOpacity>
        ))}
      </ScrollView>
    ) : null}

    {fileList?.length ? (
      <View className="gap-2">
        {fileList.map((file) => (
          <View
            className="rounded-2xl px-3 py-2"
            key={file.id}
            style={{
              backgroundColor: isUser ? 'rgba(255,255,255,0.14)' : chatAccent.subtleBg,
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                color: isUser ? '#ffffff' : tokens.markdownColors.heading,
                fontSize: 13,
                fontWeight: '600',
              }}
            >
              {file.name}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                color: isUser ? 'rgba(255,255,255,0.7)' : tokens.markdownColors.text + '88',
                fontSize: 12,
                marginTop: 2,
              }}
            >
              {file.fileType}
            </Text>
          </View>
        ))}
      </View>
    ) : null}
  </View>
));

AttachmentBlock.displayName = 'AttachmentBlock';

const CitationFootnotesBlock = memo<{
  citations: CitationItem[];
  onOpenLink: (url?: string) => void;
}>(({ citations, onOpenLink }) => {
  const { t } = useI18n();
  const visibleCitations = citations.filter((item) => !!item.url);

  if (visibleCitations.length === 0) return null;

  return (
    <View className="mt-3 gap-2">
      <Text className="text-[11px] font-semibold text-foreground/45">{t.chatSearchSources}</Text>
      {visibleCitations.map((citation, index) => {
        const favicon = getCitationFavicon(citation);
        const host = citation.favicon || getUrlHost(citation.url);

        return (
          <TouchableOpacity
            activeOpacity={0.8}
            className="flex-row items-start rounded-2xl border border-black/5 px-3 py-2"
            key={`${citation.url}-${index}`}
            style={{
              backgroundColor: chatAccent.sectionBg,
              borderColor: chatAccent.sectionBorder,
            }}
            onPress={() => onOpenLink(citation.url)}
          >
            <View
              className="items-center justify-center mr-3 mt-0.5 rounded-full"
              style={{ backgroundColor: chatAccent.badgeBg, height: 22, width: 22 }}
            >
              <Text
                className="text-[11px] font-semibold"
                style={{ color: chatAccent.badgeText }}
              >
                {index + 1}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-[12px] font-semibold text-foreground/80" numberOfLines={2}>
                {citation.title || citation.url}
              </Text>
              {!!host && (
                <View className="mt-1 flex-row items-center">
                  {favicon ? (
                    <RNImage
                      source={{ uri: favicon }}
                      style={{ borderRadius: 6, height: 12, marginRight: 6, width: 12 }}
                    />
                  ) : null}
                  <Text className="text-[11px] text-foreground/45" numberOfLines={1}>
                    {host}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

CitationFootnotesBlock.displayName = 'CitationFootnotesBlock';

const SearchGroundingBlock = memo<{ search: GroundingSearch }>(({ search }) => {
  const { t } = useI18n();
  const toast = useToast();
  const [expanded, setExpanded] = useState(true);

  const webCount = search.citations?.length ?? 0;
  const imageCount = search.imageResults?.length ?? 0;
  const title = webCount > 0 ? t.chatSearchSources : t.chatSearchImages;
  const count = webCount || imageCount;
  const previewFavicons =
    webCount > 0
      ? (search.citations || []).slice(0, 5).map(getCitationFavicon).filter(Boolean)
      : (search.imageResults || []).slice(0, 5).map(getImageResultFavicon).filter(Boolean);
  const summaryText =
    search.searchQueries?.[0] || search.imageSearchQueries?.[0] || search.citations?.[0]?.title;

  const handleOpenLink = useCallback(
    async (url?: string) => {
      if (!url) return;

      try {
        await Linking.openURL(url);
      } catch {
        toast.show('error', t.errorNetwork);
      }
    },
    [t, toast],
  );

  return (
    <View
      className="mb-2 rounded-2xl border border-black/5 px-3 py-2"
      style={{
        backgroundColor: chatAccent.sectionBg,
        borderColor: chatAccent.sectionBorder,
      }}
    >
      <TouchableOpacity
        activeOpacity={0.7}
        className="flex-row items-center justify-between"
        onPress={() => setExpanded((value) => !value)}
      >
        <View className="flex-row items-center flex-1">
          <Globe color={semanticColors.primary} size={14} strokeWidth={2} />
          <Text className="ml-2 text-[12px] font-medium text-foreground/65">
            {title} {count > 0 ? `(${count})` : ''}
          </Text>
          {previewFavicons.length ? (
            <View className="ml-2 flex-row items-center">
              {previewFavicons.map((uri, index) => (
                <RNImage
                  key={`${uri}-${index}`}
                  source={{ uri }}
                  style={{
                    backgroundColor: '#fff',
                    borderRadius: 8,
                    height: 16,
                    marginLeft: index === 0 ? 0 : -4,
                    width: 16,
                    zIndex: 20 - index,
                  }}
                />
              ))}
            </View>
          ) : null}
        </View>
        {expanded ? (
          <ChevronDown color="#999" size={14} strokeWidth={2.5} />
        ) : (
          <ChevronRight color="#999" size={14} strokeWidth={2.5} />
        )}
      </TouchableOpacity>

      {expanded ? (
        <View className="mt-3 gap-3">
          {summaryText ? (
            <View
              className="rounded-xl px-3 py-2"
              style={{ backgroundColor: chatAccent.elevatedBg }}
            >
              <Text className="text-[12px] font-medium text-foreground/75" numberOfLines={2}>
                {summaryText}
              </Text>
            </View>
          ) : null}

          {search.searchQueries?.length ? (
            <View>
              <Text className="text-[11px] font-semibold text-foreground/45 mb-1">
                {t.chatSearchQueries}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {search.searchQueries.map((query, index) => (
                  <View
                    className="rounded-full px-2.5 py-1"
                    key={`${query}-${index}`}
                    style={{ backgroundColor: chatAccent.chipBg }}
                  >
                    <Text className="text-[11px]" style={{ color: chatAccent.badgeText }}>
                      {query}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {search.citations?.length ? (
            <ScrollView
              horizontal
              contentContainerStyle={{ gap: 10 }}
              showsHorizontalScrollIndicator={false}
            >
              {search.citations.slice(0, 8).map((citation, index) => {
                const host = citation.favicon || getUrlHost(citation.url);
                const favicon = getCitationFavicon(citation);

                return (
                  <TouchableOpacity
                    activeOpacity={0.82}
                    className="rounded-2xl px-3 py-3"
                    key={`${citation.url}-${index}`}
                    style={{
                      backgroundColor: chatAccent.elevatedBg,
                      borderColor: chatAccent.sectionBorder,
                      borderWidth: 1,
                      width: 220,
                    }}
                    onPress={() => handleOpenLink(citation.url)}
                  >
                    <Text className="text-[13px] font-semibold text-foreground/80" numberOfLines={3}>
                      {citation.title || citation.url}
                    </Text>
                    <View className="mt-3 flex-row items-center">
                      {favicon ? (
                        <RNImage
                          source={{ uri: favicon }}
                          style={{ borderRadius: 8, height: 16, marginRight: 8, width: 16 }}
                        />
                      ) : null}
                      <Text className="flex-1 text-[11px] text-foreground/45" numberOfLines={1}>
                        {host || citation.url}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
              {search.citations.length > 8 ? (
                <View
                  className="items-center justify-center rounded-2xl px-3 py-3"
                  style={{
                    backgroundColor: chatAccent.elevatedBg,
                    borderColor: chatAccent.sectionBorder,
                    borderWidth: 1,
                    width: 180,
                  }}
                >
                  <Text className="text-[13px] font-semibold text-foreground/75">
                    +{search.citations.length - 8}
                  </Text>
                  <Text className="mt-1 text-[11px] text-foreground/45">{t.chatSearchSources}</Text>
                </View>
              ) : null}
            </ScrollView>
          ) : null}

          {search.imageSearchQueries?.length ? (
            <View>
              <Text className="text-[11px] font-semibold text-foreground/45 mb-1">
                {t.chatImageSearchQueries}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {search.imageSearchQueries.map((query, index) => (
                  <View
                    className="rounded-full px-2.5 py-1"
                    key={`${query}-${index}`}
                    style={{ backgroundColor: chatAccent.chipBg }}
                  >
                    <Text className="text-[11px]" style={{ color: chatAccent.badgeText }}>
                      {query}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {search.imageResults?.length ? (
            <ScrollView
              horizontal
              contentContainerStyle={{ gap: 8 }}
              showsHorizontalScrollIndicator={false}
            >
              {search.imageResults.map((item, index) => (
                <TouchableOpacity
                  activeOpacity={0.82}
                  className="rounded-xl overflow-hidden"
                  key={`${item.imageUri || item.sourceUri || index}-${index}`}
                  style={{
                    backgroundColor: chatAccent.elevatedBg,
                    borderColor: chatAccent.sectionBorder,
                    borderWidth: 1,
                    width: 124,
                  }}
                  onPress={() => handleOpenLink(item.sourceUri || item.imageUri)}
                >
                  {item.imageUri ? (
                    <RNImage
                      source={{ uri: item.imageUri }}
                      style={{ height: 72, width: 124 }}
                    />
                  ) : null}
                  <View className="px-2 py-2">
                    <Text className="text-[11px] font-medium text-foreground/75" numberOfLines={2}>
                      {item.title ? stripHtml(item.title) : item.domain || item.sourceUri || 'Image'}
                    </Text>
                    {item.domain || item.sourceUri ? (
                      <View className="mt-2 flex-row items-center">
                        {getImageResultFavicon(item) ? (
                          <RNImage
                            source={{ uri: getImageResultFavicon(item) }}
                            style={{ borderRadius: 6, height: 12, marginRight: 6, width: 12 }}
                          />
                        ) : null}
                        <Text className="flex-1 text-[10px] text-foreground/45" numberOfLines={1}>
                          {item.domain || getUrlHost(item.sourceUri) || item.sourceUri}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : null}
        </View>
      ) : null}
    </View>
  );
});

SearchGroundingBlock.displayName = 'SearchGroundingBlock';

const ToolStatusIcon = memo<{
  error?: unknown;
  resultReady?: boolean;
  status?: 'aborted' | 'pending' | 'rejected' | string | null;
}>(({ status, resultReady, error }) => {
  if (status === 'aborted') {
    return <Pause color="#8E8E93" size={12} strokeWidth={2.25} />;
  }

  if (status === 'rejected') {
    return <Ban color="#8E8E93" size={12} strokeWidth={2.25} />;
  }

  if (status === 'pending') {
    return <Hand color="#0A84FF" size={12} strokeWidth={2.1} />;
  }

  if (error) {
    return <X color="#FF3B30" size={12} strokeWidth={2.4} />;
  }

  if (resultReady) {
    return <Check color="#34C759" size={12} strokeWidth={2.4} />;
  }

  return <ActivityIndicator color="#666" size="small" />;
});

ToolStatusIcon.displayName = 'ToolStatusIcon';

const ToolStatusLabel = memo<{
  error?: unknown;
  resultReady?: boolean;
  status?: 'aborted' | 'pending' | 'rejected' | string | null;
}>(({ status, resultReady, error }) => {
  const { t } = useI18n();

  if (status === 'aborted') return t.chatToolAborted;
  if (status === 'rejected') return t.chatToolRejected;
  if (status === 'pending') return t.chatToolPending;
  if (error) return t.chatToolFailed;
  if (resultReady) return t.chatToolDone;
  return t.chatToolRunning;
});

ToolStatusLabel.displayName = 'ToolStatusLabel';

const ToolCard = memo<{
  collapsible?: boolean;
  argumentsText?: string;
  content?: string;
  error?: unknown;
  resultReady?: boolean;
  status?: 'aborted' | 'pending' | 'rejected' | string | null;
  title: string;
}>(({ title, argumentsText, status, resultReady, error, content, collapsible = false }) => {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(!collapsible);
  const showDetail = expanded || !collapsible;

  return (
    <TouchableOpacity
      activeOpacity={collapsible ? 0.82 : 1}
      className="rounded-2xl border border-black/5 px-3 py-3"
      disabled={!collapsible}
      style={{
        backgroundColor: chatAccent.elevatedBg,
        borderColor: chatAccent.sectionBorder,
      }}
      onPress={() => {
        if (collapsible) setExpanded((value) => !value);
      }}
    >
      <View className="flex-row items-start">
        <View
          className="mr-3 mt-0.5 h-6 w-6 items-center justify-center rounded-lg border border-black/5"
          style={{
            backgroundColor: chatAccent.badgeBg,
            borderColor: chatAccent.chipBorder,
          }}
        >
          <ToolStatusIcon error={error} resultReady={resultReady} status={status} />
        </View>
        <View className="flex-1">
          <View className="flex-row items-center">
            <Text className="flex-1 text-[12px] font-semibold text-foreground/80" numberOfLines={1}>
              {title}
            </Text>
            {collapsible ? (
              expanded ? (
                <ChevronDown color="#999" size={14} strokeWidth={2.3} />
              ) : (
                <ChevronRight color="#999" size={14} strokeWidth={2.3} />
              )
            ) : null}
          </View>
          <Text className="mt-0.5 text-[10px] uppercase tracking-[0.5px] text-foreground/38">
            <ToolStatusLabel error={error} resultReady={resultReady} status={status} />
          </Text>
          {showDetail && argumentsText ? (
            <>
              <Text className="mt-2 text-[10px] font-semibold uppercase tracking-[0.5px] text-foreground/35">
                {t.chatToolArguments}
              </Text>
              <Text
                className="mt-1 rounded-xl px-3 py-2 text-[11px] leading-4 text-foreground/60"
                style={{
                  backgroundColor: chatAccent.subtleBg,
                  fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                }}
              >
                {argumentsText}
              </Text>
            </>
          ) : null}
          {showDetail && content ? (
            <>
              <Text className="mt-2 text-[10px] font-semibold uppercase tracking-[0.5px] text-foreground/35">
                {t.chatToolResponse}
              </Text>
              <Text
                className="mt-1 rounded-xl px-3 py-2 text-[12px] leading-5 text-foreground/72"
                style={{ backgroundColor: chatAccent.subtleBg }}
              >
                {content}
              </Text>
            </>
          ) : null}
          {showDetail && error ? (
            <Text className="mt-2 text-[11px] leading-4 text-[#FF3B30]">
              {typeof error === 'string' ? error : t.chatToolFailed}
            </Text>
          ) : null}
          {!showDetail && argumentsText ? (
            <Text className="mt-2 text-[11px] leading-4 text-foreground/55" numberOfLines={2}>
              {argumentsText}
            </Text>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
});

ToolCard.displayName = 'ToolCard';

const ToolCallsBlock = memo<{ tools: ChatToolPayload[] }>(({ tools }) => {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(true);

  return (
    <View
      className="mb-2 rounded-2xl border border-black/5 px-3 py-2"
      style={{
        backgroundColor: chatAccent.sectionBg,
        borderColor: chatAccent.sectionBorder,
      }}
    >
      <TouchableOpacity
        activeOpacity={0.7}
        className="flex-row items-center justify-between"
        onPress={() => setExpanded((value) => !value)}
      >
        <View className="flex-row items-center flex-1">
          <Wrench color="#666" size={14} strokeWidth={2} />
          <Text className="ml-2 text-[12px] font-medium text-foreground/65">
            {t.chatToolsTitle} ({tools.length})
          </Text>
        </View>
        {expanded ? (
          <ChevronDown color="#999" size={14} strokeWidth={2.5} />
        ) : (
          <ChevronRight color="#999" size={14} strokeWidth={2.5} />
        )}
      </TouchableOpacity>

      {expanded ? (
        <View className="mt-3 gap-2">
          {tools.map((tool) => {
            const { params, title } = formatToolDisplayTitle(tool);
            const argumentsText = [
              params.length ? `(${params.join(', ')})` : '',
              tool.arguments ? formatToolArguments(tool.arguments) : '',
            ]
              .filter(Boolean)
              .join('\n');

            return (
              <ToolCard
                collapsible
                argumentsText={argumentsText || undefined}
                key={tool.id}
                resultReady={!!tool.result_msg_id}
                status={tool.intervention?.status ?? null}
                title={title || tool.apiName || tool.identifier}
              />
            );
          })}
        </View>
      ) : null}
    </View>
  );
});

ToolCallsBlock.displayName = 'ToolCallsBlock';

const ToolResultBlock = memo<{ message: ChatMessage }>(({ message }) => {
  const toolName = message.plugin?.apiName || message.plugin?.identifier || 'Tool';
  const { params, title } = formatToolDisplayTitle({
    apiName: message.plugin?.apiName || '',
    arguments: message.plugin?.arguments || '',
    identifier: message.plugin?.identifier || toolName,
  });
  const toolArguments = [
    params.length ? `(${params.join(', ')})` : '',
    message.plugin?.arguments ? formatToolArguments(message.plugin.arguments) : '',
  ]
    .filter(Boolean)
    .join('\n');
  const hasResult =
    !!message.content || !!message.pluginState || !!message.metadata?.tempDisplayContent?.length;

  return (
    <ToolCard
      argumentsText={toolArguments || undefined}
      content={message.content || undefined}
      error={message.pluginError}
      resultReady={hasResult && !message.pluginError}
      status={message.pluginIntervention?.status ?? null}
      title={title || toolName}
    />
  );
});

ToolResultBlock.displayName = 'ToolResultBlock';

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
  isMultimodal?: boolean;
  markdownStyles: Record<string, any>;
  tempDisplayContent?: MessageContentPart[];
  thinking?: boolean;
}

const ThinkingBlock = memo<ThinkingBlockProps>(
  ({ content, duration, isMultimodal, markdownStyles, tempDisplayContent, thinking }) => {
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
            <Text className="text-[12px] font-medium ml-1" style={{ color: chatAccent.badgeText }}>
              {durationLabel}
            </Text>
          )}
        </TouchableOpacity>

        {showContent ? (
          <View
            className="ml-4 mt-1 rounded-2xl border px-3 py-2"
            style={{
              backgroundColor: chatAccent.sectionBg,
              borderColor: chatAccent.sectionBorder,
            }}
          >
            <ScrollView
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 240 }}
            >
              {isMultimodal && tempDisplayContent?.length ? (
                <RichContentPartsBlock
                  markdownStyles={markdownStyles}
                  parts={tempDisplayContent}
                  onOpenLink={(url) => {
                    if (!url) return;
                    Linking.openURL(url).catch(() => undefined);
                  }}
                />
              ) : (
                <Markdown
                  style={markdownStyles}
                  onLinkPress={(url) => {
                    Linking.openURL(url).catch(() => undefined);
                    return false;
                  }}
                >
                  {content}
                </Markdown>
              )}
            </ScrollView>
          </View>
        ) : null}
      </View>
    );
  },
);

ThinkingBlock.displayName = 'ThinkingBlock';

export default MessageBubble;
