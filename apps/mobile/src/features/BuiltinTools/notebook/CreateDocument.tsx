/**
 * Notebook CreateDocument Render — RN version of lobe-notebook CreateDocument.
 * Displays created document (title, content) from pluginState or parsed content.
 */
import { useRoute } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { Copy, FileText } from 'lucide-react-native';
import React, { memo, useMemo, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import Markdown from 'react-native-markdown-display';

import { haptics } from '../../../lib/haptics';
import { useI18n } from '../../../lib/i18n';
import { codeInlineRules } from '../../../lib/markdownRules';
import { getThemedMarkdownStyles } from '../../../lib/markdownStyles';
import { navigateToNotebook } from '../../../lib/navigation';
import {
  appendCurrentPortalStackWithOrigin,
  createConversationOrigin,
} from '../../../lib/portalNavigation';
import { useThemeColors } from '../../../theme/colors';
import type { MobileBuiltinRenderProps } from '../types';

interface NotebookDocument {
  content?: string;
  description?: string;
  id?: string;
  title: string;
  type?: string;
}

function parseDocument(
  content?: string,
  pluginState?: Record<string, unknown>,
): NotebookDocument | null {
  const doc = pluginState?.document as NotebookDocument | undefined;
  if (doc?.title) return doc;
  if (content) {
    try {
      const parsed = JSON.parse(content) as {
        document?: NotebookDocument;
        state?: { document?: NotebookDocument };
      };
      const d = parsed.document ?? parsed.state?.document;
      return d?.title ? d : null;
    } catch {
      return null;
    }
  }
  return null;
}

const MAX_CONTENT_HEIGHT = 200;

const CreateDocumentRender = memo<MobileBuiltinRenderProps>(
  ({ content, pluginState, sessionId, threadId, topicId }) => {
    const { t } = useI18n();
    const colors = useThemeColors();
    const route = useRoute();
    const [copied, setCopied] = useState(false);
    const document = useMemo(() => parseDocument(content, pluginState), [content, pluginState]);
    const markdownStyles = useMemo(() => getThemedMarkdownStyles(colors), [colors]);
    const conversationOrigin = createConversationOrigin({ sessionId, threadId, topicId });

    if (!document) return null;

    const handleCopy = async () => {
      if (document.content) {
        await Clipboard.setStringAsync(document.content);
        haptics.success();
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    };

    const handleOpen = () => {
      if (!document.id) return;

      haptics.light();
      navigateToNotebook(
        appendCurrentPortalStackWithOrigin(
          route.name,
          route.params,
          {
            documentId: document.id,
          },
          conversationOrigin,
        ),
      );
    };

    return (
      <View
        className="rounded-xl border overflow-hidden"
        style={{
          backgroundColor: colors.background,
          borderColor: colors.border,
        }}
      >
        <View
          className="flex-row items-center gap-2 px-3 py-2.5"
          style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}
        >
          <FileText color={colors.primary} size={16} strokeWidth={2} />
          <Text
            className="flex-1 text-[14px] font-semibold"
            numberOfLines={1}
            style={{ color: colors.foreground }}
          >
            {document.title}
          </Text>
          {document.content ? (
            <TouchableOpacity
              activeOpacity={0.7}
              hitSlop={{ bottom: 8, left: 8, right: 8, top: 8 }}
              onPress={handleCopy}
            >
              {copied ? (
                <Text className="text-[11px] font-medium" style={{ color: colors.iconSuccess }}>
                  {t.toastCopied}
                </Text>
              ) : (
                <Copy color={colors.iconMuted} size={14} strokeWidth={2} />
              )}
            </TouchableOpacity>
          ) : null}
        </View>
        {document.description ? (
          <Text
            className="px-3 py-2 text-[12px]"
            numberOfLines={2}
            style={{ color: colors.secondaryText }}
          >
            {document.description}
          </Text>
        ) : null}
        {document.content ? (
          <ScrollView
            className="px-3 pb-3"
            showsVerticalScrollIndicator={false}
            style={{ maxHeight: MAX_CONTENT_HEIGHT }}
          >
            <Markdown rules={codeInlineRules as any} style={markdownStyles}>
              {document.content}
            </Markdown>
          </ScrollView>
        ) : null}
        {document.id ? (
          <TouchableOpacity activeOpacity={0.7} className="px-3 pb-3 pt-1" onPress={handleOpen}>
            <Text className="text-[12px] font-medium" style={{ color: colors.primary }}>
              {t.fileOpen}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  },
);

CreateDocumentRender.displayName = 'NotebookCreateDocumentRender';

export default CreateDocumentRender;
