/**
 * MessageBubble — Renders a single chat message with actions.
 * Includes collapsible Thinking section, model info, token stats, save-to-topic.
 */
import { useNavigation, useRoute } from '@react-navigation/native';
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
  GitBranch,
  Globe,
  Hand,
  Images,
  LibraryBig,
  ListTodo,
  Pause,
  Pencil,
  RefreshCw,
  Share2,
  Trash2,
  Wrench,
  X,
} from 'lucide-react-native';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import Markdown, { openUrl } from 'react-native-markdown-display';
import Animated, { FadeIn } from 'react-native-reanimated';
import { WebView } from 'react-native-webview';

import { getProviderIconUrl } from '../../constants/cdn';
import { AVATO_INBOX_ICON_ASSET, isBuiltinInboxAvatar } from '../../constants/session';
import {
  getMobileBuiltinDisplayName,
  getMobileBuiltinIntervention,
  getMobileBuiltinRender,
  getMobileBuiltinStreaming,
} from '../../features/BuiltinTools';
import { fileApi } from '../../lib/api';
import { haptics } from '../../lib/haptics';
import type { I18nStore } from '../../lib/i18n';
import { useI18n } from '../../lib/i18n';
import { codeInlineRules } from '../../lib/markdownRules';
import { navigateToNotebook, navigateToResources } from '../../lib/navigation';
import { appendCurrentPortalStackWithOrigin } from '../../lib/portalNavigation';
import { useResolvedRemoteAsset } from '../../lib/remoteAsset';
import { isGroupSessionLike } from '../../lib/session';
import type { RootStackNavigationProp } from '../../navigation/types';
import { useChatStore } from '../../store/chat';
import { getAssistantChainActionMessageId } from '../../store/messageDisplay';
import { useThemeStore } from '../../store/theme';
import { getChatAccent, useThemeColors } from '../../theme/colors';
import { tokens } from '../../theme/tokens';
import type {
  ChatFileItem,
  ChatMessage,
  ChatToolPayload,
  CitationItem,
  DocSelection,
  GroundingSearch,
  ImageCitationItem,
  MessageContentPart,
} from '../../types';
import ImageViewer from './ImageViewer';
import { useToast } from './Toast';
import TypingIndicator from './TypingIndicator';

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

const escapeMarkdownLinkLabel = (label: string) =>
  label.replaceAll('[', '\\[').replaceAll(']', '\\]');

const IMAGE_SEARCH_REF_REGEX = /\bimage_(\d+)\.(?:png|jpe?g|gif|webp)\b/gi;
const CONTENT_COLLAPSE_THRESHOLD = 3000;
const ASSISTANT_CONTENT_WIDTH = { maxWidth: '100%' as const, minWidth: 0 };
const USER_CONTENT_WIDTH = {
  alignSelf: 'flex-end' as const,
  flexShrink: 1,
  maxWidth: '82%' as const,
  minWidth: 0,
};

const injectCitationLinks = (content: string | undefined, citations?: CitationItem[] | null) => {
  if (!content || !citations?.length) return content ?? '';

  return content
    .replaceAll(/\[\^(\d+)\^\]/g, (_token, rawIndex) => {
      const citation = citations[Number(rawIndex) - 1];
      if (!citation?.url) return `[${rawIndex}]`;
      return `[^${rawIndex}](${citation.url})`;
    })
    .replaceAll(/\[\^(\d+)\]/g, (_token, rawIndex) => {
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

const injectImageSearchRefLinks = (
  content: string | undefined,
  imageResults?: ImageCitationItem[] | null,
): string | undefined => {
  if (!content || !imageResults?.length) return content;
  IMAGE_SEARCH_REF_REGEX.lastIndex = 0;
  if (!IMAGE_SEARCH_REF_REGEX.test(content)) return content;
  IMAGE_SEARCH_REF_REGEX.lastIndex = 0;
  return content.replace(IMAGE_SEARCH_REF_REGEX, (match, indexStr) => {
    const idx = Number.parseInt(indexStr, 10);
    const item = imageResults[idx];
    const url = item?.imageUri || item?.sourceUri;
    if (!url) return match;
    return `[${match}](${url})`;
  });
};

const applyAssistantSearchInlineMarkdown = (
  content: string | undefined,
  citations?: CitationItem[] | null,
  imageResults?: ImageCitationItem[] | null,
) => injectCitationLinks(injectImageSearchRefLinks(content, imageResults), citations);

const CodeCopyButton = memo<{ code: string }>(({ code }) => {
  const colors = useThemeColors();
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
        <Check color={colors.iconSuccess} size={14} strokeWidth={2} />
      ) : (
        <Copy color={colors.iconMuted} size={14} strokeWidth={2} />
      )}
    </TouchableOpacity>
  );
});

CodeCopyButton.displayName = 'CodeCopyButton';

const MermaidBlock = memo<{ code: string }>(({ code }) => {
  const colors = useThemeColors();
  const effectiveTheme = useThemeStore((s) => s.effectiveTheme);
  const [height, setHeight] = useState(200);
  const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
<style>:root{color-scheme:${effectiveTheme === 'dark' ? 'dark' : 'light'}}
body{margin:0;padding:8px;background:transparent;color:${colors.foreground};display:flex;justify-content:center}
.mermaid{font-size:13px}</style></head><body>
<div class="mermaid">${code.replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</div>
<script>mermaid.initialize({startOnLoad:true,theme:'${effectiveTheme === 'dark' ? 'dark' : 'neutral'}'});
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
  const colors = useThemeColors();
  const effectiveTheme = useThemeStore((s) => s.effectiveTheme);
  const [height, setHeight] = useState(display ? 60 : 22);
  const escaped = math
    .replaceAll('\\', '\\\\')
    .replaceAll('`', '\\`')
    .replaceAll('</script', '<\\/script');
  const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
<style>:root{color-scheme:${effectiveTheme === 'dark' ? 'dark' : 'light'}}
body{margin:0;padding:${display ? '8px' : '0 2px'};background:transparent;color:${colors.foreground};${display ? 'display:flex;justify-content:center' : 'display:inline'}}
.katex{color:${colors.foreground}}</style></head><body>
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
  disableToolActions?: boolean;
  generating?: boolean;
  groupMembersById?: Record<string, GroupMessageSpeaker>;
  groupSupervisorId?: string;
  isGroupSession?: boolean;
  isReasoning?: boolean;
  message: ChatMessage;
  onSaveToTopic?: () => void;
  readOnly?: boolean;
  sessionId: string;
  toolActionHandlers?: ToolActionHandlers;
  topicId?: string | null;
}

interface ToolActionHandlers {
  continueToolIntervention?: (
    assistantMessageId: string,
    approvedTool: ChatToolPayload,
  ) => Promise<void>;
  rejectAndContinueToolIntervention?: (assistantMessageId: string, toolId: string) => Promise<void>;
  rejectToolCall?: (messageId: string, toolId: string, reason?: string) => void | Promise<void>;
  rejectToolMessage?: (messageId: string, reason?: string) => void | Promise<void>;
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

/** Escape [ ] for markdown link label */
const escapeMentionLabel = (s: string) => s.replaceAll('[', '\\[').replaceAll(']', '\\]');

/** Replace <mention name="X" id="Y" /> with [@X](mention:Y) for styled display in group chat */
function preprocessMentionDisplay(content: string, allMembersLabel: string): string {
  return content
    .replaceAll(
      /<mention\s[^>]*id="ALL_MEMBERS"[^>]*\/>/g,
      `[${escapeMentionLabel(`@${allMembersLabel}`)}](mention:ALL_MEMBERS) `,
    )
    .replaceAll(
      /<mention\s[^>]*name="([^"]*)"[^>]*id="([^"]*)"[^>]*\/>/g,
      (_, name, id) => `[${escapeMentionLabel(`@${name || id}`)}](mention:${id}) `,
    );
}

const getAssistantChainText = (messages: ChatMessage[]) =>
  messages
    .map((message) => message.content?.trim())
    .filter((content): content is string => !!content)
    .join('\n\n');

const isPersistedMessageId = (id?: string | null) => {
  const normalizedId = id?.trim() ?? '';
  if (!normalizedId) return false;

  return (
    !normalizedId.startsWith('assistant-') &&
    !normalizedId.startsWith('local-') &&
    !normalizedId.startsWith('tmp_') &&
    !normalizedId.startsWith('user-')
  );
};

const getMessageDocSelections = (message: ChatMessage): DocSelection[] => {
  const rawSelections = message.metadata?.docSelections;
  if (!Array.isArray(rawSelections)) return [];

  return rawSelections.filter(
    (selection): selection is DocSelection =>
      !!selection &&
      typeof selection === 'object' &&
      typeof (selection as DocSelection).docId === 'string' &&
      typeof (selection as DocSelection).id === 'string' &&
      typeof (selection as DocSelection).content === 'string',
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

const prepareMessageRenderContent = (
  message: ChatMessage,
  allMembersLabel: string,
): {
  artifactSegments: ArtifactSegment[] | null;
  hasSearch: boolean;
  multimodalContentParts: MessageContentPart[] | null;
  multimodalReasoningParts: MessageContentPart[] | null;
  renderedReasoning: string | undefined;
  textContent: string;
} => {
  const hasSearch =
    !!message.search &&
    !!(message.search.citations?.length || message.search.imageResults?.length);
  const multimodalContentParts = message.metadata?.isMultimodal
    ? parseMessageContentParts(message.metadata?.tempDisplayContent)
    : null;
  const multimodalReasoningParts = message.reasoning?.isMultimodal
    ? parseMessageContentParts(message.reasoning?.tempDisplayContent || message.reasoning?.content)
    : null;
  const renderedReasoning = applyAssistantSearchInlineMarkdown(
    message.reasoning?.content,
    message.search?.citations,
    message.search?.imageResults,
  );
  const fullContent = preprocessMentionDisplay(
    preprocessMathBlocks(
      applyAssistantSearchInlineMarkdown(
        message.content,
        message.search?.citations,
        message.search?.imageResults,
      ),
    ),
    allMembersLabel,
  );
  const hasArtifacts = ARTIFACT_TAG_REGEX.test(fullContent);
  ARTIFACT_TAG_REGEX.lastIndex = 0;

  return {
    artifactSegments: hasArtifacts ? splitArtifacts(fullContent) : null,
    hasSearch,
    multimodalContentParts,
    multimodalReasoningParts,
    renderedReasoning,
    textContent: hasArtifacts ? fullContent.replace(ARTIFACT_TAG_REGEX, '') : fullContent,
  };
};

const ArtifactBlock = memo<{
  artifactType?: string;
  content: string;
  language?: string;
  title?: string;
}>(({ title, artifactType, content, language: _language }) => {
  const colors = useThemeColors();
  const effectiveTheme = useThemeStore((s) => s.effectiveTheme);
  const [height, setHeight] = useState(300);
  const [expanded, setExpanded] = useState(false);

  const isSvg = artifactType === 'image/svg+xml';
  const isMermaid = artifactType === 'application/lobe.artifacts.mermaid';
  const isHtml = !artifactType || artifactType === 'text/html' || artifactType.includes('html');
  const isCode = artifactType === 'application/lobe.artifacts.code';
  const isMarkdownArtifact = artifactType === 'text/markdown';
  const artifactThemeScript = useMemo(
    () =>
      `(function(){var style=document.createElement('style');style.innerHTML=${JSON.stringify(
        `:root{color-scheme:${effectiveTheme === 'dark' ? 'dark' : 'light'}}html,body{background:${colors.surface};color:${colors.foreground};font-family:-apple-system,system-ui,sans-serif;}a{color:${colors.primary};}`,
      )};document.head&&document.head.appendChild(style);})();true;`,
    [colors.foreground, colors.primary, colors.surface, effectiveTheme],
  );

  if (isMermaid) {
    return (
      <View style={{ marginVertical: 6 }}>
        {title ? (
          <Text
            style={{
              color: colors.muted,
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
<style>:root{color-scheme:${effectiveTheme === 'dark' ? 'dark' : 'light'}}
body{margin:0;padding:8px;background:${colors.surface};color:${colors.foreground};display:flex;justify-content:center;align-items:center}
svg{max-width:100%;height:auto}</style></head><body>${content}</body></html>`
    : isHtml
      ? content.includes('<html')
        ? content
        : `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>:root{color-scheme:${effectiveTheme === 'dark' ? 'dark' : 'light'}}
body{margin:0;padding:8px;background:${colors.surface};color:${colors.foreground};font-family:-apple-system,system-ui,sans-serif;font-size:14px}
a{color:${colors.primary}}</style></head><body>${content}</body></html>`
      : null;

  if (!htmlContent) return null;

  return (
    <View
      style={{
        backgroundColor: colors.fillQuaternary,
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
            backgroundColor: colors.fillTertiary,
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
          onPress={() => setExpanded((v) => !v)}
        >
          <Text
            numberOfLines={1}
            style={{ color: colors.textDark, fontSize: 13, fontWeight: '600' }}
          >
            {title}
          </Text>
          {expanded ? (
            <ChevronDown color={colors.iconMuted} size={14} />
          ) : (
            <ChevronRight color={colors.iconMuted} size={14} />
          )}
        </TouchableOpacity>
      ) : null}
      {(!title || expanded) && (
        <WebView
          javaScriptEnabled
          injectedJavaScriptBeforeContentLoaded={artifactThemeScript}
          originWhitelist={['*']}
          scrollEnabled={false}
          source={{ html: htmlContent }}
          style={{ backgroundColor: colors.surface, height, width: '100%' }}
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
    const colors = useThemeColors();
    const effectiveTheme = useThemeStore((s) => s.effectiveTheme);
    const avatoLogoTint = effectiveTheme === 'dark' ? colors.foreground : undefined;
    const avatar = speaker?.avatar?.trim();
    const resolvedAvatarUri = useResolvedRemoteAsset(avatar);
    const isInboxAvatar = isBuiltinInboxAvatar(avatar);

    if (isInboxAvatar) {
      return (
        <View
          className="h-7 w-7 items-center justify-center overflow-hidden rounded-full"
          style={{ backgroundColor: colors.primarySubtle }}
        >
          <RNImage
            source={AVATO_INBOX_ICON_ASSET}
            style={{
              height: 28,
              width: 28,
              ...(avatoLogoTint ? { tintColor: avatoLogoTint } : {}),
            }}
          />
        </View>
      );
    }

    if (avatar && avatar.length <= 4 && !resolvedAvatarUri) {
      return (
        <View
          className="h-7 w-7 items-center justify-center rounded-full"
          style={{ backgroundColor: colors.primarySubtle }}
        >
          <Text className="text-[14px] font-semibold" style={{ color: colors.primary }}>
            {avatar}
          </Text>
        </View>
      );
    }

    if (resolvedAvatarUri) {
      return (
        <View
          className="h-7 w-7 items-center justify-center overflow-hidden rounded-full"
          style={{ backgroundColor: colors.primarySubtle }}
        >
          <RNImage
            source={{ uri: resolvedAvatarUri }}
            style={{
              height: 28,
              width: 28,
            }}
          />
        </View>
      );
    }

    return (
      <View
        className="h-7 w-7 items-center justify-center rounded-full"
        style={{ backgroundColor: colors.primarySubtle }}
      >
        <Text className="text-[12px] font-semibold" style={{ color: colors.primary }}>
          {fallbackLabel}
        </Text>
      </View>
    );
  },
);

GroupSpeakerAvatar.displayName = 'GroupSpeakerAvatar';

const CompareGroupMessageItem = memo<{
  childMessage: ChatMessage;
  groupMembersById?: Record<string, GroupMessageSpeaker>;
  groupSupervisorId?: string;
  markdownRules?: Record<string, any>;
  markdownStyles: Record<string, unknown>;
  onOpenLink: (url?: string) => void;
  t: I18nStore['t'];
}>(
  ({
    childMessage,
    groupMembersById,
    groupSupervisorId,
    markdownRules,
    markdownStyles,
    onOpenLink,
    t,
  }) => {
    const colors = useThemeColors();
    const { childContent, fallbackLabel, speaker, speakerName } = useMemo(() => {
      const speakerId = childMessage.agentId || groupSupervisorId;
      const nextSpeaker =
        speakerId != null && groupMembersById ? groupMembersById[speakerId] : undefined;
      const nextIsSupervisor = Boolean(
        nextSpeaker?.isSupervisor || (speakerId && speakerId === groupSupervisorId),
      );
      const nextSpeakerName =
        nextSpeaker?.title || (nextIsSupervisor ? t.groupSettingsSupervisor : t.settingsDefaultAgent);

      return {
        childContent: prepareMessageRenderContent(childMessage, t.groupMentionAllMembers).textContent,
        fallbackLabel: (nextSpeakerName || t.settingsDefaultAgent).slice(0, 1).toUpperCase(),
        isSupervisor: nextIsSupervisor,
        speaker: nextSpeaker,
        speakerName: nextSpeakerName,
      };
    }, [
      childMessage,
      groupMembersById,
      groupSupervisorId,
      t.groupMentionAllMembers,
      t.groupSettingsSupervisor,
      t.settingsDefaultAgent,
    ]);

    return (
      <View className="rounded-2xl border border-foreground/[0.06] bg-foreground/[0.02] px-3 py-2.5">
        <View className="mb-2 flex-row items-center">
          <GroupSpeakerAvatar fallbackLabel={fallbackLabel} speaker={speaker} />
          <View className="ml-2 min-w-0 flex-1">
            <Text
              className="text-[12px] font-semibold"
              numberOfLines={1}
              style={{ color: colors.foreground }}
            >
              {speakerName}
            </Text>
            {childMessage.model ? (
              <Text
                className="text-[11px]"
                numberOfLines={1}
                style={{ color: colors.foreground }}
              >
                {childMessage.model}
              </Text>
            ) : null}
          </View>
          {childMessage.createdAt ? (
            <Text className="ml-2 text-[10px]" style={{ color: colors.tertiaryText }}>
              {getTimeAgo(childMessage.createdAt)}
            </Text>
          ) : null}
        </View>

        {childContent ? (
          <Markdown
            rules={markdownRules ?? codeInlineRules}
            style={markdownStyles as any}
            onLinkPress={(url) => {
              onOpenLink(url);
              return false;
            }}
          >
            {childContent}
          </Markdown>
        ) : childMessage.reasoning?.content ? (
          <Text className="text-[14px] leading-6 text-foreground/60">
            {childMessage.reasoning.content}
          </Text>
        ) : (
          <TypingIndicator color={colors.typingIndicator} />
        )}
      </View>
    );
  },
);

CompareGroupMessageItem.displayName = 'CompareGroupMessageItem';

const CompareGroupBlock = memo<{
  childrenMessages: ChatMessage[];
  groupMembersById?: Record<string, GroupMessageSpeaker>;
  groupSupervisorId?: string;
  markdownRules?: Record<string, any>;
  markdownStyles: Record<string, unknown>;
  onOpenLink: (url?: string) => void;
  t: I18nStore['t'];
}>(
  ({
    childrenMessages,
    groupMembersById,
    groupSupervisorId,
    markdownRules,
    markdownStyles,
    onOpenLink,
    t,
  }) => {
    return (
      <View className="gap-2">
        {childrenMessages.map((child) => (
          <CompareGroupMessageItem
            childMessage={child}
            groupMembersById={groupMembersById}
            groupSupervisorId={groupSupervisorId}
            key={child.id}
            markdownRules={markdownRules}
            markdownStyles={markdownStyles}
            t={t}
            onOpenLink={onOpenLink}
          />
        ))}
      </View>
    );
  },
);

CompareGroupBlock.displayName = 'CompareGroupBlock';

const ThreadJumpButton = memo<{ label: string; onPress: () => void }>(({ label, onPress }) => {
  const colors = useThemeColors();

  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.75}
      className="mt-2 self-start rounded-full px-2.5 py-1.5"
      style={{ backgroundColor: colors.primarySubtle }}
      onPress={onPress}
    >
      <View className="flex-row items-center gap-1.5">
        <GitBranch color={colors.primary} size={12} strokeWidth={2} />
        <Text className="text-[11px] font-semibold" style={{ color: colors.primary }}>
          {label}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

ThreadJumpButton.displayName = 'ThreadJumpButton';

const GroupTasksBlock = memo<{
  groupMembersById?: Record<string, GroupMessageSpeaker>;
  message: ChatMessage;
  onOpenThread?: (threadId: string, title?: string) => void;
  t: I18nStore['t'];
}>(({ groupMembersById, message, onOpenThread, t }) => {
  const colors = useThemeColors();
  const tasks = message.tasks ?? [];
  const taskAgentIds = [
    ...new Set(tasks.map((task) => task.agentId).filter((id): id is string => id != null)),
  ];
  const agentNames = taskAgentIds
    .map((id) => groupMembersById?.[id]?.title ?? id)
    .filter(Boolean)
    .slice(0, 2);
  const totalAgents = taskAgentIds.length;
  const title =
    totalAgents <= 2
      ? t.taskGroupTasksTitleSimple
          .replace('{{agents}}', agentNames.join(' / '))
          .replace('{{count}}', String(tasks.length))
      : t.taskGroupTasksTitle
          .replace('{{agents}}', agentNames.join(' / '))
          .replace('{{count}}', String(totalAgents))
          .replace('{{taskCount}}', String(tasks.length));
  const tagLabel = t.taskGroupTasks.replace('{{count}}', String(tasks.length));

  return (
    <View className="gap-2">
      <View className="flex-row items-center gap-2 mb-1">
        <View className="rounded-full p-1.5" style={{ backgroundColor: colors.primarySubtle }}>
          <ListTodo color={colors.primary} size={14} strokeWidth={2} />
        </View>
        <Text className="text-[13px] font-medium text-foreground flex-1" numberOfLines={1}>
          {title}
        </Text>
        <View
          className="rounded-full px-2 py-0.5"
          style={{ backgroundColor: colors.primary + '15' }}
        >
          <Text className="text-[11px] font-medium" style={{ color: colors.primary }}>
            {tagLabel}
          </Text>
        </View>
      </View>
      <View className="gap-2">
        {tasks.map((task) => {
          const agentName = task.agentId
            ? (groupMembersById?.[task.agentId]?.title ?? task.agentId)
            : '';
          const taskTitle = String(
            (task.metadata as Record<string, unknown>)?.taskTitle ??
              task.taskDetail?.title ??
              task.content?.slice(0, 60) ??
              t.chatToolRunning ??
              '',
          );
          const threadId = task.taskDetail?.threadId?.trim() || undefined;
          const status = task.taskDetail?.status;
          const isDone = status === 'completed' || status === 'Completed';
          const isError =
            status === 'failed' ||
            status === 'Failed' ||
            status === 'cancel' ||
            status === 'Cancel';

          return (
            <View
              className="rounded-xl px-3 py-2.5"
              key={task.id}
              style={{
                backgroundColor: colors.overlay,
                borderColor: colors.primaryBorder,
                borderWidth: 0.5,
              }}
            >
              <View className="flex-row items-center gap-2">
                {agentName ? (
                  <Text className="text-[11px] font-medium text-foreground/60" numberOfLines={1}>
                    {agentName}
                  </Text>
                ) : null}
                <Text className="text-[13px] font-medium text-foreground flex-1" numberOfLines={2}>
                  {taskTitle}
                </Text>
                {isDone ? (
                  <Check color={colors.success} size={14} strokeWidth={2.5} />
                ) : isError ? (
                  <X color={colors.danger} size={14} strokeWidth={2.5} />
                ) : null}
              </View>
              {threadId && onOpenThread ? (
                <ThreadJumpButton
                  label={t.threadOpen}
                  onPress={() => onOpenThread(threadId, taskTitle)}
                />
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
});
GroupTasksBlock.displayName = 'GroupTasksBlock';

const MessageBubble = memo<MessageBubbleProps>(
  ({
    disableToolActions = false,
    message,
    sessionId,
    topicId,
    generating,
    groupMembersById,
    groupSupervisorId,
    isGroupSession = false,
    isReasoning = false,
    onSaveToTopic,
    readOnly = false,
    toolActionHandlers,
  }) => {
    const navigation = useNavigation<RootStackNavigationProp>();
    const route = useRoute();
    const isUser = message.role === 'user';
    const isToolMessage = message.role === 'tool';
    const { t } = useI18n();
    const toast = useToast();
    const colors = useThemeColors();
    const effectiveTheme = useThemeStore((s) => s.effectiveTheme);
    const avatoLogoTint = effectiveTheme === 'dark' ? colors.foreground : undefined;
    const chatAccent = useMemo(() => getChatAccent(colors), [colors]);

    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(message.content);
    const [showImageViewer, setShowImageViewer] = useState(false);
    const [showStats, setShowStats] = useState(false);
    const [viewerUri, setViewerUri] = useState<string | null>(null);
    const [contentCollapsed, setContentCollapsed] = useState(true);
    const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);
    const [downloadingProgress, setDownloadingProgress] = useState(0);
    const [readOnlyGroupExpanded, setReadOnlyGroupExpanded] = useState(false);
    const actionMessageId = isUser ? message.id : getAssistantChainActionMessageId(message);
    const assistantChainChildren =
      message.role === 'assistant' && message.children?.length ? message.children : null;
    const messageCopyText = useMemo(
      () =>
        assistantChainChildren?.length ? getAssistantChainText(assistantChainChildren) : message.content,
      [assistantChainChildren, message.content],
    );

    const dismissActions = useCallback(() => {}, []);

    const handleCopy = useCallback(async () => {
      await Clipboard.setStringAsync(messageCopyText);
      haptics.success();
      toast.show('success', t.toastCopied);
      dismissActions();
    }, [messageCopyText, t, toast, dismissActions]);

    const handleEdit = useCallback(() => {
      haptics.light();
      setIsEditing(true);
      setEditText(message.content);
    }, [message.content]);

    const handleEditSubmit = useCallback(() => {
      if (editText.trim() && editText !== message.content) {
        void useChatStore.getState().editMessage(sessionId, actionMessageId, editText.trim());
        haptics.success();
      }
      setIsEditing(false);
    }, [actionMessageId, editText, message.content, sessionId]);

    const handleRegenerate = useCallback(() => {
      haptics.light();
      void useChatStore.getState().regenerateMessage(sessionId, actionMessageId);
    }, [actionMessageId, sessionId]);

    const handleShare = useCallback(async () => {
      haptics.light();
      dismissActions();
      try {
        const shareText = messageCopyText || message.reasoning?.content || '';
        await Share.share({ message: shareText });
      } catch {
        // user cancelled
      }
    }, [messageCopyText, message.reasoning?.content, dismissActions]);

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
            void useChatStore.getState().deleteMessage(sessionId, actionMessageId);
          },
        },
      ]);
    }, [actionMessageId, dismissActions, sessionId, t]);

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
        setDownloadingProgress(0);
        try {
          await fileApi.download(file, {
            onProgress: (p) => setDownloadingProgress(p),
          });
          haptics.success();
          toast.show('success', t.resourceDownloaded);
        } catch {
          toast.show('error', t.resourceDownloadFailed);
        } finally {
          setDownloadingFileId(null);
          setDownloadingProgress(0);
        }
      },
      [downloadingFileId, t, toast],
    );

    const handleOpenResourceFile = useCallback(
      (file: ChatFileItem) => {
        haptics.light();
        navigateToResources(
          appendCurrentPortalStackWithOrigin(
            route.name,
            route.params,
            {
              openItem: {
                ...(file.content ? { content: file.content } : {}),
                fileType: file.fileType,
                id: file.id,
                name: file.name,
                sourceType: 'file' as const,
                url: file.url,
              },
            },
            {
              sessionId,
              ...(message.threadId ? { threadId: message.threadId } : {}),
              ...(topicId ? { topicId } : {}),
            },
          ),
        );
      },
      [message.threadId, route.name, route.params, sessionId, topicId],
    );

    const mc = useMemo(
      () => ({
        text: colors.markdownText,
        heading: colors.markdownHeading,
        codeInlineBg: colors.markdownCodeInlineBg,
        codeInlineColor: colors.markdownCodeInlineColor,
        codeBlockBg: colors.markdownCodeBlockBg,
        codeBlockBorder: colors.border,
        link: colors.markdownLink,
      }),
      [colors],
    );

    const reasoningMarkdownStyles = useMemo<Record<string, any>>(
      () => ({
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
        link: { color: mc.link + '99' },
        paragraph: { marginBottom: 2, marginTop: 2 },
        text: { color: mc.text + '99' },
        textgroup: { color: mc.text + '99' },
      }),
      [mc.codeInlineBg, mc.codeInlineColor, mc.link, mc.text],
    );

    const tableStyles = useMemo<Record<string, any>>(
      () => ({
        tableWrapper: { marginVertical: 8 },
        table: {
          borderColor: colors.borderSubtle,
          borderRadius: 8,
          borderWidth: 0.5,
          overflow: 'hidden' as const,
        },
        thead: { backgroundColor: colors.fillTertiary },
        th: {
          borderColor: colors.borderSubtle,
          borderWidth: 0.5,
          color: mc.heading,
          flex: 1,
          fontSize: 13,
          fontWeight: '600' as const,
          padding: 8,
        },
        tr: { borderBottomWidth: 0.5, borderColor: colors.borderSubtle },
        td: {
          borderColor: colors.borderSubtle,
          borderWidth: 0.5,
          color: mc.text,
          flex: 1,
          fontSize: 13,
          lineHeight: 18,
          padding: 8,
        },
      }),
      [colors.borderSubtle, colors.fillTertiary, mc.heading, mc.text],
    );

    const markdownStyles = useMemo<Record<string, any>>(
      () => ({
        body: { color: mc.text, fontSize: 15, lineHeight: 22 },
        text: { color: mc.text },
        textgroup: { color: mc.text },
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
        hr: { backgroundColor: colors.divider, height: 1, marginVertical: 12 },
        ...tableStyles,
        mention: {
          backgroundColor: chatAccent.subtleBg,
          borderRadius: 6,
          color: chatAccent.badgeText,
          fontWeight: '600' as const,
          paddingHorizontal: 6,
          paddingVertical: 2,
        },
      }),
      [
        chatAccent.badgeText,
        chatAccent.quoteBorder,
        chatAccent.subtleBg,
        colors.divider,
        mc.codeBlockBg,
        mc.codeBlockBorder,
        mc.codeInlineBg,
        mc.codeInlineColor,
        mc.heading,
        mc.link,
        mc.text,
        tableStyles,
      ],
    );

    const userMarkdownStyles = useMemo<Record<string, any>>(
      () => ({
        ...markdownStyles,
        text: { color: colors.userBubbleText },
        textgroup: { color: colors.userBubbleText },
        body: {
          ...markdownStyles.body,
          color: colors.userBubbleText,
          flexShrink: 1,
          fontSize: 15,
          lineHeight: 20,
        },
        paragraph: { marginBottom: 2, marginTop: 2 },
        blockquote: {
          ...markdownStyles.blockquote,
          borderLeftColor: colors.userBubbleTextMuted,
        },
        blockquote_content: {
          ...markdownStyles.blockquote_content,
          color: colors.userBubbleText,
        },
        code_inline: {
          ...markdownStyles.code_inline,
          backgroundColor: colors.userBubbleCodeBg,
          color: colors.userBubbleText,
        },
        fence: {
          ...markdownStyles.fence,
          backgroundColor: colors.userBubbleTableBg,
          borderColor: colors.userBubbleTableBorder,
        },
        code_block: {
          ...markdownStyles.code_block,
          backgroundColor: colors.userBubbleTableBg,
          color: colors.userBubbleText,
        },
        link: { color: colors.userBubbleLink },
        heading1: { ...markdownStyles.heading1, color: colors.userBubbleText },
        heading2: { ...markdownStyles.heading2, color: colors.userBubbleText },
        heading3: { ...markdownStyles.heading3, color: colors.userBubbleText },
        hr: { ...markdownStyles.hr, backgroundColor: colors.userBubbleHr },
        table: { ...tableStyles.table, borderColor: colors.userBubbleTableBorder },
        thead: { backgroundColor: colors.userBubbleTableBorder },
        th: {
          ...tableStyles.th,
          borderColor: colors.userBubbleHr,
          color: colors.userBubbleText,
        },
        tr: { ...tableStyles.tr, borderColor: colors.userBubbleTableBg },
        td: {
          ...tableStyles.td,
          borderColor: colors.userBubbleTableBorder,
          color: colors.userBubbleText,
        },
        mention: {
          backgroundColor: colors.userBubbleSubtleBg,
          borderRadius: 6,
          color: colors.userBubbleText,
          fontWeight: '600' as const,
          paddingHorizontal: 6,
          paddingVertical: 2,
        },
      }),
      [
        colors.userBubbleCodeBg,
        colors.userBubbleHr,
        colors.userBubbleLink,
        colors.userBubbleSubtleBg,
        colors.userBubbleTableBg,
        colors.userBubbleTableBorder,
        colors.userBubbleText,
        colors.userBubbleTextMuted,
        markdownStyles,
        tableStyles.table,
        tableStyles.td,
        tableStyles.th,
        tableStyles.tr,
      ],
    );

    const markdownRules = useMemo(
      () => ({
        ...codeInlineRules,
        link: (
          node: { key?: string; attributes?: { href?: string }; children?: { content?: string }[] },
          children: React.ReactNode,
          _parent: unknown,
          styles: Record<string, any>,
          onLinkPress?: (url: string) => boolean | void,
        ) => {
          const href = node.attributes?.href || '';
          if (href.startsWith('mention:')) {
            const label = node.children?.[0]?.content ?? '@';
            return (
              <Text key={node.key} style={styles.mention ?? {}}>
                {label}
              </Text>
            );
          }
          return (
            <Text
              key={node.key}
              style={styles.link}
              onPress={() => {
                if (onLinkPress?.(href) === false) return;
                openUrl(href);
              }}
            >
              {children}
            </Text>
          );
        },
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
                  <Text
                    selectable
                    style={{
                      color: mc.text,
                      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                      fontSize: 13,
                      lineHeight: 20,
                    }}
                  >
                    {code.replace(/\n$/, '')}
                  </Text>
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
      }),
      [mc.text],
    );

    const totalTokens = message.usage?.totalTokens ?? 0;
    const hasStats = !isUser && !isToolMessage && totalTokens > 0;
    const hasAttachments =
      (message.imageList?.length ?? 0) > 0 || (message.fileList?.length ?? 0) > 0;
    const hasSearch =
      !isUser &&
      !!message.search &&
      !!(message.search.citations?.length || message.search.imageResults?.length);
    const hasTools = !isUser && (message.tools?.length ?? 0) > 0;
    const {
      artifactSegments,
      compareGroupChildren,
      compressedGroupMessages,
      contentWithoutArtifacts,
      docSelections,
      groupSpeaker,
      groupSpeakerFallbackLabel,
      groupSpeakerName,
      groupTasksMessages,
      isSupervisorSpeaker,
      messageThreadId,
      messageThreadTitle,
      multimodalContentParts,
      multimodalReasoningParts,
      renderedReasoning,
      seededThreadTitle,
      shouldShowGroupSpeaker,
    } = useMemo(() => {
      const nextShouldShowGroupSpeaker =
        isGroupSession &&
        !isUser &&
        !isToolMessage &&
        message.role !== 'compareGroup' &&
        message.role !== 'compressedGroup' &&
        message.role !== 'groupTasks';
      const groupSpeakerId = nextShouldShowGroupSpeaker
        ? message.agentId || groupSupervisorId
        : undefined;
      const nextGroupSpeaker = groupSpeakerId ? groupMembersById?.[groupSpeakerId] : undefined;
      const nextIsSupervisorSpeaker = Boolean(
        nextGroupSpeaker?.isSupervisor || (groupSpeakerId && groupSpeakerId === groupSupervisorId),
      );
      const nextGroupSpeakerName =
        nextGroupSpeaker?.title ||
        (nextIsSupervisorSpeaker ? t.groupSettingsSupervisor : undefined);
      const fullContent = preprocessMentionDisplay(
        preprocessMathBlocks(
          applyAssistantSearchInlineMarkdown(
            message.content,
            message.search?.citations,
            message.search?.imageResults,
          ),
        ),
        t.groupMentionAllMembers,
      );
      const hasArtifacts = !isUser && ARTIFACT_TAG_REGEX.test(fullContent);
      ARTIFACT_TAG_REGEX.lastIndex = 0;

      return {
        artifactSegments: hasArtifacts ? splitArtifacts(fullContent) : null,
        compareGroupChildren:
          message.role === 'compareGroup' && message.children?.length ? message.children : null,
        compressedGroupMessages:
          message.role === 'compressedGroup' && message.compressedMessages?.length
            ? message.compressedMessages
            : null,
        contentWithoutArtifacts: hasArtifacts ? fullContent.replace(ARTIFACT_TAG_REGEX, '') : fullContent,
        docSelections: isUser ? getMessageDocSelections(message) : [],
        groupSpeaker: nextGroupSpeaker,
        groupSpeakerFallbackLabel: (nextGroupSpeakerName || t.settingsDefaultAgent)
          .slice(0, 1)
          .toUpperCase(),
        groupSpeakerName: nextGroupSpeakerName,
        groupTasksMessages:
          message.role === 'groupTasks' && message.tasks?.length ? message.tasks : null,
        isSupervisorSpeaker: nextIsSupervisorSpeaker,
        messageThreadId: message.taskDetail?.threadId?.trim() || undefined,
        messageThreadTitle: String(
          (message.metadata as Record<string, unknown>)?.taskTitle ??
            message.taskDetail?.title ??
            '',
        ).trim(),
        multimodalContentParts:
          !isToolMessage && message.metadata?.isMultimodal
            ? parseMessageContentParts(message.metadata?.tempDisplayContent)
            : null,
        multimodalReasoningParts: message.reasoning?.isMultimodal
          ? parseMessageContentParts(
              message.reasoning?.tempDisplayContent || message.reasoning?.content,
            )
          : null,
        renderedReasoning: applyAssistantSearchInlineMarkdown(
          message.reasoning?.content,
          message.search?.citations,
          message.search?.imageResults,
        ),
        seededThreadTitle:
          String(
            (message.metadata as Record<string, unknown>)?.taskTitle ??
              message.taskDetail?.title ??
              '',
          ).trim() ||
          message.content.trim().split('\n')[0]?.trim().slice(0, 60) ||
          undefined,
        shouldShowGroupSpeaker: nextShouldShowGroupSpeaker,
      };
    }, [
      groupMembersById,
      groupSupervisorId,
      isGroupSession,
      isToolMessage,
      isUser,
      message,
      t.groupMentionAllMembers,
      t.groupSettingsSupervisor,
      t.settingsDefaultAgent,
    ]);
    const isLongContent = !isUser && contentWithoutArtifacts.length > CONTENT_COLLAPSE_THRESHOLD;
    const renderedContent =
      isLongContent && contentCollapsed
        ? contentWithoutArtifacts.slice(0, CONTENT_COLLAPSE_THRESHOLD)
        : contentWithoutArtifacts;
    const hasTextContent = !!(renderedContent?.trim() || multimodalContentParts?.length);
    const showStandaloneUserAttachments = isUser && hasAttachments && !hasTextContent;
    const canStartThread =
      !!topicId &&
      isPersistedMessageId(actionMessageId) &&
      !isGroupSessionLike(sessionId) &&
      route.name !== 'ThreadDetail' &&
      (message.role === 'assistant' || message.role === 'user');
    const isCompressedGroupExpanded =
      message.role === 'compressedGroup' &&
      (readOnly
        ? readOnlyGroupExpanded
        : (message.metadata as Record<string, unknown>)?.expanded === true);
    const showMessageBubble =
      !showStandaloneUserAttachments ||
      !!assistantChainChildren?.length ||
      !!renderedContent ||
      !!compareGroupChildren?.length ||
      !!compressedGroupMessages?.length ||
      !!groupTasksMessages?.length ||
      !!multimodalContentParts?.length ||
      isToolMessage ||
      !!message.error ||
      message.role === 'compressedGroup' ||
      message.role === 'groupTasks';

    const handleOpenThread = useCallback(
      (threadId: string, title?: string) => {
        const normalizedThreadId = threadId.trim();
        if (!normalizedThreadId) return;

        haptics.light();
        navigation.navigate(
          'ThreadDetail',
          appendCurrentPortalStackWithOrigin(
            route.name,
            route.params,
            {
              sessionId,
              ...(title?.trim() ? { title: title.trim() } : {}),
              threadId: normalizedThreadId,
            },
            {
              ...(topicId ? { topicId } : {}),
            },
          ),
        );
      },
      [navigation, route.name, route.params, sessionId, topicId],
    );

    const handleStartThread = useCallback(
      (type: 'continuation' | 'standalone') => {
        const sourceMessageId = actionMessageId?.trim();
        const normalizedTopicId = topicId?.trim();
        if (!sourceMessageId || !normalizedTopicId) return;

        haptics.success();
        navigation.navigate(
          'ThreadDetail',
          appendCurrentPortalStackWithOrigin(
            route.name,
            route.params,
            {
              ...(seededThreadTitle ? { title: seededThreadTitle } : {}),
              sessionId,
              sourceMessageId,
              threadType: type,
            },
            {
              topicId: normalizedTopicId,
            },
          ),
        );
      },
      [
        actionMessageId,
        navigation,
        route.name,
        route.params,
        seededThreadTitle,
        sessionId,
        topicId,
      ],
    );

    const handlePressStartThread = useCallback(() => {
      const sourceMessageId = actionMessageId?.trim();
      const normalizedTopicId = topicId?.trim();
      if (!sourceMessageId || !normalizedTopicId) return;

      Alert.alert(t.threadStart, t.threadStartModePrompt, [
        { style: 'cancel', text: t.cancel },
        {
          text: t.threadTypeStandalone,
          onPress: () => {
            void handleStartThread('standalone');
          },
        },
        {
          text: t.threadTypeContinuation,
          onPress: () => {
            void handleStartThread('continuation');
          },
        },
      ]);
    }, [
      actionMessageId,
      handleStartThread,
      t.cancel,
      t.threadStart,
      t.threadStartModePrompt,
      t.threadTypeContinuation,
      t.threadTypeStandalone,
      topicId,
    ]);

    return (
      <Animated.View entering={FadeIn.duration(200)}>
        <View
          className={`flex-row w-full items-start px-4 ${isUser ? 'justify-end' : 'justify-start'}`}
          style={{ marginBottom: isUser ? 14 : 16 }}
        >
          {!isUser && (
            <View className="mr-2.5 w-7 items-center">
              <View
                className="h-7 w-7 items-center justify-center overflow-hidden rounded-full"
                style={{ backgroundColor: colors.fillTertiary }}
              >
                {message.role === 'groupTasks' ? (
                  <ListTodo color={colors.primary} size={16} strokeWidth={2} />
                ) : shouldShowGroupSpeaker ? (
                  <GroupSpeakerAvatar
                    fallbackLabel={groupSpeakerFallbackLabel}
                    speaker={groupSpeaker}
                  />
                ) : message.provider ? (
                  <RNImage
                    className="w-4 h-4"
                    defaultSource={require('../../../assets/avato-icon.png')}
                    resizeMode="contain"
                    source={{ uri: getProviderIconUrl(message.provider, effectiveTheme) }}
                  />
                ) : (
                  <RNImage
                    className="w-5 h-5 rounded-md"
                    source={require('../../../assets/avato-icon.png')}
                    style={avatoLogoTint ? { tintColor: avatoLogoTint } : undefined}
                  />
                )}
              </View>
            </View>
          )}

          <View className={isUser ? 'items-end min-w-0 flex-1' : 'flex-1 min-w-0'}>
            {!isUser && (
              <>
                {shouldShowGroupSpeaker ? (
                  <View className="mb-2 flex-row items-center" style={{ minHeight: 28 }}>
                    <View className="min-w-0 flex-1 flex-row items-center">
                      <Text
                        className="text-[12px] font-semibold"
                        numberOfLines={1}
                        style={{ color: colors.foreground, lineHeight: 16 }}
                      >
                        {groupSpeakerName || t.settingsDefaultAgent}
                      </Text>
                      {isSupervisorSpeaker ? (
                        <View
                          className="ml-2 rounded-full px-2 py-0.5"
                          style={{ backgroundColor: colors.primarySubtle }}
                        >
                          <Text
                            className="text-[10px] font-semibold"
                            style={{ color: colors.primary }}
                          >
                            {t.groupSettingsSupervisor}
                          </Text>
                        </View>
                      ) : null}
                      {message.model ? (
                        <Text
                          className="ml-2 flex-1 text-[11px]"
                          numberOfLines={1}
                          style={{ color: colors.secondaryText, lineHeight: 14 }}
                        >
                          {message.model}
                        </Text>
                      ) : null}
                    </View>
                    {message.createdAt ? (
                      <Text
                        className="ml-2 text-[10px]"
                        style={{ color: colors.tertiaryText, lineHeight: 14 }}
                      >
                        {getTimeAgo(message.createdAt)}
                      </Text>
                    ) : null}
                  </View>
                ) : message.role === 'groupTasks' && message.createdAt ? (
                  <View className="mb-2 flex-row justify-end" style={{ minHeight: 28 }}>
                    <Text
                      className="text-[10px]"
                      style={{ color: colors.tertiaryText, lineHeight: 14 }}
                    >
                      {getTimeAgo(message.createdAt)}
                    </Text>
                  </View>
                ) : (
                  <View className="mb-2 flex-row items-center" style={{ minHeight: 28 }}>
                    {message.model ? (
                      <Text
                        className="text-[11px] flex-1"
                        numberOfLines={1}
                        style={{ color: colors.secondaryText, lineHeight: 14 }}
                      >
                        {message.model}
                      </Text>
                    ) : null}
                    {message.createdAt ? (
                      <Text
                        className="text-[10px] ml-2"
                        style={{ color: colors.tertiaryText, lineHeight: 14 }}
                      >
                        {getTimeAgo(message.createdAt)}
                      </Text>
                    ) : null}
                  </View>
                )}
              </>
            )}

            <View style={isUser ? USER_CONTENT_WIDTH : ASSISTANT_CONTENT_WIDTH}>
              {showStandaloneUserAttachments ? (
                <View className="mb-2">
                  <AttachmentBlock
                    downloadingFileId={downloadingFileId}
                    downloadingProgress={downloadingProgress}
                    fileList={message.fileList}
                    imageList={message.imageList}
                    isUser={isUser}
                    onDownloadFile={handleDownloadFile}
                    onOpenFile={handleOpenResourceFile}
                    onOpenImage={(url) => {
                      setViewerUri(url);
                      setShowImageViewer(true);
                    }}
                  />
                </View>
              ) : null}
              {showMessageBubble ? (
                <View
                  className={isUser ? 'px-3.5 py-2 rounded-[18px] rounded-tr-md' : 'py-0.5'}
                  style={
                    isUser
                      ? {
                          alignSelf: 'flex-end',
                          backgroundColor: colors.userBubbleBg,
                          elevation: 2,
                          flexShrink: 1,
                          shadowColor: colors.primary,
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: 0.08,
                          shadowRadius: 4,
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
                              backgroundColor: colors.codeBlockLight,
                              borderRadius: 16,
                              padding: 14,
                            }
                      }
                    >
                      <TextInput
                        autoFocus
                        multiline
                        className="text-[15px] leading-6 min-h-[40px]"
                        style={{ color: isUser ? colors.userBubbleText : mc.text }}
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
                              ? colors.userBubbleCodeBg
                              : colors.markdownCodeInlineBg,
                          }}
                          onPress={() => setIsEditing(false)}
                        >
                          <Text
                            style={{
                              color: isUser ? colors.userBubbleText : mc.text,
                              fontSize: 12,
                              fontWeight: '500',
                            }}
                          >
                            {t.editCancel}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          className="px-3.5 py-1.5 rounded-full"
                          style={{ backgroundColor: isUser ? colors.surface : colors.primary }}
                          onPress={handleEditSubmit}
                        >
                          <Text
                            style={{
                              color: isUser ? colors.foreground : colors.userBubbleText,
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
                            downloadingProgress={downloadingProgress}
                            fileList={message.fileList}
                            imageList={message.imageList}
                            isUser={isUser}
                            onDownloadFile={handleDownloadFile}
                            onOpenFile={handleOpenResourceFile}
                            onOpenImage={(url) => {
                              setViewerUri(url);
                              setShowImageViewer(true);
                            }}
                          />
                        </View>
                      ) : null}

                      {docSelections.length > 0 ? (
                        <View className="mb-2 gap-2">
                          {docSelections.map((selection) => (
                            <TouchableOpacity
                              activeOpacity={0.85}
                              className="flex-row items-center rounded-2xl px-3 py-2"
                              key={selection.id}
                              style={{
                                backgroundColor: isUser
                                  ? colors.userBubbleSubtleBg
                                  : chatAccent.subtleBg,
                              }}
                              onPress={() => {
                                haptics.light();
                                navigateToNotebook(
                                  appendCurrentPortalStackWithOrigin(
                                    route.name,
                                    route.params,
                                    {
                                      documentId: selection.docId,
                                    },
                                    {
                                      sessionId,
                                      ...(message.threadId ? { threadId: message.threadId } : {}),
                                      ...(topicId ? { topicId } : {}),
                                    },
                                  ),
                                );
                              }}
                            >
                              <View
                                className="mr-2 h-7 w-7 items-center justify-center rounded-lg"
                                style={{
                                  backgroundColor: isUser
                                    ? colors.userBubbleCodeBg
                                    : colors.fillTertiary,
                                }}
                              >
                                <LibraryBig
                                  color={isUser ? colors.userBubbleText : colors.primary}
                                  size={16}
                                  strokeWidth={tokens.icon.strokeWidth}
                                />
                              </View>
                              <View className="flex-1">
                                <Text
                                  className="text-[11px] font-semibold"
                                  style={{
                                    color: isUser
                                      ? colors.userBubbleTextMuted
                                      : colors.secondaryText,
                                  }}
                                >
                                  {t.fileChatContext}
                                </Text>
                                <Text
                                  className="text-[12px] font-medium"
                                  numberOfLines={1}
                                  style={{ color: isUser ? colors.userBubbleText : mc.heading }}
                                >
                                  {selection.content.trim().slice(0, 48) || selection.docId}
                                </Text>
                              </View>
                            </TouchableOpacity>
                          ))}
                        </View>
                      ) : null}

                      {!assistantChainChildren?.length && hasSearch && message.search && (
                        <SearchGroundingBlock search={message.search} />
                      )}

                      {!assistantChainChildren?.length && hasTools && message.tools && (
                        <ToolCallsBlock
                          assistantMessageId={message.id}
                          disableToolActions={disableToolActions}
                          sessionId={sessionId}
                          threadId={message.threadId ?? undefined}
                          toolActionHandlers={toolActionHandlers}
                          tools={message.tools}
                          topicId={topicId ?? undefined}
                        />
                      )}

                      {!assistantChainChildren?.length &&
                        !isUser &&
                        !isToolMessage &&
                        (renderedReasoning || (generating && isReasoning)) && (
                          <ThinkingBlock
                            content={renderedReasoning}
                            duration={message.reasoning?.duration}
                            isMultimodal={message.reasoning?.isMultimodal}
                            markdownRules={markdownRules}
                            markdownStyles={reasoningMarkdownStyles}
                            model={message.model}
                            searchCitations={message.search?.citations}
                            searchImageResults={message.search?.imageResults}
                            tempDisplayContent={multimodalReasoningParts || undefined}
                            thinking={
                              generating && isReasoning && message.id.startsWith('assistant-')
                            }
                          />
                        )}
                      {assistantChainChildren?.length ? (
                        <AssistantChainBlock
                          childrenMessages={assistantChainChildren}
                          disableToolActions={disableToolActions}
                          markdownRules={markdownRules}
                          markdownStyles={markdownStyles}
                          reasoningMarkdownStyles={reasoningMarkdownStyles}
                          sessionId={sessionId}
                          t={t}
                          toolActionHandlers={toolActionHandlers}
                          topicId={topicId ?? undefined}
                          onOpenLink={handleOpenLink}
                        />
                      ) : compareGroupChildren?.length ? (
                        <CompareGroupBlock
                          childrenMessages={compareGroupChildren}
                          groupMembersById={groupMembersById}
                          groupSupervisorId={groupSupervisorId}
                          markdownRules={markdownRules}
                          markdownStyles={markdownStyles}
                          t={t}
                          onOpenLink={handleOpenLink}
                        />
                      ) : groupTasksMessages?.length ? (
                        <GroupTasksBlock
                          groupMembersById={groupMembersById}
                          message={message}
                          t={t}
                          onOpenThread={handleOpenThread}
                        />
                      ) : compressedGroupMessages?.length ? (
                        isCompressedGroupExpanded ? (
                          <View className="gap-2">
                            <CompareGroupBlock
                              childrenMessages={compressedGroupMessages}
                              groupMembersById={groupMembersById}
                              groupSupervisorId={groupSupervisorId}
                              markdownRules={markdownRules}
                              markdownStyles={markdownStyles}
                              t={t}
                              onOpenLink={handleOpenLink}
                            />
                            <TouchableOpacity
                              activeOpacity={0.7}
                              className="mt-1 py-1"
                              onPress={() => {
                                haptics.light();
                                if (readOnly) {
                                  setReadOnlyGroupExpanded(false);
                                  return;
                                }
                                useChatStore.getState().toggleMessageCollapsed(
                                  sessionId,
                                  message.id,
                                  false,
                                );
                              }}
                            >
                              <Text
                                className="text-[12px] font-medium"
                                style={{ color: colors.primary }}
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
                              {preprocessMentionDisplay(
                                preprocessMathBlocks(
                                  applyAssistantSearchInlineMarkdown(
                                    (message.content || '').slice(0, 500) +
                                      (message.content && message.content.length > 500
                                        ? '...'
                                        : ''),
                                    message.search?.citations,
                                    message.search?.imageResults,
                                  ),
                                ),
                                t.groupMentionAllMembers,
                              )}
                            </Markdown>
                            <TouchableOpacity
                              activeOpacity={0.7}
                              className="mt-2 py-2 rounded-xl bg-foreground/[0.04] items-center"
                              onPress={() => {
                                haptics.light();
                                if (readOnly) {
                                  setReadOnlyGroupExpanded(true);
                                  return;
                                }
                                useChatStore.getState().toggleMessageCollapsed(
                                  sessionId,
                                  message.id,
                                  true,
                                );
                              }}
                            >
                              <Text
                                className="text-[13px] font-medium"
                                style={{ color: colors.primary }}
                              >
                                {t.chatShowMore}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        )
                      ) : isToolMessage ? (
                        <ToolResultBlock
                          disableToolActions={disableToolActions}
                          message={message}
                          sessionId={sessionId}
                          toolActionHandlers={toolActionHandlers}
                          topicId={topicId ?? undefined}
                        />
                      ) : !message.content && !multimodalContentParts && generating ? (
                        isReasoning ? null : (
                          <TypingIndicator color={colors.typingIndicator} />
                        )
                      ) : multimodalContentParts?.length ? (
                        <RichContentPartsBlock
                          citations={message.search?.citations}
                          imageResults={message.search?.imageResults}
                          markdownRules={markdownRules}
                          markdownStyles={isUser ? userMarkdownStyles : markdownStyles}
                          model={!isUser ? message.model : undefined}
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
                          {isLongContent && (
                            <View className="mt-1 flex-row items-center gap-4">
                              <TouchableOpacity
                                activeOpacity={0.7}
                                className="py-1"
                                onPress={() => setContentCollapsed((v) => !v)}
                              >
                                <Text
                                  className="text-[12px] font-medium"
                                  style={{ color: colors.primary }}
                                >
                                  {contentCollapsed ? t.chatShowMore : t.chatShowLess}
                                </Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </>
                      ) : null}
                      {!isUser && !generating && message.error && (
                        <ErrorBlock
                          error={message.error}
                          onRetry={readOnly ? undefined : handleRegenerate}
                        />
                      )}
                      {!isUser && messageThreadId ? (
                        <ThreadJumpButton
                          label={t.threadOpen}
                          onPress={() =>
                            handleOpenThread(messageThreadId, messageThreadTitle || undefined)
                          }
                        />
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
              {!readOnly && !generating && !isEditing && (
                <Animated.View
                  className={`flex-row items-center mt-2 gap-1 ${isUser ? 'justify-end' : 'justify-start'}`}
                  entering={FadeIn.duration(200)}
                >
                  {!isUser && !isToolMessage && (
                    <TouchableOpacity
                      accessibilityLabel={t.msgActionRegenerate}
                      activeOpacity={0.5}
                      className="w-8 h-8 rounded-full items-center justify-center"
                      style={{ backgroundColor: colors.fillTertiary }}
                      onPress={handleRegenerate}
                    >
                      <RefreshCw color={colors.muted} size={14} strokeWidth={2} />
                    </TouchableOpacity>
                  )}
                  {isUser && (
                    <TouchableOpacity
                      accessibilityLabel={t.msgActionEdit}
                      activeOpacity={0.5}
                      className="w-8 h-8 rounded-full items-center justify-center"
                      style={{ backgroundColor: colors.fillTertiary }}
                      onPress={handleEdit}
                    >
                      <Pencil color={colors.muted} size={14} strokeWidth={2} />
                    </TouchableOpacity>
                  )}
                  {canStartThread && (
                    <TouchableOpacity
                      accessibilityLabel={t.threadStart}
                      activeOpacity={0.5}
                      className="w-8 h-8 rounded-full items-center justify-center"
                      style={{ backgroundColor: colors.fillTertiary }}
                      onPress={handlePressStartThread}
                    >
                      <GitBranch color={colors.primary} size={14} strokeWidth={2} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    accessibilityLabel={t.msgActionCopy}
                    activeOpacity={0.5}
                    className="w-8 h-8 rounded-full items-center justify-center"
                    style={{ backgroundColor: colors.fillTertiary }}
                    onPress={handleCopy}
                  >
                    <Copy color={colors.muted} size={14} strokeWidth={2} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityLabel={t.msgActionShare}
                    activeOpacity={0.5}
                    className="w-8 h-8 rounded-full items-center justify-center"
                    style={{ backgroundColor: colors.fillTertiary }}
                    onPress={handleShare}
                  >
                    <Share2 color={colors.muted} size={14} strokeWidth={2} />
                  </TouchableOpacity>
                  {!isUser && onSaveToTopic && (
                    <TouchableOpacity
                      accessibilityLabel={t.msgActionSaveToTopic}
                      activeOpacity={0.5}
                      className="w-8 h-8 rounded-full items-center justify-center"
                      style={{ backgroundColor: colors.fillTertiary }}
                      onPress={handleSaveToTopic}
                    >
                      <Bookmark color={colors.muted} size={14} strokeWidth={2} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    accessibilityLabel={t.msgActionDelete}
                    activeOpacity={0.5}
                    className="w-8 h-8 rounded-full items-center justify-center"
                    style={{ backgroundColor: colors.fillTertiary }}
                    onPress={handleDelete}
                  >
                    <Trash2 color={colors.danger} size={14} strokeWidth={2} />
                  </TouchableOpacity>
                </Animated.View>
              )}
            </View>
          </View>
        </View>

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
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${formatToolArgumentValue(value)}`);

  return {
    params,
    title: titleSegments.join(' > '),
  };
};

/**
 * Shared helper for ToolCallsBlock + ToolResultBlock.
 * Builtin tools use getMobileBuiltinDisplayName (Inspector/displayName) first;
 * others fall back to formatToolDisplayTitle (identifier > apiName).
 */
function buildToolDisplayProps(
  tool: Pick<ChatToolPayload, 'apiName' | 'arguments' | 'identifier'>,
  fallbackTitle: string,
  locale: string | undefined,
  hasResult: boolean,
  isPending: boolean,
) {
  const { params, title } = formatToolDisplayTitle(tool);
  const argumentsText = [
    params.length ? `(${params.join(', ')})` : '',
    tool.arguments ? formatToolArguments(tool.arguments) : '',
  ]
    .filter(Boolean)
    .join('\n');
  const displayTitle =
    getMobileBuiltinDisplayName(tool.identifier, tool.apiName, locale) ||
    title ||
    tool.apiName ||
    tool.identifier ||
    fallbackTitle;
  const BuiltinRender = getMobileBuiltinRender(tool.identifier, tool.apiName);
  const useBuiltinRender = BuiltinRender && hasResult && !isPending;
  return { argumentsText, BuiltinRender, displayTitle, useBuiltinRender };
}

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
  imageResults?: ImageCitationItem[] | null;
  markdownRules?: Record<string, any>;
  markdownStyles: Record<string, any>;
  model?: string;
  onOpenLink: (url?: string) => void;
  parts: MessageContentPart[];
}>(({ parts, markdownStyles, markdownRules, onOpenLink, citations, imageResults, model }) => {
  const colors = useThemeColors();
  const imageCount = parts.filter((p) => p.type === 'image').length;
  const hasImageTags = model != null || imageCount > 0;

  return (
    <View className="gap-2">
      {parts.map((part, index) => {
        if (part.type === 'image' && part.image) {
          const isFirstImage = index === parts.findIndex((p) => p.type === 'image');
          return (
            <View key={`${part.image}-${index}`}>
              {isFirstImage && hasImageTags && (
                <View className="flex-row flex-wrap gap-2 mb-2">
                  {model != null && (
                    <View
                      className="rounded-full px-2.5 py-1"
                      style={{ backgroundColor: colors.primarySubtle }}
                    >
                      <Text className="text-[11px] font-medium" style={{ color: colors.primary }}>
                        {model}
                      </Text>
                    </View>
                  )}
                  {imageCount > 0 && (
                    <View
                      className="rounded-full px-2.5 py-1"
                      style={{ backgroundColor: colors.primarySubtle }}
                    >
                      <Text className="text-[11px] font-medium" style={{ color: colors.primary }}>
                        ×{imageCount}
                      </Text>
                    </View>
                  )}
                </View>
              )}
              <RNImage
                resizeMode="cover"
                source={{ uri: part.image }}
                style={{
                  backgroundColor: colors.fillTertiary,
                  borderRadius: 16,
                  height: 180,
                  width: '100%',
                }}
              />
            </View>
          );
        }

        if (part.type === 'text' && part.text) {
          return (
            <Markdown
              key={`${part.text.slice(0, 24)}-${index}`}
              rules={markdownRules ?? codeInlineRules}
              style={markdownStyles}
              onLinkPress={(url) => {
                onOpenLink(url);
                return false;
              }}
            >
              {applyAssistantSearchInlineMarkdown(part.text, citations, imageResults)}
            </Markdown>
          );
        }

        return null;
      })}
    </View>
  );
});

RichContentPartsBlock.displayName = 'RichContentPartsBlock';

const AttachmentBlock = memo<{
  downloadingFileId?: string | null;
  downloadingProgress?: number;
  fileList?: ChatMessage['fileList'];
  imageList?: ChatMessage['imageList'];
  isUser: boolean;
  onDownloadFile: (file: NonNullable<ChatMessage['fileList']>[number]) => void;
  onOpenFile: (file: NonNullable<ChatMessage['fileList']>[number]) => void;
  onOpenImage: (url: string) => void;
}>(
  ({
    imageList,
    fileList,
    isUser,
    onDownloadFile,
    onOpenFile,
    onOpenImage,
    downloadingFileId,
    downloadingProgress = 0,
  }) => {
    const { t } = useI18n();
    const colors = useThemeColors();
    const chatAccent = useMemo(() => getChatAccent(colors), [colors]);
    const mc = useMemo(
      () => ({
        heading: colors.markdownHeading,
        text: colors.markdownText,
      }),
      [colors],
    );
    const renderImageItem = useCallback(
      ({ item }: { item: NonNullable<ChatMessage['imageList']>[number] }) => (
        <TouchableOpacity activeOpacity={0.9} onPress={() => onOpenImage(item.url)}>
          <RNImage
            source={{ uri: item.url }}
            style={{
              backgroundColor: isUser ? colors.userBubbleSubtleBg : chatAccent.subtleBg,
              borderRadius: 14,
              height: 120,
              width: 120,
            }}
          />
        </TouchableOpacity>
      ),
      [chatAccent.subtleBg, colors.userBubbleSubtleBg, isUser, onOpenImage],
    );

    return (
      <View className="gap-2">
        {imageList?.length ? (
          <FlatList
            horizontal
            contentContainerStyle={{ gap: 8 }}
            data={imageList}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            renderItem={renderImageItem}
            showsHorizontalScrollIndicator={false}
          />
        ) : null}

        {fileList?.length ? (
          <View className="gap-2">
            {fileList.map((file) => (
              <TouchableOpacity
                activeOpacity={0.85}
                className="rounded-2xl px-3 py-2"
                key={file.id}
                style={{
                  backgroundColor: isUser ? colors.userBubbleSubtleBg : chatAccent.subtleBg,
                }}
                onPress={() => onOpenFile(file)}
              >
                <View className="flex-row items-center justify-between gap-3">
                  <View className="flex-1">
                    <Text
                      numberOfLines={1}
                      style={{
                        color: isUser ? colors.userBubbleText : mc.heading,
                        fontSize: 13,
                        fontWeight: '600',
                      }}
                    >
                      {file.name}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={{
                        color: isUser ? colors.userBubbleTextMuted : mc.text + '88',
                        fontSize: 12,
                        marginTop: 2,
                      }}
                    >
                      {file.fileType}
                    </Text>
                  </View>
                  {downloadingFileId === file.id ? (
                    <View className="min-w-[28px] items-end">
                      <Text
                        numberOfLines={1}
                        style={{
                          color: isUser ? colors.userBubbleText : chatAccent.badgeText,
                          fontSize: 12,
                          fontWeight: '600',
                        }}
                      >
                        {downloadingProgress}%
                      </Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      accessibilityLabel={t.resourceDownload}
                      activeOpacity={0.75}
                      className="rounded-full p-1"
                      hitSlop={{ bottom: 6, left: 6, right: 6, top: 6 }}
                      onPress={(event) => {
                        event.stopPropagation();
                        onDownloadFile(file);
                      }}
                    >
                      <Download
                        color={isUser ? colors.userBubbleText : chatAccent.badgeText}
                        size={16}
                        strokeWidth={1.9}
                      />
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </View>
    );
  },
);

AttachmentBlock.displayName = 'AttachmentBlock';

const CitationFootnotesBlock = memo<{
  citations: CitationItem[];
  onOpenLink: (url?: string) => void;
}>(({ citations, onOpenLink }) => {
  const { t } = useI18n();
  const colors = useThemeColors();
  const chatAccent = useMemo(() => getChatAccent(colors), [colors]);
  const visibleCitations = citations.filter((item) => !!item.url);

  if (visibleCitations.length === 0) return null;
  if (!visibleCitations.every((item) => item.title !== item.url)) return null;

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
  const colors = useThemeColors();
  const chatAccent = useMemo(() => getChatAccent(colors), [colors]);
  const [expanded, setExpanded] = useState(false);

  const webCount = search.citations?.length ?? 0;
  const imageCount = search.imageResults?.length ?? 0;
  const title = webCount > 0 ? t.chatSearchSources : t.chatSearchImages;
  const count = webCount || imageCount;
  const previewFavicons = useMemo(
    () =>
      webCount > 0
        ? (search.citations || []).slice(0, 8).map(getCitationFavicon).filter(Boolean)
        : (search.imageResults || []).slice(0, 8).map(getImageResultFavicon).filter(Boolean),
    [search.citations, search.imageResults, webCount],
  );
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
  const renderCitationCard = useCallback(
    ({
      item,
      index: _index,
    }: {
      index: number;
      item: NonNullable<GroundingSearch['citations']>[number];
    }) => {
      const host = item.favicon || getUrlHost(item.url);
      const favicon = getCitationFavicon(item);

      return (
        <TouchableOpacity
          activeOpacity={0.82}
          className="rounded-2xl px-3 py-3"
          style={{
            backgroundColor: chatAccent.elevatedBg,
            width: 220,
          }}
          onPress={() => handleOpenLink(item.url)}
        >
          <Text className="text-[13px] font-semibold text-foreground/80" numberOfLines={3}>
            {item.title || item.url}
          </Text>
          <View className="mt-3 flex-row items-center">
            {favicon ? (
              <RNImage
                source={{ uri: favicon }}
                style={{ borderRadius: 8, height: 16, marginRight: 8, width: 16 }}
              />
            ) : null}
            <Text className="flex-1 text-[11px] text-foreground/45" numberOfLines={1}>
              {host || item.url}
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [chatAccent.elevatedBg, handleOpenLink],
  );
  const renderImageResultCard = useCallback(
    ({
      item,
      index: _index,
    }: {
      index: number;
      item: NonNullable<GroundingSearch['imageResults']>[number];
    }) => (
      <TouchableOpacity
        activeOpacity={0.82}
        className="rounded-xl overflow-hidden"
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
    ),
    [chatAccent.elevatedBg, handleOpenLink],
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
          {webCount > 0 ? (
            <Globe color={colors.primary} size={14} strokeWidth={2} />
          ) : (
            <Images color={colors.primary} size={14} strokeWidth={2} />
          )}
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
                    backgroundColor: colors.surface,
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
          <ChevronDown color={colors.iconMuted} size={14} strokeWidth={2.5} />
        ) : (
          <ChevronRight color={colors.iconMuted} size={14} strokeWidth={2.5} />
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
            <FlatList
              horizontal
              contentContainerStyle={{ gap: 10 }}
              data={search.citations}
              keyExtractor={(item, index) => `${item.url}-${index}`}
              keyboardShouldPersistTaps="handled"
              renderItem={renderCitationCard}
              showsHorizontalScrollIndicator={false}
            />
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
            <FlatList
              horizontal
              contentContainerStyle={{ gap: 8 }}
              data={search.imageResults}
              keyExtractor={(item, index) => `${item.imageUri || item.sourceUri || index}-${index}`}
              keyboardShouldPersistTaps="handled"
              renderItem={renderImageResultCard}
              showsHorizontalScrollIndicator={false}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
});

SearchGroundingBlock.displayName = 'SearchGroundingBlock';

const isToolResultReady = (
  tool?: Pick<ChatToolPayload, 'result_content' | 'result_msg_id'> | null,
) => !!tool && (tool.result_content !== undefined || !!tool.result_msg_id);

const isToolSettled = (
  tool?: Pick<ChatToolPayload, 'intervention' | 'result_content' | 'result_msg_id'> | null,
) => {
  if (!tool) return false;
  const status = tool.intervention?.status;
  return status === 'aborted' || status === 'rejected' || isToolResultReady(tool);
};

const ToolStatusIcon = memo<{
  error?: unknown;
  resultReady?: boolean;
  status?: 'aborted' | 'pending' | 'rejected' | string | null;
}>(({ status, resultReady, error }) => {
  const colors = useThemeColors();
  if (status === 'aborted') {
    return <Pause color={colors.tertiaryText} size={12} strokeWidth={2.25} />;
  }

  if (status === 'rejected') {
    return <Ban color={colors.tertiaryText} size={12} strokeWidth={2.25} />;
  }

  if (status === 'pending') {
    return <Hand color={colors.primary} size={12} strokeWidth={2.1} />;
  }

  if (error) {
    return <X color={colors.danger} size={12} strokeWidth={2.4} />;
  }

  if (resultReady) {
    return <Check color={colors.iconSuccess} size={12} strokeWidth={2.4} />;
  }

  return <ActivityIndicator color={colors.muted} size="small" />;
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
  const { t } = useI18n();
  const colors = useThemeColors();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await Clipboard.setStringAsync(text.trim());
    haptics.success();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <TouchableOpacity
      accessibilityLabel={t.msgActionCopy}
      activeOpacity={0.6}
      hitSlop={{ bottom: 4, left: 4, right: 4, top: 4 }}
      style={{ position: 'absolute', right: 8, top: 8 }}
      onPress={handleCopy}
    >
      {copied ? (
        <Check color={colors.iconSuccess} size={12} strokeWidth={2} />
      ) : (
        <Copy color={colors.iconMuted} size={12} strokeWidth={2} />
      )}
    </TouchableOpacity>
  );
});

ToolContentCopyButton.displayName = 'ToolContentCopyButton';

const ToolCard = memo<{
  collapsible?: boolean;
  argumentsText?: string;
  content?: string;
  customContent?: React.ReactNode;
  error?: unknown;
  interventionContent?: React.ReactNode;
  onApprove?: () => void | Promise<void>;
  onOpenDetail?: () => void;
  onReject?: () => void;
  onRejectAndContinue?: () => void | Promise<void>;
  resultReady?: boolean;
  status?: 'aborted' | 'pending' | 'rejected' | string | null;
  streamingContent?: React.ReactNode;
  title: string;
}>(
  ({
    title,
    argumentsText,
    status,
    resultReady,
    error,
    content,
    customContent,
    collapsible = false,
    interventionContent,
    onApprove,
    onOpenDetail,
    onReject,
    onRejectAndContinue,
    streamingContent,
  }) => {
    const { t } = useI18n();
    const colors = useThemeColors();
    const chatAccent = useMemo(() => getChatAccent(colors), [colors]);
    const isPending = status === 'pending';
    const isRejected = status === 'rejected';
    const isAborted = status === 'aborted';
    const shouldAutoExpand =
      !collapsible || isPending || resultReady || !!streamingContent || !!customContent;
    const [expanded, setExpanded] = useState(shouldAutoExpand);
    const showDetail = expanded || !collapsible;
    const [contentExpanded, setContentExpanded] = useState(false);
    const hasAutoExpandedRef = useRef(shouldAutoExpand);

    useEffect(() => {
      if (!shouldAutoExpand || hasAutoExpandedRef.current) return;

      setExpanded(true);
      hasAutoExpandedRef.current = true;
    }, [shouldAutoExpand]);

    const truncatedContent =
      content && content.length > 500 && !contentExpanded ? content.slice(0, 500) + '...' : content;

    const cardA11yLabel = collapsible
      ? `${title}. ${expanded ? t.chatToolTapToCollapse : t.chatToolTapToExpand}`
      : title;

    return (
      <TouchableOpacity
        accessibilityLabel={cardA11yLabel}
        activeOpacity={collapsible ? 0.82 : 1}
        className="rounded-2xl px-3 py-3"
        disabled={!collapsible}
        style={{
          backgroundColor: isPending ? colors.primarySubtle : chatAccent.elevatedBg,
        }}
        onPress={() => {
          if (collapsible) setExpanded((value) => !value);
        }}
      >
        <View className="flex-row items-start">
          <View
            className="mr-3 mt-0.5 h-6 w-6 items-center justify-center rounded-lg"
            style={{
              backgroundColor: isPending ? colors.primaryMuted : chatAccent.badgeBg,
            }}
          >
            <ToolStatusIcon error={error} resultReady={resultReady} status={status} />
          </View>
          <View className="flex-1">
            <View className="flex-row items-center">
              <Text
                className="flex-1 text-[12px] font-semibold"
                numberOfLines={1}
                style={{ color: colors.foreground }}
              >
                {title}
              </Text>
              {collapsible ? (
                expanded ? (
                  <ChevronDown color={colors.iconMuted} size={14} strokeWidth={2.3} />
                ) : (
                  <ChevronRight color={colors.iconMuted} size={14} strokeWidth={2.3} />
                )
              ) : null}
            </View>
            <Text
              className="mt-0.5 text-[10px] uppercase tracking-[0.5px]"
              style={{ color: colors.secondaryText }}
            >
              <ToolStatusLabel error={error} resultReady={resultReady} status={status} />
            </Text>

            {showDetail && isPending && (
              <View className="mt-2">
                {interventionContent || (
                  <Text
                    className="text-[11px] leading-4 mb-2"
                    style={{ color: colors.secondaryText }}
                  >
                    {t.chatToolPendingDesc}
                  </Text>
                )}
                {(onApprove || onReject || onRejectAndContinue) && (
                  <View className="mt-2 flex-row flex-wrap gap-2">
                    {onApprove && (
                      <TouchableOpacity
                        activeOpacity={0.7}
                        className="rounded-full px-4 py-1.5"
                        style={{ backgroundColor: colors.primaryMuted }}
                        onPress={() => {
                          void Promise.resolve(onApprove()).catch((e) =>
                            console.warn('[ToolCard] onApprove failed', e),
                          );
                        }}
                      >
                        <Text
                          className="text-[12px] font-semibold"
                          style={{ color: colors.primary }}
                        >
                          {t.chatToolApprove}
                        </Text>
                      </TouchableOpacity>
                    )}
                    {onReject && (
                      <TouchableOpacity
                        activeOpacity={0.7}
                        className="rounded-full px-4 py-1.5"
                        style={{ backgroundColor: colors.dangerMuted }}
                        onPress={onReject}
                      >
                        <Text
                          className="text-[12px] font-semibold"
                          style={{ color: colors.danger }}
                        >
                          {t.chatToolReject}
                        </Text>
                      </TouchableOpacity>
                    )}
                    {onRejectAndContinue && (
                      <TouchableOpacity
                        activeOpacity={0.7}
                        className="rounded-full border px-3 py-1.5"
                        style={{
                          backgroundColor: colors.warningSubtle,
                          borderColor: colors.warningMuted,
                        }}
                        onPress={() => {
                          void Promise.resolve(onRejectAndContinue()).catch((e) =>
                            console.warn('[ToolCard] onRejectAndContinue failed', e),
                          );
                        }}
                      >
                        <Text
                          className="text-[11px] font-semibold"
                          numberOfLines={2}
                          style={{ color: colors.warning }}
                        >
                          {t.chatToolRejectAndContinue}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            )}

            {showDetail && onOpenDetail ? (
              <TouchableOpacity
                activeOpacity={0.7}
                className="mt-2 self-start"
                onPress={(event) => {
                  event.stopPropagation();
                  onOpenDetail();
                }}
              >
                <Text className="text-[11px] font-medium" style={{ color: colors.primary }}>
                  {t.toolDetailOpen}
                </Text>
              </TouchableOpacity>
            ) : null}

            {showDetail && isRejected && (
              <Text className="mt-2 text-[11px] leading-4" style={{ color: colors.tertiaryText }}>
                {t.chatToolRejectedDesc}
              </Text>
            )}

            {showDetail && isAborted && (
              <Text className="mt-2 text-[11px] leading-4" style={{ color: colors.tertiaryText }}>
                {t.chatToolAbortedDesc}
              </Text>
            )}

            {showDetail && argumentsText ? (
              <>
                <Text
                  className="mt-2 text-[10px] font-semibold uppercase tracking-[0.5px]"
                  style={{ color: colors.tertiaryText }}
                >
                  {t.chatToolArguments}
                </Text>
                <View style={{ position: 'relative' }}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <Text
                      selectable
                      className="mt-1 rounded-xl px-3 py-2 text-[11px] leading-4"
                      style={{
                        backgroundColor: chatAccent.subtleBg,
                        color: colors.markdownText,
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
            {showDetail && customContent ? <View className="mt-2">{customContent}</View> : null}
            {showDetail && !customContent && streamingContent && !resultReady ? (
              <View className="mt-2">{streamingContent}</View>
            ) : null}
            {showDetail && !customContent && truncatedContent ? (
              <>
                <Text
                  className="mt-2 text-[10px] font-semibold uppercase tracking-[0.5px]"
                  style={{ color: colors.tertiaryText }}
                >
                  {t.chatToolResponse}
                </Text>
                <View style={{ position: 'relative' }}>
                  <Text
                    selectable
                    className="mt-1 rounded-xl px-3 py-2 text-[12px] leading-5"
                    style={{
                      backgroundColor: chatAccent.subtleBg,
                      color: colors.markdownText,
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
                    <Text className="text-[11px] font-medium" style={{ color: colors.primary }}>
                      {contentExpanded ? t.chatShowLess : t.chatShowMore}
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            ) : null}
            {showDetail && error ? (
              <Text className="mt-2 text-[11px] leading-4" style={{ color: colors.danger }}>
                {typeof error === 'string' ? error : t.chatToolFailed}
              </Text>
            ) : null}
            {!showDetail && argumentsText ? (
              <Text
                accessibilityLabel={`${t.chatToolArguments}, ${t.chatToolTapToExpand}`}
                className="mt-2 text-[11px] leading-4"
                numberOfLines={2}
                style={{ color: colors.secondaryText }}
              >
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

const MOBILE_TOOL_INTERVENTION_ENABLED = true;

/** One tool row: keeps draft arguments in a ref (sync) so approve sees edits after registerBeforeApprove flush. */
const ToolCallItem = memo<{
  assistantMessageId?: string;
  disableToolActions?: boolean;
  locale: string;
  sessionId?: string;
  threadId?: string;
  tool: ChatToolPayload;
  toolActionHandlers?: ToolActionHandlers;
  topicId?: string;
}>(
  ({
    tool,
    sessionId,
    threadId,
    topicId,
    assistantMessageId,
    locale,
    disableToolActions = false,
    toolActionHandlers,
  }) => {
    const navigation = useNavigation<RootStackNavigationProp>();
    const route = useRoute();
    const mergedArgsRef = useRef(tool.arguments || '{}');
    const beforeApproveCallbacksRef = useRef<Array<() => Promise<void>>>([]);
    const [_argsRenderKey, setArgsRenderKey] = useState(0);

    useEffect(() => {
      mergedArgsRef.current = tool.arguments || '{}';
      setArgsRenderKey((k) => k + 1);
    }, [tool.arguments]);

    const parsedArgs = (() => {
      try {
        return JSON.parse(mergedArgsRef.current) as Record<string, unknown>;
      } catch {
        return {};
      }
    })();

    const onArgsChange = useCallback((partial: Record<string, unknown>) => {
      let base: Record<string, unknown>;
      try {
        base = JSON.parse(mergedArgsRef.current) as Record<string, unknown>;
      } catch {
        base = {};
      }
      mergedArgsRef.current = JSON.stringify({ ...base, ...partial });
      setArgsRenderKey((k) => k + 1);
    }, []);

    const registerBeforeApprove = useCallback(
      (_hookId: string, callback: () => void | Promise<void>) => {
        const wrapped = () => Promise.resolve(callback());
        beforeApproveCallbacksRef.current.push(wrapped);
        return () => {
          beforeApproveCallbacksRef.current = beforeApproveCallbacksRef.current.filter(
            (fn) => fn !== wrapped,
          );
        };
      },
      [],
    );

    const hasResult = isToolResultReady(tool);
    const isPending = tool.intervention?.status === 'pending';
    const { argumentsText, BuiltinRender, displayTitle, useBuiltinRender } = buildToolDisplayProps(
      tool,
      tool.apiName || tool.identifier || '',
      locale,
      hasResult,
      isPending,
    );

    const BuiltinIntervention = getMobileBuiltinIntervention(tool.identifier, tool.apiName);
    const showIntervention =
      !disableToolActions && MOBILE_TOOL_INTERVENTION_ENABLED && isPending && BuiltinIntervention;

    const handleApprove = useCallback(async () => {
      const callbacks = [...beforeApproveCallbacksRef.current];
      for (const fn of callbacks) {
        await fn();
      }
      const approvedTool: ChatToolPayload = {
        ...tool,
        arguments: mergedArgsRef.current || '{}',
      };
      if (toolActionHandlers?.continueToolIntervention && assistantMessageId) {
        await toolActionHandlers.continueToolIntervention(assistantMessageId, approvedTool);
        return;
      }

      await useChatStore
        .getState()
        .continueToolIntervention(sessionId!, topicId, assistantMessageId!, approvedTool);
    }, [assistantMessageId, sessionId, tool, toolActionHandlers, topicId]);

    const handleReject = assistantMessageId
      ? () => {
          if (toolActionHandlers?.rejectToolCall) {
            void toolActionHandlers.rejectToolCall(assistantMessageId, tool.id);
            return;
          }

          if (sessionId) {
            useChatStore.getState().rejectToolCall(sessionId, assistantMessageId, tool.id);
          }
        }
      : undefined;

    const handleRejectAndContinue = useCallback(async () => {
      if (toolActionHandlers?.rejectAndContinueToolIntervention && assistantMessageId) {
        await toolActionHandlers.rejectAndContinueToolIntervention(assistantMessageId, tool.id);
        return;
      }

      await useChatStore
        .getState()
        .rejectAndContinueToolIntervention(sessionId!, topicId, assistantMessageId!, tool.id);
    }, [assistantMessageId, sessionId, tool.id, toolActionHandlers, topicId]);

    const showApprovalButtons =
      !disableToolActions && (showIntervention || (MOBILE_TOOL_INTERVENTION_ENABLED && isPending));
    const canOpenToolDetail = !!(
      tool.result_content ||
      tool.pluginState ||
      tool.arguments ||
      tool.pluginError
    );
    const handleOpenDetail = useCallback(() => {
      if (!canOpenToolDetail) return;

      navigation.navigate(
        'ToolDetail',
        appendCurrentPortalStackWithOrigin(
          route.name,
          route.params,
          {
            apiName: tool.apiName,
            arguments: tool.arguments,
            content: tool.result_content,
            error: tool.pluginError,
            identifier: tool.identifier,
            pluginState: tool.pluginState,
            title: displayTitle,
            toolCallId: tool.id,
          },
          {
            ...(sessionId ? { sessionId } : {}),
            ...(threadId ? { threadId } : {}),
            ...(topicId ? { topicId } : {}),
          },
        ),
      );
    }, [
      canOpenToolDetail,
      displayTitle,
      navigation,
      route.name,
      route.params,
      sessionId,
      threadId,
      tool.apiName,
      tool.arguments,
      tool.id,
      tool.identifier,
      tool.pluginError,
      tool.pluginState,
      tool.result_content,
      topicId,
    ]);

    const BuiltinStreaming = getMobileBuiltinStreaming(tool.identifier, tool.apiName);
    const showStreaming = !hasResult && !isPending && BuiltinStreaming;

    const interventionContent =
      showIntervention && BuiltinIntervention ? (
        <BuiltinIntervention
          args={parsedArgs}
          registerBeforeApprove={registerBeforeApprove}
          onArgsChange={onArgsChange}
        />
      ) : undefined;

    const streamingContent =
      showStreaming && BuiltinStreaming ? (
        <BuiltinStreaming apiName={tool.apiName} args={parsedArgs} identifier={tool.identifier} />
      ) : undefined;

    const onApprove = assistantMessageId && showApprovalButtons ? handleApprove : undefined;
    const onRejectAndContinue =
      assistantMessageId && showApprovalButtons ? handleRejectAndContinue : undefined;

    if (useBuiltinRender && BuiltinRender) {
      return (
        <ToolCard
          collapsible
          argumentsText={argumentsText || undefined}
          error={tool.pluginError}
          interventionContent={interventionContent}
          resultReady={hasResult}
          status={tool.intervention?.status ?? null}
          streamingContent={streamingContent}
          title={displayTitle}
          customContent={
            hasResult ? (
              <BuiltinRender
                apiName={tool.apiName}
                arguments={tool.arguments}
                content={tool.result_content}
                identifier={tool.identifier}
                pluginState={tool.pluginState}
                sessionId={sessionId}
                threadId={threadId}
                toolCallId={tool.id}
                topicId={topicId}
              />
            ) : undefined
          }
          onApprove={onApprove}
          onOpenDetail={canOpenToolDetail ? handleOpenDetail : undefined}
          onReject={showApprovalButtons ? handleReject : undefined}
          onRejectAndContinue={onRejectAndContinue}
        />
      );
    }

    return (
      <ToolCard
        collapsible
        argumentsText={argumentsText || undefined}
        content={tool.result_content || undefined}
        error={tool.pluginError}
        interventionContent={interventionContent}
        resultReady={hasResult}
        status={tool.intervention?.status ?? null}
        streamingContent={streamingContent}
        title={displayTitle}
        onApprove={onApprove}
        onOpenDetail={canOpenToolDetail ? handleOpenDetail : undefined}
        onReject={showApprovalButtons ? handleReject : undefined}
        onRejectAndContinue={onRejectAndContinue}
      />
    );
  },
);

ToolCallItem.displayName = 'ToolCallItem';

const ToolCallsBlock = memo<{
  assistantMessageId?: string;
  disableToolActions?: boolean;
  sessionId?: string;
  threadId?: string;
  toolActionHandlers?: ToolActionHandlers;
  topicId?: string;
  tools: ChatToolPayload[];
}>(
  ({
    tools,
    sessionId,
    threadId,
    topicId,
    assistantMessageId,
    disableToolActions = false,
    toolActionHandlers,
  }) => {
    const { t } = useI18n();
    const colors = useThemeColors();
    const chatAccent = useMemo(() => getChatAccent(colors), [colors]);
    const hasPending = tools.some((tool) => tool.intervention?.status === 'pending');
    const allCompleted = tools.every((tool) => isToolSettled(tool));
    const [expanded, setExpanded] = useState(true);
    const locale = useI18n((s) => s.locale);

    useEffect(() => {
      if (hasPending) {
        setExpanded(true);
        return;
      }

      if (allCompleted) {
        setExpanded(false);
      }
    }, [allCompleted, hasPending]);

    return (
      <View
        className="mb-2 rounded-2xl px-3 py-2"
        style={{
          backgroundColor: hasPending ? colors.primarySubtle : chatAccent.sectionBg,
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
                hasPending ? colors.primary : allCompleted ? colors.iconSuccess : colors.textGray
              }
            />
            <Text className="ml-2 text-[12px] font-medium" style={{ color: colors.secondaryText }}>
              {t.chatToolsTitle} ({tools.length})
            </Text>
            {hasPending && (
              <View
                className="ml-2 rounded-full px-2 py-0.5"
                style={{ backgroundColor: colors.primaryMuted }}
              >
                <Text className="text-[9px] font-semibold" style={{ color: colors.primary }}>
                  {t.chatToolPending}
                </Text>
              </View>
            )}
            {allCompleted && !hasPending && (
              <View
                className="ml-2 rounded-full px-2 py-0.5"
                style={{ backgroundColor: colors.successMuted }}
              >
                <Text className="text-[9px] font-semibold" style={{ color: colors.iconSuccess }}>
                  {t.chatToolCompleted || 'Done'}
                </Text>
              </View>
            )}
          </View>
          {expanded ? (
            <ChevronDown color={colors.iconMuted} size={14} strokeWidth={2.5} />
          ) : (
            <ChevronRight color={colors.iconMuted} size={14} strokeWidth={2.5} />
          )}
        </TouchableOpacity>

        {expanded ? (
          <View className="mt-3 gap-2">
            {tools.map((tool) => (
              <ToolCallItem
                assistantMessageId={assistantMessageId}
                disableToolActions={disableToolActions}
                key={tool.id}
                locale={locale}
                sessionId={sessionId}
                threadId={threadId}
                tool={tool}
                toolActionHandlers={toolActionHandlers}
                topicId={topicId}
              />
            ))}
          </View>
        ) : null}
      </View>
    );
  },
);

ToolCallsBlock.displayName = 'ToolCallsBlock';

const ToolResultBlock = memo<{
  disableToolActions?: boolean;
  message: ChatMessage;
  sessionId?: string;
  toolActionHandlers?: ToolActionHandlers;
  topicId?: string;
}>(({ message, sessionId, topicId, disableToolActions = false, toolActionHandlers }) => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const route = useRoute();
  const locale = useI18n((s) => s.locale);
  const toolName = message.plugin?.apiName || message.plugin?.identifier || 'Tool';
  const identifier = message.plugin?.identifier || '';
  const apiName = message.plugin?.apiName || '';
  const mergedArgsRef = useRef(message.plugin?.arguments || '{}');
  const beforeApproveCallbacksRef = useRef<Array<() => Promise<void>>>([]);
  const [_argsRenderKey, setArgsRenderKey] = useState(0);
  const toolPayload: Pick<ChatToolPayload, 'apiName' | 'arguments' | 'identifier'> = {
    apiName,
    arguments: message.plugin?.arguments || '',
    identifier: identifier || toolName,
  };
  const hasResult =
    !!message.content || !!message.pluginState || !!message.metadata?.tempDisplayContent?.length;
  const isPending = message.pluginIntervention?.status === 'pending';
  const hasError = !!message.pluginError;
  const { argumentsText, BuiltinRender, displayTitle, useBuiltinRender } = buildToolDisplayProps(
    toolPayload,
    toolName,
    locale,
    hasResult,
    isPending || hasError,
  );
  const parsedArgs = (() => {
    try {
      return JSON.parse(mergedArgsRef.current) as Record<string, unknown>;
    } catch {
      return {};
    }
  })();

  useEffect(() => {
    mergedArgsRef.current = message.plugin?.arguments || '{}';
    setArgsRenderKey((key) => key + 1);
  }, [message.plugin?.arguments]);

  const onArgsChange = useCallback((partial: Record<string, unknown>) => {
    let base: Record<string, unknown>;
    try {
      base = JSON.parse(mergedArgsRef.current) as Record<string, unknown>;
    } catch {
      base = {};
    }
    mergedArgsRef.current = JSON.stringify({ ...base, ...partial });
    setArgsRenderKey((key) => key + 1);
  }, []);

  const registerBeforeApprove = useCallback(
    (_hookId: string, callback: () => void | Promise<void>) => {
      const wrapped = () => Promise.resolve(callback());
      beforeApproveCallbacksRef.current.push(wrapped);
      return () => {
        beforeApproveCallbacksRef.current = beforeApproveCallbacksRef.current.filter(
          (fn) => fn !== wrapped,
        );
      };
    },
    [],
  );

  const BuiltinIntervention = getMobileBuiltinIntervention(identifier, apiName);
  const showIntervention =
    !disableToolActions && MOBILE_TOOL_INTERVENTION_ENABLED && isPending && BuiltinIntervention;
  const targetAssistantMessageId = message.parentId || message.id;
  const canOpenToolDetail = !!(
    message.content ||
    message.pluginState ||
    message.plugin?.arguments ||
    message.pluginError
  );
  const handleOpenDetail = useCallback(() => {
    if (!canOpenToolDetail) return;

    navigation.navigate(
      'ToolDetail',
      appendCurrentPortalStackWithOrigin(
        route.name,
        route.params,
        {
          apiName,
          arguments: message.plugin?.arguments,
          content: message.content,
          error: message.pluginError,
          identifier,
          pluginState:
            typeof message.pluginState === 'object' && message.pluginState
              ? (message.pluginState as Record<string, unknown>)
              : undefined,
          title: displayTitle,
          toolCallId: message.toolCallId ?? undefined,
        },
        {
          sessionId,
          ...(message.threadId ? { threadId: message.threadId } : {}),
          ...(topicId ? { topicId } : {}),
        },
      ),
    );
  }, [
    apiName,
    canOpenToolDetail,
    displayTitle,
    identifier,
    message.content,
    message.plugin?.arguments,
    message.pluginError,
    message.pluginState,
    message.threadId,
    message.toolCallId,
    navigation,
    route.name,
    route.params,
    sessionId,
    topicId,
  ]);

  const handleApprove = useCallback(async () => {
    const callbacks = [...beforeApproveCallbacksRef.current];
    for (const fn of callbacks) {
      await fn();
    }

    const approvedTool: ChatToolPayload = {
      apiName,
      arguments: mergedArgsRef.current || '{}',
      id: message.toolCallId || message.id,
      identifier: identifier || toolName,
      intervention: message.pluginIntervention ?? message.plugin?.intervention ?? undefined,
      pluginError:
        typeof message.pluginError === 'object' && message.pluginError
          ? message.pluginError
          : undefined,
      pluginState:
        typeof message.pluginState === 'object' && message.pluginState
          ? (message.pluginState as Record<string, unknown>)
          : undefined,
      result_content: message.content || undefined,
      result_msg_id: message.id,
      type: message.plugin?.type || 'function',
    };

    if (toolActionHandlers?.continueToolIntervention) {
      await toolActionHandlers.continueToolIntervention(targetAssistantMessageId, approvedTool);
      return;
    }

    if (!sessionId) return;

    await useChatStore
      .getState()
      .continueToolIntervention(sessionId, topicId, targetAssistantMessageId, approvedTool);
    await useChatStore.getState().fetchMessages(sessionId, topicId, { preserveOnEmpty: true });
  }, [
    apiName,
    identifier,
    message.content,
    message.id,
    message.plugin?.intervention,
    message.plugin?.type,
    message.pluginError,
    message.pluginIntervention,
    message.pluginState,
    message.toolCallId,
    sessionId,
    targetAssistantMessageId,
    toolName,
    toolActionHandlers,
    topicId,
  ]);

  const handleReject = useCallback(() => {
    if (toolActionHandlers?.rejectToolMessage) {
      void toolActionHandlers.rejectToolMessage(message.id);
      return;
    }

    if (!sessionId) return;
    useChatStore.getState().rejectToolMessage(sessionId, message.id);
  }, [message.id, sessionId, toolActionHandlers]);

  const handleRejectAndContinue = useCallback(async () => {
    if (toolActionHandlers?.rejectAndContinueToolIntervention) {
      await toolActionHandlers.rejectAndContinueToolIntervention(
        targetAssistantMessageId,
        message.toolCallId || message.id,
      );
      return;
    }

    if (!sessionId) return;

    await useChatStore.getState().rejectAndContinueToolIntervention(
      sessionId,
      topicId,
      targetAssistantMessageId,
      message.toolCallId || message.id,
    );
    await useChatStore.getState().fetchMessages(sessionId, topicId, { preserveOnEmpty: true });
  }, [
    message.id,
    message.toolCallId,
    sessionId,
    targetAssistantMessageId,
    toolActionHandlers,
    topicId,
  ]);

  const interventionContent =
    showIntervention && BuiltinIntervention ? (
      <BuiltinIntervention
        args={parsedArgs}
        registerBeforeApprove={registerBeforeApprove}
        onArgsChange={onArgsChange}
      />
    ) : undefined;

  const showApprovalButtons = !disableToolActions && MOBILE_TOOL_INTERVENTION_ENABLED && isPending;

  return (
    <ToolCard
      argumentsText={argumentsText || undefined}
      content={useBuiltinRender ? undefined : message.content || undefined}
      error={message.pluginError}
      interventionContent={interventionContent}
      resultReady={hasResult && !message.pluginError}
      status={message.pluginIntervention?.status ?? null}
      title={displayTitle}
      customContent={
        useBuiltinRender && BuiltinRender ? (
          <BuiltinRender
            apiName={apiName}
            arguments={message.plugin?.arguments}
            content={message.content}
            identifier={identifier}
            pluginState={message.pluginState as Record<string, unknown> | undefined}
            sessionId={sessionId}
            threadId={message.threadId ?? undefined}
            toolCallId={message.toolCallId ?? undefined}
            topicId={topicId}
          />
        ) : undefined
      }
      onApprove={showApprovalButtons ? handleApprove : undefined}
      onOpenDetail={canOpenToolDetail ? handleOpenDetail : undefined}
      onReject={showApprovalButtons ? handleReject : undefined}
      onRejectAndContinue={showApprovalButtons ? handleRejectAndContinue : undefined}
    />
  );
});

ToolResultBlock.displayName = 'ToolResultBlock';

const AssistantChainMessageItem = memo<{
  childMessage: ChatMessage;
  disableToolActions?: boolean;
  markdownRules?: Record<string, any>;
  markdownStyles: Record<string, any>;
  onOpenLink: (url?: string) => void;
  reasoningMarkdownStyles: Record<string, any>;
  sessionId: string;
  t: I18nStore['t'];
  toolActionHandlers?: ToolActionHandlers;
  topicId?: string;
}>(
  ({
    childMessage,
    disableToolActions = false,
    markdownRules,
    markdownStyles,
    onOpenLink,
    reasoningMarkdownStyles,
    sessionId,
    t,
    toolActionHandlers,
    topicId,
  }) => {
    const {
      artifactSegments,
      hasSearch,
      multimodalContentParts,
      multimodalReasoningParts,
      renderedReasoning,
      textContent,
    } = useMemo(
      () => prepareMessageRenderContent(childMessage, t.groupMentionAllMembers),
      [childMessage, t.groupMentionAllMembers],
    );

    return (
      <View className="gap-2">
        {hasSearch && childMessage.search ? <SearchGroundingBlock search={childMessage.search} /> : null}

        {renderedReasoning ? (
          <ThinkingBlock
            content={renderedReasoning}
            duration={childMessage.reasoning?.duration}
            isMultimodal={childMessage.reasoning?.isMultimodal}
            markdownRules={markdownRules}
            markdownStyles={reasoningMarkdownStyles}
            model={childMessage.model}
            searchCitations={childMessage.search?.citations}
            searchImageResults={childMessage.search?.imageResults}
            tempDisplayContent={multimodalReasoningParts || undefined}
          />
        ) : null}

        {multimodalContentParts?.length ? (
          <RichContentPartsBlock
            citations={childMessage.search?.citations}
            imageResults={childMessage.search?.imageResults}
            markdownRules={markdownRules}
            markdownStyles={markdownStyles}
            model={childMessage.model}
            parts={multimodalContentParts}
            onOpenLink={onOpenLink}
          />
        ) : textContent ? (
          <Markdown
            rules={markdownRules}
            style={markdownStyles}
            onLinkPress={(url) => {
              onOpenLink(url);
              return false;
            }}
          >
            {textContent}
          </Markdown>
        ) : null}

        {artifactSegments?.map((segment, index) =>
          segment.type === 'artifact' ? (
            <ArtifactBlock
              artifactType={segment.artifactType}
              content={segment.content}
              key={`${childMessage.id}-artifact-${index}`}
              language={segment.language}
              title={segment.title}
            />
          ) : null,
        )}

        {childMessage.tools?.length ? (
          <ToolCallsBlock
            assistantMessageId={childMessage.id}
            disableToolActions={disableToolActions}
            sessionId={sessionId}
            toolActionHandlers={toolActionHandlers}
            tools={childMessage.tools}
            topicId={topicId}
          />
        ) : null}

        {childMessage.search?.citations?.length ? (
          <CitationFootnotesBlock
            citations={childMessage.search.citations}
            onOpenLink={onOpenLink}
          />
        ) : null}
      </View>
    );
  },
);

AssistantChainMessageItem.displayName = 'AssistantChainMessageItem';

const AssistantChainBlock = memo<{
  childrenMessages: ChatMessage[];
  disableToolActions?: boolean;
  markdownRules?: Record<string, any>;
  markdownStyles: Record<string, any>;
  onOpenLink: (url?: string) => void;
  reasoningMarkdownStyles: Record<string, any>;
  sessionId: string;
  t: I18nStore['t'];
  toolActionHandlers?: ToolActionHandlers;
  topicId?: string;
}>(
  ({
    childrenMessages,
    disableToolActions = false,
    markdownRules,
    markdownStyles,
    onOpenLink,
    reasoningMarkdownStyles,
    sessionId,
    t,
    toolActionHandlers,
    topicId,
  }) => {
    return (
      <View className="gap-3">
        {childrenMessages.map((childMessage) => (
          <AssistantChainMessageItem
            childMessage={childMessage}
            disableToolActions={disableToolActions}
            key={childMessage.id}
            markdownRules={markdownRules}
            markdownStyles={markdownStyles}
            reasoningMarkdownStyles={reasoningMarkdownStyles}
            sessionId={sessionId}
            t={t}
            toolActionHandlers={toolActionHandlers}
            topicId={topicId}
            onOpenLink={onOpenLink}
          />
        ))}
      </View>
    );
  },
);

AssistantChainBlock.displayName = 'AssistantChainBlock';

// ── UsageStatsModal ──

interface UsageStatsModalProps {
  model?: string;
  onClose: () => void;
  performance?: ChatMessage['performance'];
  usage: NonNullable<ChatMessage['usage']>;
}

const UsageStatsModal = memo<UsageStatsModalProps>(({ usage, performance, model, onClose }) => {
  const { t } = useI18n();
  const colors = useThemeColors();

  const uncached =
    usage.inputCacheMissTokens ?? (usage.totalInputTokens ?? 0) - (usage.inputCachedTokens ?? 0);
  const cached = usage.inputCachedTokens ?? 0;
  const output = usage.totalOutputTokens ?? 0;
  const total = usage.totalTokens ?? 0;
  const tps = performance?.tps;
  const ttft = performance?.ttft;

  const rows: [string, string, string?][] = [
    [t.msgStatUncachedInput, uncached.toLocaleString(), colors.tertiaryText],
    [t.msgStatCachedInput, cached.toLocaleString(), colors.cachedToken],
    [t.msgStatOutput, output.toLocaleString(), colors.iconSuccess],
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
        style={{ backgroundColor: colors.modalOverlay }}
        onPress={onClose}
      >
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View
            className="rounded-2xl p-5 mx-8"
            style={{ minWidth: 280, backgroundColor: colors.modalDarkBg }}
          >
            {/* Progress bar */}
            <View
              className="h-2 rounded-full overflow-hidden flex-row mb-4"
              style={{ backgroundColor: colors.progressBarTrack }}
            >
              {total > 0 && (
                <>
                  <View
                    style={{
                      flex: uncached / total,
                      backgroundColor: colors.tertiaryText,
                      borderRadius: 4,
                    }}
                  />
                  <View
                    style={{
                      flex: cached / total,
                      backgroundColor: colors.cachedToken,
                      borderRadius: 4,
                    }}
                  />
                  <View
                    style={{
                      flex: output / total,
                      backgroundColor: colors.iconSuccess,
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
  markdownRules?: Record<string, any>;
  markdownStyles: Record<string, any>;
  model?: string;
  searchCitations?: CitationItem[] | null;
  searchImageResults?: ImageCitationItem[] | null;
  tempDisplayContent?: MessageContentPart[];
  thinking?: boolean;
}

const ThinkingBlock = memo<ThinkingBlockProps>(
  ({
    content,
    duration,
    isMultimodal,
    markdownRules,
    markdownStyles,
    searchCitations,
    searchImageResults,
    tempDisplayContent,
    thinking,
  }) => {
    const { t } = useI18n();
    const colors = useThemeColors();
    const chatAccent = useMemo(() => getChatAccent(colors), [colors]);
    const [expanded, setExpanded] = useState(thinking ?? false);

    useEffect(() => {
      setExpanded(!!thinking);
    }, [thinking]);

    const durationLabel = duration
      ? `${t.chatThoughtWithDuration} ${(duration / 1000).toFixed(1)}s`
      : t.chatThought;

    const hasRenderableReasoning = !!content || !!tempDisplayContent?.length;
    const showContent = (expanded || thinking) && hasRenderableReasoning;

    return (
      <View className="mb-2">
        <TouchableOpacity
          activeOpacity={0.7}
          className="flex-row items-center py-1"
          onPress={() => !thinking && setExpanded((v) => !v)}
        >
          {thinking ? (
            <ActivityIndicator color={colors.primary} size={12} style={{ marginRight: 4 }} />
          ) : expanded ? (
            <ChevronDown color={colors.iconMuted} size={14} strokeWidth={2.5} />
          ) : (
            <ChevronRight color={colors.iconMuted} size={14} strokeWidth={2.5} />
          )}
          {thinking ? (
            <Text className="text-[12px] font-medium ml-1" style={{ color: colors.primary }}>
              {t.chatThinking}
            </Text>
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
                citations={searchCitations}
                imageResults={searchImageResults}
                markdownRules={markdownRules}
                markdownStyles={markdownStyles}
                parts={tempDisplayContent}
                onOpenLink={(url) => {
                  if (!url) return;
                  Linking.openURL(url).catch(() => undefined);
                }}
              />
            ) : (
              <Markdown
                rules={markdownRules ?? codeInlineRules}
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
  const colors = useThemeColors();
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
    <View className="mt-2 rounded-2xl px-3 py-3" style={{ backgroundColor: colors.dangerMuted }}>
      <View className="flex-row items-center mb-1">
        <AlertTriangle color={colors.danger} size={14} strokeWidth={2} />
        <Text className="ml-1.5 text-[13px] font-semibold flex-1" style={{ color: colors.danger }}>
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
            <Text className="text-[11px] font-medium" style={{ color: colors.danger }}>
              {showBody ? t.chatShowLess : t.chatShowMore}
            </Text>
          </TouchableOpacity>
          {showBody && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <Text
                selectable
                className="mt-1 rounded-xl px-3 py-2 text-[11px] leading-4 text-foreground/50"
                style={{
                  backgroundColor: colors.dangerSubtle,
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
          style={{ backgroundColor: colors.dangerMuted }}
          onPress={onRetry}
        >
          <Text className="text-[12px] font-semibold" style={{ color: colors.danger }}>
            {t.retry}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
});

ErrorBlock.displayName = 'ErrorBlock';

export default MessageBubble;
