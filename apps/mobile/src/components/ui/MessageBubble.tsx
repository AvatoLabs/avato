/**
 * MessageBubble — Renders a single chat message with long-press support.
 */
import { User } from 'lucide-react-native';
import React, { memo, useCallback, useState } from 'react';
import {
  Alert,
  Image as RNImage,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { haptics } from '../../lib/haptics';
import { useI18n } from '../../lib/i18n';
import { useChatStore } from '../../store/chat';
import { tokens } from '../../theme/tokens';
import type { ChatMessage } from '../../types';
import MessageActionSheet from './MessageActionSheet';
import { useToast } from './Toast';
import TypingIndicator from './TypingIndicator';

interface MessageBubbleProps {
  generating?: boolean;
  message: ChatMessage;
  sessionId: string;
}

const MessageBubble = memo<MessageBubbleProps>(({ message, sessionId, generating }) => {
  const isUser = message.role === 'user';
  const { t } = useI18n();
  const toast = useToast();

  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);

  const deleteMessage = useChatStore((s) => s.deleteMessage);
  const editMessage = useChatStore((s) => s.editMessage);
  const regenerateMessage = useChatStore((s) => s.regenerateMessage);

  const handleLongPress = useCallback(() => {
    if (!generating) {
      haptics.medium();
      setActionSheetVisible(true);
    }
  }, [generating]);

  const handleCopy = useCallback(() => {
    // Handled inside ActionSheet
  }, []);

  const handleEdit = useCallback(() => {
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

  const mc = tokens.markdownColors;

  const markdownStyles = {
    body: {
      color: mc.text,
      fontSize: 15.5,
      lineHeight: 24,
    },
    code_inline: {
      backgroundColor: mc.codeInlineBg,
      borderRadius: 6,
      color: mc.codeInlineColor,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 13.5,
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
      fontSize: 22,
      fontWeight: '700' as const,
      marginBottom: 8,
      marginTop: 12,
    },
    heading2: {
      color: mc.heading,
      fontSize: 18,
      fontWeight: '600' as const,
      marginBottom: 6,
      marginTop: 10,
    },
    list_item: { marginBottom: 4 },
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
  };

  return (
    <>
      <Animated.View
        entering={
          isUser ? FadeInUp.duration(250).springify() : FadeInDown.duration(250).springify()
        }
      >
        <TouchableOpacity activeOpacity={0.8} delayLongPress={300} onLongPress={handleLongPress}>
          <View className={`flex-row w-full mb-5 px-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
            {!isUser && (
              <View className="w-9 h-9 mt-0.5 rounded-full bg-foreground/5 items-center justify-center mr-3 overflow-hidden">
                <RNImage
                  className="w-7 h-7 rounded-lg"
                  source={require('../../../assets/icon.png')}
                />
              </View>
            )}

            <View
              className={`max-w-[78%] px-4 py-3 ${
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
                    className="text-foreground text-[15.5px] leading-6 min-h-[40px]"
                    value={editText}
                    onBlur={handleEditSubmit}
                    onChangeText={setEditText}
                    onSubmitEditing={handleEditSubmit}
                  />
                  <View className="flex-row justify-end mt-2 gap-2">
                    <TouchableOpacity
                      className="px-3 py-1.5 rounded-lg bg-foreground/10"
                      onPress={() => setIsEditing(false)}
                    >
                      <Text className="text-secondary text-xs font-medium">{t.editCancel}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className="px-3 py-1.5 rounded-lg bg-primary"
                      onPress={handleEditSubmit}
                    >
                      <Text className="text-white text-xs font-medium">{t.editSave}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : !message.content && generating ? (
                <TypingIndicator color="#636366" />
              ) : (
                <Markdown style={isUser ? userMarkdownStyles : markdownStyles}>
                  {message.content || ''}
                </Markdown>
              )}
            </View>

            {isUser && (
              <View className="w-9 h-9 mt-0.5 rounded-full bg-foreground/5 items-center justify-center ml-3">
                <User color="#555" size={18} strokeWidth={tokens.icon.strokeWidth} />
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>

      <MessageActionSheet
        content={message.content}
        messageId={message.id}
        role={message.role}
        visible={actionSheetVisible}
        onClose={() => setActionSheetVisible(false)}
        onCopy={handleCopy}
        onDelete={handleDelete}
        onEdit={handleEdit}
        onRegenerate={handleRegenerate}
      />
    </>
  );
});

MessageBubble.displayName = 'MessageBubble';

export default MessageBubble;
