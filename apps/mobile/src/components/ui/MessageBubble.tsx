/**
 * MessageBubble — Renders a single chat message with actions.
 * Includes collapsible Thinking section, model info, token stats, save-to-topic.
 */
import * as Clipboard from 'expo-clipboard';
import {
  AlertTriangle,
  Ban,
  Bookmark,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Globe,
  Hand,
  Pause,
  Pencil,
  RefreshCw,
  Share2,
  Trash2,
  Wrench,
  X,
} from 'lucide-react-native';
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image as RNImage,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Share,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import Animated, { FadeIn } from 'react-native-reanimated';
import SyntaxHighlighter from 'react-native-syntax-highlighter';
import { WebView } from 'react-native-webview';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

import { getProviderIconUrl } from '../../constants/cdn';
import { semanticColors } from '../../constants/colors';
import { fileApi } from '../../lib/api';
import { haptics } from '../../lib/haptics';
import { useI18n } from '../../lib/i18n';
import { codeInlineRules } from '../../lib/markdownRules';
import { useResolvedRemoteAsset } from '../../lib/remoteAsset';
import { useChatStore } from '../../store/chat';
import { useSessionStore } from '../../store/session';
import { chatAccent, themeColors, uiColors } from '../../theme/colors';
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

const StreamingCursor = memo(() => {
  const [visible, setVisible] = useState(true);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  useEffect(() => {
    timer.current = setInterval(() => setVisible((v) => !v), 530);
    return () => clearInterval(timer.current);
  }, []);
  return (
    <View style={{ height: 18, justifyContent: 'center', marginLeft: 1, width: 8 }}>
      {visible && (
        <View
          style={{
            backgroundColor: themeColors.userBubbleBg,
            borderRadius: 1,
            height: 16,
            width: 3,
          }}
        />
      )}
    </View>
  );
});
StreamingCursor.displayName = 'StreamingCursor';

const getTimeAgo = (date?: string | Date): string => {
  if (!date) return '';
  const diff = Math.max(0, Date.now() - new Date(date).getTime());
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
};

const CodeCopyButton = memo<{ code: string }>(({ code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await Clipboard.setStringAsync(code.trim());
    haptics.success();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  return (
    <TouchableOpacity
      activeOpacity={0.6}
      hitSlop={{ bottom: 6, left: 6, right: 6, top: 6 }}
      onPress={handleCopy}
    >
      {copied ? (
        <Check color={themeColors.iconSuccess} size={14} strokeWidth={2} />
      ) : (
        <Copy color={themeColors.iconMuted} size={14} strokeWidth={2} />
      )}
    </TouchableOpacity>
  );
});

CodeCopyButton.displayName = 'CodeCopyButton';

const MermaidBlock = memo<{ code: string }>(({ code }) => {
  const [height, setHeight] = useState(200);
  const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
<style>body{margin:0;padding:8px;background:transparent;display:flex;justify-content:center}
.mermaid{font-size:13px}</style></head><body>
<div class="mermaid">${code.replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</div>
<script>mermaid.initialize({startOnLoad:true,theme:'neutral'});
mermaid.run().then(()=>{setTimeout(()=>{
const h=document.querySelector('.mermaid').scrollHeight;
window.ReactNativeWebView.postMessage(JSON.stringify({height:h+16}));
},200)})</script></body></html>`;
  return (
    <View style={{ borderRadius: 12, marginVertical: 6, overflow: 'hidden' }}>
      <WebView
        javaScriptEnabled
        originWhitelist={['*']}
        scrollEnabled={false}
        source={{ html }}
        style={{ backgroundColor: 'transparent', height, width: '100%' }}
        onMessage={(e) => {
          try {
            const data = JSON.parse(e.nativeEvent.data);
            if (data.height) setHeight(Math.min(data.height, 600));
          } catch {
            // Ignore malformed height payloads from the embedded renderer.
          }
        }}
      />
    </View>
  );
});
MermaidBlock.displayName = 'MermaidBlock';

const MathBlock = memo<{ display?: boolean; math: string }>(({ math, display }) => {
  const [height, setHeight] = useState(display ? 60 : 22);
  const escaped = math
    .replaceAll('\\', '\\\\')
    .replaceAll('`', '\\`')
    .replaceAll('</script', '<\\/script');
  const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
<style>body{margin:0;padding:${display ? '8px' : '0 2px'};background:transparent;${display ? 'display:flex;justify-content:center' : 'display:inline'}}</style></head><body>
<span id="m"></span><script>
try{katex.render(\`${escaped}\`,document.getElementById('m'),{displayMode:${display},throwOnError:false});
setTimeout(()=>{const h=document.body.scrollHeight;
window.ReactNativeWebView.postMessage(JSON.stringify({height:h}))},100)}
catch(e){document.getElementById('m').textContent=\`${escaped}\`}</script></body></html>`;
  return (
    <WebView
      javaScriptEnabled
      originWhitelist={['*']}
      scrollEnabled={false}
      source={{ html }}
      style={{
        backgroundColor: 'transparent',
        height,
        marginVertical: display ? 4 : 0,
        width: display ? '100%' : undefined,
      }}
      onMessage={(e) => {
        try {
          const data = JSON.parse(e.nativeEvent.data);
          if (data.height) setHeight(data.height);
        } catch {
          // Ignore malformed height payloads from the embedded renderer.
        }
      }}
    />
  );
});
MathBlock.displayName = 'MathBlock';

interface MessageBubbleProps {
  generating?: boolean;
  groupMembersById?: Record<string, GroupMessageSpeaker>;
  groupSupervisorId?: string;
  message: ChatMessage;
  onSaveToTopic?: () => void;
  sessionId: string;
}

export interface GroupMessageSpeaker {
  avatar?: string;
  id: string;
  isSupervisor?: boolean;
  title?: string;
}

const preprocessMathBlocks = (content: string): string => {
  return content.replaceAll(
    /\$\$([\s\S]+?)\$\$/g,
    (_match, math) => `\n\`\`\`math\n${math.trim()}\n\`\`\`\n`,
  );
};

const ARTIFACT_TAG_REGEX = /<lobeArtifact\b([^>]*)>([\s\S]*?)(?:<\/lobeArtifact>|$)/g;
const ARTIFACT_ATTR_REGEX = /(\w+)="([^"]*)"/g;

interface ArtifactSegment {
  artifactType?: string;
  content: string;
  identifier?: string;
  language?: string;
  title?: string;
  type: 'markdown' | 'artifact';
}

const splitArtifacts = (text: string): ArtifactSegment[] => {
  const segments: ArtifactSegment[] = [];
  let lastIndex = 0;
  ARTIFACT_TAG_REGEX.lastIndex = 0;

  let match;
  while ((match = ARTIFACT_TAG_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ content: text.slice(lastIndex, match.index), type: 'markdown' });
    }
    const attrs: Record<string, string> = {};
    let am;
    ARTIFACT_ATTR_REGEX.lastIndex = 0;
    while ((am = ARTIFACT_ATTR_REGEX.exec(match[1])) !== null) {
      attrs[am[1]] = am[2];
    }
    segments.push({
      artifactType: attrs.type,
      content: match[2].trim(),
      identifier: attrs.identifier,
      language: attrs.language,
      title: attrs.title,
      type: 'artifact',
    });
    lastIndex = ARTIFACT_TAG_REGEX.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({ content: text.slice(lastIndex), type: 'markdown' });
  }
  return segments;
};

const ArtifactBlock = memo<{
  artifactType?: string;
  content: string;
  language?: string;
  title?: string;
}>(({ title, artifactType, content, language: _language }) => {
  const [height, setHeight] = useState(300);
  const [expanded, setExpanded] = useState(false);

  const isSvg = artifactType === 'image/svg+xml';
  const isMermaid = artifactType === 'application/lobe.artifacts.mermaid';
  const isHtml = !artifactType || artifactType === 'text/html' || artifactType.includes('html');
  const isCode = artifactType === 'application/lobe.artifacts.code';
  const isMarkdownArtifact = artifactType === 'text/markdown';

  if (isMermaid) {
    return (
      <View style={{ marginVertical: 6 }}>
        {title ? (
          <Text
            style={{
              color: semanticColors.muted,
              fontSize: 12,
              fontWeight: '600',
              marginBottom: 4,
            }}
          >
            {title}
          </Text>
        ) : null}
        <MermaidBlock code={content} />
      </View>
    );
  }

  if (isCode || isMarkdownArtifact) {
    return null;
  }

  const htmlContent = isSvg
    ? `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;padding:8px;background:${themeColors.surface};display:flex;justify-content:center;align-items:center}
svg{max-width:100%;height:auto}</style></head><body>${content}</body></html>`
    : isHtml
      ? content.includes('<html')
        ? content
        : `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;padding:8px;font-family:-apple-system,system-ui,sans-serif;font-size:14px}</style></head><body>${content}</body></html>`
      : null;

  if (!htmlContent) return null;

  return (
    <View
      style={{
        backgroundColor: themeColors.fillQuaternary,
        borderRadius: 12,
        marginVertical: 6,
        overflow: 'hidden',
      }}
    >
      {title ? (
        <TouchableOpacity
          activeOpacity={0.7}
          style={{
            alignItems: 'center',
            backgroundColor: themeColors.fillTertiary,
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
          onPress={() => setExpanded((v) => !v)}
        >
          <Text
            numberOfLines={1}
            style={{ color: uiColors.textDark, fontSize: 13, fontWeight: '600' }}
          >
            {title}
          </Text>
          {expanded ? (
            <ChevronDown color={themeColors.iconMuted} size={14} />
          ) : (
            <ChevronRight color={themeColors.iconMuted} size={14} />
          )}
        </TouchableOpacity>
      ) : null}
      {(!title || expanded) && (
        <WebView
          javaScriptEnabled
          originWhitelist={['*']}
          scrollEnabled={false}
          source={{ html: htmlContent }}
          style={{ backgroundColor: themeColors.surface, height, width: '100%' }}
          onMessage={(e) => {
            try {
              const data = JSON.parse(e.nativeEvent.data);
              if (data.height) setHeight(Math.min(data.height, 500));
            } catch {
              // Ignore malformed height payloads from the embedded renderer.
            }
          }}
        />
      )}
    </View>
  );
});
ArtifactBlock.displayName = 'ArtifactBlock';

const GroupSpeakerAvatar = memo<{ fallbackLabel: string; speaker?: GroupMessageSpeaker }>(
  ({ fallbackLabel, speaker }) => {
    const avatar = speaker?.avatar?.trim();
    const resolvedAvatarUri = useResolvedRemoteAsset(avatar);

    if (avatar && avatar.length <= 4 && !resolvedAvatarUri) {
      return (
        <View className="h-7 w-7 items-center justify-center rounded-full bg-primary/10">
          <Text className="text-[14px]">{avatar}</Text>
        </View>
      );
    }

    if (resolvedAvatarUri) {
      return (
        <View className="h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-primary/10">
          <RNImage source={{ uri: resolvedAvatarUri }} style={{ height: 28, width: 28 }} />
        </View>
      );
    }

    return (
      <View className="h-7 w-7 items-center justify-center rounded-full bg-primary/10">
        <Text className="text-[12px] font-semibold text-primary">{fallbackLabel}</Text>
      </View>
    );
  },
);

GroupSpeakerAvatar.displayName = 'GroupSpeakerAvatar';

const CompareGroupBlock = memo<{
  childrenMessages: ChatMessage[];
  groupMembersById?: Record<string, GroupMessageSpeaker>;
  groupSupervisorId?: string;
  markdownStyles: Record<string, unknown>;
  onOpenLink: (url?: string) => void;
  t: ReturnType<typeof useI18n.getState>['t'];
}>(({ childrenMessages, groupMembersById, groupSupervisorId, markdownStyles, onOpenLink, t }) => {
  return (
    <View className="gap-2">
      {childrenMessages.map((child) => {
        const speakerId = child.agentId || groupSupervisorId;
        const speaker = speakerId ? groupMembersById?.[speakerId] : undefined;
        const isSupervisor = Boolean(
          speaker?.isSupervisor || (speakerId && speakerId === groupSupervisorId),
        );
        const speakerName =
          speaker?.title || (isSupervisor ? t.groupSettingsSupervisor : t.settingsDefaultAgent);
        const fallbackLabel = (speakerName || t.settingsDefaultAgent).slice(0, 1).toUpperCase();
        const childContent = preprocessMathBlocks(
          injectCitationLinks(child.content, child.search?.citations),
        );

        return (
          <View
            className="rounded-2xl border border-foreground/[0.06] bg-foreground/[0.02] px-3 py-2.5"
            key={child.id}
          >
            <View className="mb-2 flex-row items-center">
              <GroupSpeakerAvatar fallbackLabel={fallbackLabel} speaker={speaker} />
              <View className="ml-2 min-w-0 flex-1">
                <Text className="text-[12px] font-semibold text-foreground/75" numberOfLines={1}>
                  {speakerName}
                </Text>
                {child.model ? (
                  <Text className="text-[11px] text-foreground/35" numberOfLines={1}>
                    {child.model}
                  </Text>
                ) : null}
              </View>
              {child.createdAt ? (
                <Text className="ml-2 text-[10px] text-foreground/20">
                  {getTimeAgo(child.createdAt)}
                </Text>
              ) : null}
            </View>

            {childContent ? (
              <Markdown
                rules={codeInlineRules}
                style={markdownStyles as any}
                onLinkPress={(url) => {
                  onOpenLink(url);
                  return false;
                }}
              >
                {childContent}
              </Markdown>
            ) : child.reasoning?.content ? (
              <Text className="text-[14px] leading-6 text-foreground/60">
                {child.reasoning.content}
              </Text>
            ) : (
              <TypingIndicator color={uiColors.typingIndicator} />
            )}
          </View>
        );
      })}
    </View>
  );
});

CompareGroupBlock.displayName = 'CompareGroupBlock';

const MessageBubble = memo<MessageBubbleProps>(
  ({ message, sessionId, generating, groupMembersById, groupSupervisorId, onSaveToTopic }) => {
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
    const [contentCollapsed, setContentCollapsed] = useState(true);
    const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);

    const deleteMessage = useChatStore((s) => s.deleteMessage);
    const editMessage = useChatStore((s) => s.editMessage);
    const regenerateMessage = useChatStore((s) => s.regenerateMessage);
    const toggleMessageCollapsed = useChatStore((s) => s.toggleMessageCollapsed);
    const isReasoning = useChatStore((s) => s.isReasoning);
    const isGroupSession = useSessionStore(
      (s) => s.sessions.find((session) => session.id === sessionId)?.type === 'group',
    );

    const dismissActions = useCallback(() => setShowActions(false), []);

    const handleCopy = useCallback(async () => {
      await Clipboard.setStringAsync(message.content);
      haptics.success();
      toast.show('success', t.toastCopied);
      dismissActions();
    }, [message.content, t, toast, dismissActions]);

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

    const handleShare = useCallback(async () => {
      haptics.light();
      dismissActions();
      try {
        const shareText = message.content || message.reasoning?.content || '';
        await Share.share({ message: shareText });
      } catch {
        // user cancelled
      }
    }, [message.content, message.reasoning?.content, dismissActions]);

    const handleDelete = useCallback(() => {
      haptics.light();
      dismissActions();
      Alert.alert(t.deleteMessageConfirm, t.deleteMessageDesc, [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.delete,
          style: 'destructive',
          onPress: () => {
            haptics.warning();
            deleteMessage(sessionId, message.id);
          },
        },
      ]);
    }, [sessionId, message.id, deleteMessage, t, dismissActions]);

    const handlePress = useCallback(() => {
      if (!generating) {
        haptics.light();
        setShowActions((prev) => !prev);
      }
    }, [generating]);

    const handleSaveToTopic = useCallback(() => {
      haptics.light();
      dismissActions();
      onSaveToTopic?.();
    }, [onSaveToTopic, dismissActions]);

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

    const handleDownloadFile = useCallback(
      async (file: NonNullable<ChatMessage['fileList']>[number]) => {
        if (downloadingFileId === file.id) return;

        setDownloadingFileId(file.id);
        try {
          await fileApi.download(file);
          haptics.success();
          toast.show('success', t.resourceDownloaded);
        } catch {
          toast.show('error', t.resourceDownloadFailed);
        } finally {
          setDownloadingFileId(null);
        }
      },
      [downloadingFileId, t, toast],
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
        borderColor: themeColors.borderSubtle,
        borderRadius: 8,
        borderWidth: 0.5,
        overflow: 'hidden' as const,
      },
      thead: { backgroundColor: themeColors.fillTertiary },
      th: {
        borderColor: themeColors.borderSubtle,
        borderWidth: 0.5,
        color: mc.heading,
        flex: 1,
        fontSize: 13,
        fontWeight: '600' as const,
        padding: 8,
      },
      tr: { borderColor: themeColors.borderSubtle, borderBottomWidth: 0.5 },
      td: {
        borderColor: themeColors.borderSubtle,
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
      blockquote: {
        backgroundColor: 'transparent',
        borderLeftColor: chatAccent.quoteBorder,
        borderLeftWidth: 4,
        marginVertical: 10,
        paddingLeft: 12,
        paddingVertical: 2,
      },
      blockquote_content: {
        color: mc.text,
        fontSize: 15,
        lineHeight: 22,
      },
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
        fontSize: 16,
        fontWeight: '700' as const,
        letterSpacing: -0.3,
        marginBottom: 6,
        marginTop: 10,
      },
      heading2: {
        color: mc.heading,
        fontSize: 15,
        fontWeight: '600' as const,
        letterSpacing: -0.2,
        marginBottom: 4,
        marginTop: 8,
      },
      heading3: {
        color: mc.heading,
        fontSize: 15,
        fontWeight: '600' as const,
        marginBottom: 4,
        marginTop: 6,
      },
      list_item: { marginBottom: 4 },
      hr: { backgroundColor: themeColors.divider, height: 1, marginVertical: 12 },
      ...tableStyles,
    };

    const userMarkdownStyles = {
      ...markdownStyles,
      body: {
        ...markdownStyles.body,
        color: themeColors.userBubbleText,
        flexShrink: 1,
        fontSize: 15,
        lineHeight: 20,
      },
      paragraph: { marginBottom: 2, marginTop: 2 },
      blockquote: {
        ...markdownStyles.blockquote,
        borderLeftColor: themeColors.userBubbleTextMuted,
      },
      blockquote_content: {
        ...markdownStyles.blockquote_content,
        color: themeColors.userBubbleText,
      },
      code_inline: {
        ...markdownStyles.code_inline,
        backgroundColor: themeColors.userBubbleCodeBg,
        color: themeColors.userBubbleText,
      },
      fence: {
        ...markdownStyles.fence,
        backgroundColor: themeColors.userBubbleTableBg,
        borderColor: themeColors.userBubbleTableBorder,
      },
      code_block: {
        ...markdownStyles.code_block,
        backgroundColor: themeColors.userBubbleTableBg,
        color: themeColors.userBubbleText,
      },
      link: { color: themeColors.userBubbleLink },
      heading1: { ...markdownStyles.heading1, color: themeColors.userBubbleText },
      heading2: { ...markdownStyles.heading2, color: themeColors.userBubbleText },
      heading3: { ...markdownStyles.heading3, color: themeColors.userBubbleText },
      hr: { ...markdownStyles.hr, backgroundColor: themeColors.userBubbleHr },
      table: { ...tableStyles.table, borderColor: themeColors.userBubbleTableBorder },
      thead: { backgroundColor: themeColors.userBubbleTableBorder },
      th: {
        ...tableStyles.th,
        borderColor: themeColors.userBubbleHr,
        color: themeColors.userBubbleText,
      },
      tr: { ...tableStyles.tr, borderColor: themeColors.userBubbleTableBg },
      td: {
        ...tableStyles.td,
        borderColor: themeColors.userBubbleTableBorder,
        color: themeColors.userBubbleText,
      },
    };

    const markdownRules = {
      ...codeInlineRules,
      fence: (node: any, _children: any, _parent: any, styles: any) => {
        const code = node.content ?? '';
        const lang = (node.sourceInfo ?? '').toLowerCase();

        if (lang === 'mermaid') {
          return <MermaidBlock code={code.trim()} key={node.key} />;
        }
        if (lang === 'math' || lang === 'latex' || lang === 'katex') {
          return <MathBlock display key={node.key} math={code.trim()} />;
        }

        return (
          <View key={node.key} style={{ marginVertical: 6 }}>
            <View style={[styles.fence, { position: 'relative' as const }]}>
              <View
                style={{
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginBottom: 6,
                }}
              >
                {lang ? (
                  <Text
                    style={{
                      color: mc.text + '66',
                      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                      fontSize: 11,
                      fontWeight: '600',
                      textTransform: 'uppercase',
                    }}
                  >
                    {lang}
                  </Text>
                ) : (
                  <View />
                )}
                <CodeCopyButton code={code} />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {lang ? (
                  <SyntaxHighlighter
                    customStyle={{ backgroundColor: 'transparent', padding: 0, margin: 0 }}
                    fontSize={13}
                    highlighter="prism"
                    language={lang}
                    style={oneDark}
                  >
                    {code.replace(/\n$/, '')}
                  </SyntaxHighlighter>
                ) : (
                  <Text
                    selectable
                    style={{
                      color: mc.text,
                      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                      fontSize: 13,
                      lineHeight: 20,
                    }}
                  >
                    {code}
                  </Text>
                )}
              </ScrollView>
            </View>
          </View>
        );
      },
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
      !!(message.search.citations?.length || message.search.imageResults?.length);
    const shouldShowGroupSpeaker =
      isGroupSession &&
      !isUser &&
      !isToolMessage &&
      message.role !== 'compareGroup' &&
      message.role !== 'compressedGroup';
    const groupSpeakerId = shouldShowGroupSpeaker
      ? message.agentId || groupSupervisorId
      : undefined;
    const groupSpeaker = groupSpeakerId ? groupMembersById?.[groupSpeakerId] : undefined;
    const isSupervisorSpeaker = Boolean(
      groupSpeaker?.isSupervisor || (groupSpeakerId && groupSpeakerId === groupSupervisorId),
    );
    const groupSpeakerName =
      groupSpeaker?.title || (isSupervisorSpeaker ? t.groupSettingsSupervisor : undefined);
    const groupSpeakerFallbackLabel = (groupSpeakerName || t.settingsDefaultAgent)
      .slice(0, 1)
      .toUpperCase();
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
    const CONTENT_COLLAPSE_THRESHOLD = 3000;
    const fullContent = preprocessMathBlocks(
      injectCitationLinks(message.content, message.search?.citations),
    );
    const hasArtifacts = !isUser && ARTIFACT_TAG_REGEX.test(fullContent);
    ARTIFACT_TAG_REGEX.lastIndex = 0;
    const contentWithoutArtifacts = hasArtifacts
      ? fullContent.replace(ARTIFACT_TAG_REGEX, '')
      : fullContent;
    const artifactSegments = hasArtifacts ? splitArtifacts(fullContent) : null;
    const isLongContent = !isUser && contentWithoutArtifacts.length > CONTENT_COLLAPSE_THRESHOLD;
    const renderedContent =
      isLongContent && contentCollapsed
        ? contentWithoutArtifacts.slice(0, CONTENT_COLLAPSE_THRESHOLD)
        : contentWithoutArtifacts;
    const renderedReasoning = injectCitationLinks(
      message.reasoning?.content,
      message.search?.citations,
    );
    const assistantContentWidth = { maxWidth: '100%' as const, minWidth: 0 };
    const userContentWidth = { maxWidth: '100%' as const, minWidth: 0 };
    const hasTextContent = !!(renderedContent?.trim() || multimodalContentParts?.length);
    const showStandaloneUserAttachments = isUser && hasAttachments && !hasTextContent;
    const compareGroupChildren =
      message.role === 'compareGroup' && message.children?.length ? message.children : null;
    const compressedGroupMessages =
      message.role === 'compressedGroup' && message.compressedMessages?.length
        ? message.compressedMessages
        : null;
    const isCompressedGroupExpanded =
      message.role === 'compressedGroup' &&
      (message.metadata as Record<string, unknown>)?.expanded === true;
    const showMessageBubble =
      !showStandaloneUserAttachments ||
      !!renderedContent ||
      !!compareGroupChildren?.length ||
      !!compressedGroupMessages?.length ||
      !!multimodalContentParts?.length ||
      isToolMessage ||
      !!message.error ||
      message.role === 'compressedGroup';

    return (
      <Animated.View entering={FadeIn.duration(200)}>
        <TouchableOpacity
          activeOpacity={1}
          className={`flex-row w-full mb-1.5 px-4 ${isUser ? 'justify-end' : 'justify-start'}`}
          delayLongPress={180}
          onLongPress={handlePress}
        >
          {!isUser && (
            <View className="mr-2.5 w-7 items-center pt-0.5">
              <View className="h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-foreground/[0.04]">
                {shouldShowGroupSpeaker ? (
                  <GroupSpeakerAvatar
                    fallbackLabel={groupSpeakerFallbackLabel}
                    speaker={groupSpeaker}
                  />
                ) : message.provider ? (
                  <RNImage
                    className="w-4 h-4"
                    defaultSource={require('../../../assets/avato-icon.png')}
                    resizeMode="contain"
                    source={{ uri: getProviderIconUrl(message.provider) }}
                  />
                ) : (
                  <RNImage
                    className="w-5 h-5 rounded-md"
                    source={require('../../../assets/avato-icon.png')}
                  />
                )}
              </View>
            </View>
          )}

          <View className={isUser ? 'items-end min-w-0 flex-1' : 'flex-1 min-w-0'}>
            {!isUser &&
              (shouldShowGroupSpeaker ? (
                <View className="mb-1.5 flex-row items-center">
                  <View className="min-w-0 flex-1 flex-row items-center">
                    <Text
                      className="text-[12px] font-semibold text-foreground/75"
                      numberOfLines={1}
                    >
                      {groupSpeakerName || t.settingsDefaultAgent}
                    </Text>
                    {isSupervisorSpeaker ? (
                      <View className="ml-2 rounded-full bg-primary/10 px-2 py-0.5">
                        <Text className="text-[10px] font-semibold text-primary">
                          {t.groupSettingsSupervisor}
                        </Text>
                      </View>
                    ) : null}
                    {message.model ? (
                      <Text
                        className="ml-2 flex-1 text-[11px] text-foreground/35"
                        numberOfLines={1}
                      >
                        {message.model}
                      </Text>
                    ) : null}
                  </View>
                  {message.createdAt ? (
                    <Text className="ml-2 text-[10px] text-foreground/20">
                      {getTimeAgo(message.createdAt)}
                    </Text>
                  ) : null}
                </View>
              ) : (
                <View className="mb-1.5 flex-row items-center">
                  {message.model ? (
                    <Text className="text-[11px] text-foreground/35 flex-1" numberOfLines={1}>
                      {message.model}
                    </Text>
                  ) : null}
                  {message.createdAt ? (
                    <Text className="text-[10px] text-foreground/20 ml-2">
                      {getTimeAgo(message.createdAt)}
                    </Text>
                  ) : null}
                </View>
              ))}

            <View style={isUser ? userContentWidth : assistantContentWidth}>
              {showStandaloneUserAttachments ? (
                <View className="mb-2">
                  <AttachmentBlock
                    downloadingFileId={downloadingFileId}
                    fileList={message.fileList}
                    imageList={message.imageList}
                    isUser={isUser}
                    onOpenFile={handleDownloadFile}
                    onOpenImage={(url) => {
                      setViewerUri(url);
                      setShowImageViewer(true);
                    }}
                  />
                </View>
              ) : null}
              {showMessageBubble ? (
                <View
                  className={
                    isUser ? 'px-3.5 py-2 rounded-[18px] bg-primary rounded-tr-md' : 'py-0.5'
                  }
                  style={
                    isUser
                      ? {
                          shadowColor: semanticColors.primary,
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: 0.08,
                          shadowRadius: 4,
                          elevation: 2,
                        }
                      : undefined
                  }
                >
                  {isEditing ? (
                    <View
                      style={
                        isUser
                          ? undefined
                          : {
                              backgroundColor: uiColors.codeBlockLight,
                              borderRadius: 16,
                              padding: 14,
                            }
                      }
                    >
                      <TextInput
                        autoFocus
                        multiline
                        className="text-[15px] leading-6 min-h-[40px]"
                        style={{ color: isUser ? themeColors.userBubbleText : mc.text }}
                        value={editText}
                        onBlur={handleEditSubmit}
                        onChangeText={setEditText}
                        onSubmitEditing={handleEditSubmit}
                      />
                      <View className="flex-row justify-end mt-2.5 gap-2">
                        <TouchableOpacity
                          className="px-3.5 py-1.5 rounded-full"
                          style={{
                            backgroundColor: isUser
                              ? themeColors.userBubbleCodeBg
                              : themeColors.markdownCodeInlineBg,
                          }}
                          onPress={() => setIsEditing(false)}
                        >
                          <Text
                            style={{
                              color: isUser ? themeColors.userBubbleText : mc.text,
                              fontSize: 12,
                              fontWeight: '500',
                            }}
                          >
                            {t.editCancel}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          className="px-3.5 py-1.5 rounded-full bg-primary"
                          style={isUser ? { backgroundColor: themeColors.surface } : undefined}
                          onPress={handleEditSubmit}
                        >
                          <Text
                            style={{
                              color: isUser ? themeColors.foreground : themeColors.userBubbleText,
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
                        <View className="mb-2">
                          <AttachmentBlock
                            downloadingFileId={downloadingFileId}
                            fileList={message.fileList}
                            imageList={message.imageList}
                            isUser={isUser}
                            onOpenFile={handleDownloadFile}
                            onOpenImage={(url) => {
                              setViewerUri(url);
                              setShowImageViewer(true);
                            }}
                          />
                        </View>
                      ) : null}

                      {hasSearch && message.search && (
                        <SearchGroundingBlock search={message.search} />
                      )}

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
                            thinking={
                              generating && isReasoning && message.id.startsWith('assistant-')
                            }
                          />
                        )}
                      {compareGroupChildren?.length ? (
                        <CompareGroupBlock
                          childrenMessages={compareGroupChildren}
                          groupMembersById={groupMembersById}
                          groupSupervisorId={groupSupervisorId}
                          markdownStyles={markdownStyles}
                          t={t}
                          onOpenLink={handleOpenLink}
                        />
                      ) : compressedGroupMessages?.length ? (
                        isCompressedGroupExpanded ? (
                          <View className="gap-2">
                            <CompareGroupBlock
                              childrenMessages={compressedGroupMessages}
                              groupMembersById={groupMembersById}
                              groupSupervisorId={groupSupervisorId}
                              markdownStyles={markdownStyles}
                              t={t}
                              onOpenLink={handleOpenLink}
                            />
                            <TouchableOpacity
                              activeOpacity={0.7}
                              className="mt-1 py-1"
                              onPress={() => {
                                haptics.light();
                                toggleMessageCollapsed(sessionId, message.id, false);
                              }}
                            >
                              <Text
                                className="text-[12px] font-medium"
                                style={{ color: themeColors.info }}
                              >
                                {t.chatShowLess}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <View>
                            <Markdown
                              rules={markdownRules}
                              style={markdownStyles}
                              onLinkPress={(url) => {
                                handleOpenLink(url);
                                return false;
                              }}
                            >
                              {preprocessMathBlocks(
                                injectCitationLinks(
                                  (message.content || '').slice(0, 500) +
                                    (message.content && message.content.length > 500 ? '...' : ''),
                                  message.search?.citations,
                                ),
                              )}
                            </Markdown>
                            <TouchableOpacity
                              activeOpacity={0.7}
                              className="mt-2 py-2 rounded-xl bg-foreground/[0.04] items-center"
                              onPress={() => {
                                haptics.light();
                                toggleMessageCollapsed(sessionId, message.id, true);
                              }}
                            >
                              <Text
                                className="text-[13px] font-medium"
                                style={{ color: themeColors.info }}
                              >
                                {t.chatShowMore}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        )
                      ) : isToolMessage ? (
                        <ToolResultBlock message={message} />
                      ) : !message.content && !multimodalContentParts && generating ? (
                        isReasoning ? null : (
                          <TypingIndicator color={uiColors.typingIndicator} />
                        )
                      ) : multimodalContentParts?.length ? (
                        <RichContentPartsBlock
                          citations={message.search?.citations}
                          markdownStyles={isUser ? userMarkdownStyles : markdownStyles}
                          parts={multimodalContentParts}
                          onOpenLink={handleOpenLink}
                        />
                      ) : renderedContent || artifactSegments ? (
                        <>
                          {renderedContent ? (
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
                          {artifactSegments?.map((seg, idx) =>
                            seg.type === 'artifact' ? (
                              <ArtifactBlock
                                artifactType={seg.artifactType}
                                content={seg.content}
                                key={`artifact-${idx}`}
                                language={seg.language}
                                title={seg.title}
                              />
                            ) : null,
                          )}
                          {generating && !isUser && !isReasoning && <StreamingCursor />}
                          {isLongContent && (
                            <TouchableOpacity
                              activeOpacity={0.7}
                              className="mt-1 py-1"
                              onPress={() => setContentCollapsed((v) => !v)}
                            >
                              <Text
                                className="text-[12px] font-medium"
                                style={{ color: themeColors.info }}
                              >
                                {contentCollapsed ? t.chatShowMore : t.chatShowLess}
                              </Text>
                            </TouchableOpacity>
                          )}
                        </>
                      ) : null}
                      {!isUser && !generating && message.error && (
                        <ErrorBlock error={message.error} onRetry={handleRegenerate} />
                      )}
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
              {!generating && !isEditing && showActions && (
                <Animated.View
                  className={`flex-row items-center mt-2 gap-1 ${isUser ? 'justify-end' : 'justify-start'}`}
                  entering={FadeIn.duration(200)}
                >
                  {!isUser && !isToolMessage && (
                    <TouchableOpacity
                      accessibilityLabel={t.msgActionRegenerate}
                      activeOpacity={0.5}
                      className="w-8 h-8 rounded-full items-center justify-center"
                      style={{ backgroundColor: themeColors.fillTertiary }}
                      onPress={handleRegenerate}
                    >
                      <RefreshCw color={semanticColors.muted} size={14} strokeWidth={2} />
                    </TouchableOpacity>
                  )}
                  {isUser && (
                    <TouchableOpacity
                      accessibilityLabel={t.msgActionEdit}
                      activeOpacity={0.5}
                      className="w-8 h-8 rounded-full items-center justify-center"
                      style={{ backgroundColor: themeColors.fillTertiary }}
                      onPress={handleEdit}
                    >
                      <Pencil color={semanticColors.muted} size={14} strokeWidth={2} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    accessibilityLabel={t.msgActionCopy}
                    activeOpacity={0.5}
                    className="w-8 h-8 rounded-full items-center justify-center"
                    style={{ backgroundColor: themeColors.fillTertiary }}
                    onPress={handleCopy}
                  >
                    <Copy color={semanticColors.muted} size={14} strokeWidth={2} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityLabel={t.msgActionShare}
                    activeOpacity={0.5}
                    className="w-8 h-8 rounded-full items-center justify-center"
                    style={{ backgroundColor: themeColors.fillTertiary }}
                    onPress={handleShare}
                  >
                    <Share2 color={semanticColors.muted} size={14} strokeWidth={2} />
                  </TouchableOpacity>
                  {!isUser && onSaveToTopic && (
                    <TouchableOpacity
                      accessibilityLabel={t.msgActionSaveToTopic}
                      activeOpacity={0.5}
                      className="w-8 h-8 rounded-full items-center justify-center"
                      style={{ backgroundColor: themeColors.fillTertiary }}
                      onPress={handleSaveToTopic}
                    >
                      <Bookmark color={semanticColors.muted} size={14} strokeWidth={2} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    accessibilityLabel={t.msgActionDelete}
                    activeOpacity={0.5}
                    className="w-8 h-8 rounded-full items-center justify-center"
                    style={{ backgroundColor: themeColors.fillTertiary }}
                    onPress={handleDelete}
                  >
                    <Trash2 color={semanticColors.danger} size={14} strokeWidth={2} />
                  </TouchableOpacity>
                </Animated.View>
              )}
            </View>
          </View>
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

const formatToolDisplayTitle = (
  tool: Pick<ChatToolPayload, 'apiName' | 'arguments' | 'identifier'>,
) => {
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

  return content
    .replaceAll(/\[\^(\d+)\^\]/g, (token, rawIndex) => {
      const citation = citations[Number(rawIndex) - 1];
      if (!citation?.url) return `[${rawIndex}]`;
      return `[^${rawIndex}](${citation.url})`;
    })
    .replaceAll(/\[\^(\d+)\]/g, (token, rawIndex) => {
      const citation = citations[Number(rawIndex) - 1];
      if (!citation?.url) return `[${rawIndex}]`;
      return `[^${rawIndex}](${citation.url})`;
    })
    .replaceAll(/\[(\d+)\]/g, (token, rawIndex) => {
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
              backgroundColor: themeColors.fillTertiary,
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
            rules={codeInlineRules}
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
  downloadingFileId?: string | null;
  fileList?: ChatMessage['fileList'];
  imageList?: ChatMessage['imageList'];
  isUser: boolean;
  onOpenFile: (file: NonNullable<ChatMessage['fileList']>[number]) => void;
  onOpenImage: (url: string) => void;
}>(({ imageList, fileList, isUser, onOpenFile, onOpenImage, downloadingFileId }) => (
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
                backgroundColor: isUser ? themeColors.userBubbleSubtleBg : chatAccent.subtleBg,
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
          <TouchableOpacity
            activeOpacity={0.85}
            className="rounded-2xl px-3 py-2"
            key={file.id}
            style={{
              backgroundColor: isUser ? themeColors.userBubbleSubtleBg : chatAccent.subtleBg,
            }}
            onPress={() => onOpenFile(file)}
          >
            <View className="flex-row items-center justify-between gap-3">
              <View className="flex-1">
                <Text
                  numberOfLines={1}
                  style={{
                    color: isUser ? themeColors.userBubbleText : tokens.markdownColors.heading,
                    fontSize: 13,
                    fontWeight: '600',
                  }}
                >
                  {file.name}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{
                    color: isUser
                      ? themeColors.userBubbleTextMuted
                      : tokens.markdownColors.text + '88',
                    fontSize: 12,
                    marginTop: 2,
                  }}
                >
                  {file.fileType}
                </Text>
              </View>
              {downloadingFileId === file.id ? (
                <ActivityIndicator
                  color={isUser ? themeColors.userBubbleText : chatAccent.badgeText}
                  size="small"
                />
              ) : (
                <Download
                  color={isUser ? themeColors.userBubbleText : chatAccent.badgeText}
                  size={16}
                  strokeWidth={1.9}
                />
              )}
            </View>
          </TouchableOpacity>
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
            className="flex-row items-start rounded-2xl px-3 py-2"
            key={`${citation.url}-${index}`}
            style={{
              backgroundColor: chatAccent.sectionBg,
            }}
            onPress={() => onOpenLink(citation.url)}
          >
            <View
              className="items-center justify-center mr-3 mt-0.5 rounded-full"
              style={{ backgroundColor: chatAccent.badgeBg, height: 22, width: 22 }}
            >
              <Text className="text-[11px] font-semibold" style={{ color: chatAccent.badgeText }}>
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
      className="mb-2 rounded-2xl px-3 py-2"
      style={{
        backgroundColor: chatAccent.sectionBg,
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
                    backgroundColor: themeColors.surface,
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
          <ChevronDown color={themeColors.iconMuted} size={14} strokeWidth={2.5} />
        ) : (
          <ChevronRight color={themeColors.iconMuted} size={14} strokeWidth={2.5} />
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
                      width: 220,
                    }}
                    onPress={() => handleOpenLink(citation.url)}
                  >
                    <Text
                      className="text-[13px] font-semibold text-foreground/80"
                      numberOfLines={3}
                    >
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
                    width: 124,
                  }}
                  onPress={() => handleOpenLink(item.sourceUri || item.imageUri)}
                >
                  {item.imageUri ? (
                    <RNImage source={{ uri: item.imageUri }} style={{ height: 72, width: 124 }} />
                  ) : null}
                  <View className="px-2 py-2">
                    <Text className="text-[11px] font-medium text-foreground/75" numberOfLines={2}>
                      {item.title
                        ? stripHtml(item.title)
                        : item.domain || item.sourceUri || 'Image'}
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
    return <Pause color={themeColors.tertiaryText} size={12} strokeWidth={2.25} />;
  }

  if (status === 'rejected') {
    return <Ban color={themeColors.tertiaryText} size={12} strokeWidth={2.25} />;
  }

  if (status === 'pending') {
    return <Hand color={themeColors.info} size={12} strokeWidth={2.1} />;
  }

  if (error) {
    return <X color={themeColors.danger} size={12} strokeWidth={2.4} />;
  }

  if (resultReady) {
    return <Check color={themeColors.iconSuccess} size={12} strokeWidth={2.4} />;
  }

  return <ActivityIndicator color={semanticColors.muted} size="small" />;
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

const ToolContentCopyButton = memo<{ text: string }>(({ text }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await Clipboard.setStringAsync(text.trim());
    haptics.success();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <TouchableOpacity
      activeOpacity={0.6}
      hitSlop={{ bottom: 4, left: 4, right: 4, top: 4 }}
      style={{ position: 'absolute', right: 8, top: 8 }}
      onPress={handleCopy}
    >
      {copied ? (
        <Check color={themeColors.iconSuccess} size={12} strokeWidth={2} />
      ) : (
        <Copy color={themeColors.iconMuted} size={12} strokeWidth={2} />
      )}
    </TouchableOpacity>
  );
});

ToolContentCopyButton.displayName = 'ToolContentCopyButton';

const ToolCard = memo<{
  collapsible?: boolean;
  argumentsText?: string;
  content?: string;
  error?: unknown;
  onApprove?: () => void;
  onReject?: () => void;
  resultReady?: boolean;
  status?: 'aborted' | 'pending' | 'rejected' | string | null;
  title: string;
}>(
  ({
    title,
    argumentsText,
    status,
    resultReady,
    error,
    content,
    collapsible = false,
    onApprove,
    onReject,
  }) => {
    const { t } = useI18n();
    const isPending = status === 'pending';
    const isRejected = status === 'rejected';
    const isAborted = status === 'aborted';
    const [expanded, setExpanded] = useState(!collapsible || isPending);
    const showDetail = expanded || !collapsible;
    const [contentExpanded, setContentExpanded] = useState(false);

    const truncatedContent =
      content && content.length > 500 && !contentExpanded ? content.slice(0, 500) + '...' : content;

    return (
      <TouchableOpacity
        activeOpacity={collapsible ? 0.82 : 1}
        className="rounded-2xl px-3 py-3"
        disabled={!collapsible}
        style={{
          backgroundColor: isPending ? themeColors.infoSubtle : chatAccent.elevatedBg,
        }}
        onPress={() => {
          if (collapsible) setExpanded((value) => !value);
        }}
      >
        <View className="flex-row items-start">
          <View
            className="mr-3 mt-0.5 h-6 w-6 items-center justify-center rounded-lg"
            style={{
              backgroundColor: isPending ? themeColors.infoMuted : chatAccent.badgeBg,
            }}
          >
            <ToolStatusIcon error={error} resultReady={resultReady} status={status} />
          </View>
          <View className="flex-1">
            <View className="flex-row items-center">
              <Text
                className="flex-1 text-[12px] font-semibold text-foreground/80"
                numberOfLines={1}
              >
                {title}
              </Text>
              {collapsible ? (
                expanded ? (
                  <ChevronDown color={themeColors.iconMuted} size={14} strokeWidth={2.3} />
                ) : (
                  <ChevronRight color={themeColors.iconMuted} size={14} strokeWidth={2.3} />
                )
              ) : null}
            </View>
            <Text className="mt-0.5 text-[10px] uppercase tracking-[0.5px] text-foreground/38">
              <ToolStatusLabel error={error} resultReady={resultReady} status={status} />
            </Text>

            {showDetail && isPending && (
              <View className="mt-2">
                <Text className="text-[11px] leading-4 text-foreground/55 mb-2">
                  {t.chatToolPendingDesc}
                </Text>
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    activeOpacity={0.7}
                    className="rounded-full px-4 py-1.5"
                    style={{ backgroundColor: themeColors.infoMuted }}
                    onPress={onApprove}
                  >
                    <Text className="text-[12px] font-semibold" style={{ color: themeColors.info }}>
                      {t.chatToolApprove}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    className="rounded-full px-4 py-1.5"
                    style={{ backgroundColor: themeColors.dangerMuted }}
                    onPress={onReject}
                  >
                    <Text
                      className="text-[12px] font-semibold"
                      style={{ color: themeColors.danger }}
                    >
                      {t.chatToolReject}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {showDetail && isRejected && (
              <Text
                className="mt-2 text-[11px] leading-4"
                style={{ color: themeColors.tertiaryText }}
              >
                {t.chatToolRejectedDesc}
              </Text>
            )}

            {showDetail && isAborted && (
              <Text
                className="mt-2 text-[11px] leading-4"
                style={{ color: themeColors.tertiaryText }}
              >
                {t.chatToolAbortedDesc}
              </Text>
            )}

            {showDetail && argumentsText ? (
              <>
                <Text className="mt-2 text-[10px] font-semibold uppercase tracking-[0.5px] text-foreground/35">
                  {t.chatToolArguments}
                </Text>
                <View style={{ position: 'relative' }}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <Text
                      selectable
                      className="mt-1 rounded-xl px-3 py-2 text-[11px] leading-4 text-foreground/60"
                      style={{
                        backgroundColor: chatAccent.subtleBg,
                        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                      }}
                    >
                      {argumentsText}
                    </Text>
                  </ScrollView>
                  <ToolContentCopyButton text={argumentsText} />
                </View>
              </>
            ) : null}
            {showDetail && truncatedContent ? (
              <>
                <Text className="mt-2 text-[10px] font-semibold uppercase tracking-[0.5px] text-foreground/35">
                  {t.chatToolResponse}
                </Text>
                <View style={{ position: 'relative' }}>
                  <Text
                    selectable
                    className="mt-1 rounded-xl px-3 py-2 text-[12px] leading-5 text-foreground/72"
                    style={{
                      backgroundColor: chatAccent.subtleBg,
                      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                    }}
                  >
                    {truncatedContent}
                  </Text>
                  {content ? <ToolContentCopyButton text={content} /> : null}
                </View>
                {content && content.length > 500 && (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    className="mt-1 self-start"
                    onPress={(e) => {
                      e.stopPropagation();
                      setContentExpanded((v) => !v);
                    }}
                  >
                    <Text className="text-[11px] font-medium" style={{ color: themeColors.info }}>
                      {contentExpanded ? t.chatShowLess : t.chatShowMore}
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            ) : null}
            {showDetail && error ? (
              <Text className="mt-2 text-[11px] leading-4" style={{ color: themeColors.danger }}>
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
  },
);

ToolCard.displayName = 'ToolCard';

const ToolCallsBlock = memo<{ tools: ChatToolPayload[] }>(({ tools }) => {
  const { t } = useI18n();
  const hasPending = tools.some((tool) => tool.intervention?.status === 'pending');
  const allCompleted = tools.every((tool) => tool.result_content || tool.result_msg_id);
  const [expanded, setExpanded] = useState(true);

  return (
    <View
      className="mb-2 rounded-2xl px-3 py-2"
      style={{
        backgroundColor: hasPending ? themeColors.infoSubtle : chatAccent.sectionBg,
      }}
    >
      <TouchableOpacity
        activeOpacity={0.7}
        className="flex-row items-center justify-between"
        onPress={() => setExpanded((value) => !value)}
      >
        <View className="flex-row items-center flex-1">
          <Wrench
            size={14}
            strokeWidth={2}
            color={
              hasPending
                ? themeColors.info
                : allCompleted
                  ? themeColors.iconSuccess
                  : uiColors.textGray
            }
          />
          <Text className="ml-2 text-[12px] font-medium text-foreground/65">
            {t.chatToolsTitle} ({tools.length})
          </Text>
          {hasPending && (
            <View
              className="ml-2 rounded-full px-2 py-0.5"
              style={{ backgroundColor: themeColors.infoMuted }}
            >
              <Text className="text-[9px] font-semibold" style={{ color: themeColors.info }}>
                {t.chatToolPending}
              </Text>
            </View>
          )}
          {allCompleted && !hasPending && (
            <View
              className="ml-2 rounded-full px-2 py-0.5"
              style={{ backgroundColor: themeColors.successMuted }}
            >
              <Text className="text-[9px] font-semibold" style={{ color: themeColors.iconSuccess }}>
                {t.chatToolCompleted || 'Done'}
              </Text>
            </View>
          )}
        </View>
        {expanded ? (
          <ChevronDown color={themeColors.iconMuted} size={14} strokeWidth={2.5} />
        ) : (
          <ChevronRight color={themeColors.iconMuted} size={14} strokeWidth={2.5} />
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

            const hasResult = !!(tool.result_content || tool.result_msg_id);

            return (
              <ToolCard
                collapsible
                argumentsText={argumentsText || undefined}
                content={tool.result_content || undefined}
                key={tool.id}
                resultReady={hasResult}
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
    [t.msgStatUncachedInput, uncached.toLocaleString(), themeColors.tertiaryText],
    [t.msgStatCachedInput, cached.toLocaleString(), uiColors.cachedToken],
    [t.msgStatOutput, output.toLocaleString(), themeColors.iconSuccess],
  ];

  return (
    <Modal
      accessibilityViewIsModal
      transparent
      visible
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        activeOpacity={1}
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: uiColors.modalOverlay }}
        onPress={onClose}
      >
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View
            className="rounded-2xl p-5 mx-8"
            style={{ minWidth: 280, backgroundColor: uiColors.modalDarkBg }}
          >
            {/* Progress bar */}
            <View
              className="h-2 rounded-full overflow-hidden flex-row mb-4"
              style={{ backgroundColor: uiColors.progressBarTrack }}
            >
              {total > 0 && (
                <>
                  <View
                    style={{
                      flex: uncached / total,
                      backgroundColor: themeColors.tertiaryText,
                      borderRadius: 4,
                    }}
                  />
                  <View
                    style={{
                      flex: cached / total,
                      backgroundColor: uiColors.cachedToken,
                      borderRadius: 4,
                    }}
                  />
                  <View
                    style={{
                      flex: output / total,
                      backgroundColor: themeColors.iconSuccess,
                      borderRadius: 4,
                    }}
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
    const [expanded, setExpanded] = useState(thinking ?? false);

    useEffect(() => {
      if (thinking) setExpanded(true);
    }, [thinking]);

    const durationLabel = duration
      ? `${t.chatThoughtWithDuration} ${(duration / 1000).toFixed(1)}s`
      : t.chatThought;

    const showContent = (expanded || thinking) && !!content;

    return (
      <View className="mb-2">
        <TouchableOpacity
          activeOpacity={0.7}
          className="flex-row items-center py-1"
          onPress={() => !thinking && setExpanded((v) => !v)}
        >
          {thinking ? (
            <ActivityIndicator
              color={semanticColors.primary}
              size={12}
              style={{ marginRight: 4 }}
            />
          ) : expanded ? (
            <ChevronDown color={themeColors.iconMuted} size={14} strokeWidth={2.5} />
          ) : (
            <ChevronRight color={themeColors.iconMuted} size={14} strokeWidth={2.5} />
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
            className="mt-1 rounded-2xl px-3 py-2"
            style={{
              backgroundColor: chatAccent.sectionBg,
            }}
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
                rules={codeInlineRules}
                style={markdownStyles}
                onLinkPress={(url) => {
                  Linking.openURL(url).catch(() => undefined);
                  return false;
                }}
              >
                {content}
              </Markdown>
            )}
          </View>
        ) : null}
      </View>
    );
  },
);

ThinkingBlock.displayName = 'ThinkingBlock';

const ErrorBlock = memo<{
  error: { body?: unknown; message: string; type: string };
  onRetry?: () => void;
}>(({ error, onRetry }) => {
  const { t } = useI18n();
  const [showBody, setShowBody] = useState(false);

  const errorBody = error.body
    ? typeof error.body === 'string'
      ? error.body
      : JSON.stringify(error.body, null, 2)
    : null;

  const errorTypeLabel =
    error.type === 'InvalidAPIKey'
      ? 'Invalid API Key'
      : error.type === 'LocationNotSupportError'
        ? 'Region Not Supported'
        : error.type === 'NoOpenAIAPIKey'
          ? 'Missing API Key'
          : error.type || t.errorUnknown;

  return (
    <View
      className="mt-2 rounded-2xl px-3 py-3"
      style={{ backgroundColor: themeColors.dangerMuted }}
    >
      <View className="flex-row items-center mb-1">
        <AlertTriangle color={themeColors.danger} size={14} strokeWidth={2} />
        <Text
          className="ml-1.5 text-[13px] font-semibold flex-1"
          style={{ color: themeColors.danger }}
        >
          {errorTypeLabel}
        </Text>
      </View>
      <Text selectable className="text-[12px] leading-4 text-foreground/60">
        {error.message}
      </Text>
      {errorBody && (
        <>
          <TouchableOpacity
            activeOpacity={0.7}
            className="mt-1.5"
            onPress={() => setShowBody((v) => !v)}
          >
            <Text className="text-[11px] font-medium" style={{ color: themeColors.danger }}>
              {showBody ? t.chatShowLess : t.chatShowMore}
            </Text>
          </TouchableOpacity>
          {showBody && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <Text
                selectable
                className="mt-1 rounded-xl px-3 py-2 text-[11px] leading-4 text-foreground/50"
                style={{
                  backgroundColor: themeColors.dangerSubtle,
                  fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                }}
              >
                {errorBody}
              </Text>
            </ScrollView>
          )}
        </>
      )}
      {onRetry ? (
        <TouchableOpacity
          activeOpacity={0.7}
          className="mt-2 self-start rounded-full px-4 py-1.5"
          style={{ backgroundColor: themeColors.dangerMuted }}
          onPress={onRetry}
        >
          <Text className="text-[12px] font-semibold" style={{ color: themeColors.danger }}>
            {t.retry}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
});

ErrorBlock.displayName = 'ErrorBlock';

export default MessageBubble;
