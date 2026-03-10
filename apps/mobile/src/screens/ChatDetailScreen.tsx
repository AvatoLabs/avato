import { Bot, Send, User } from 'lucide-react-native';
import React, { useEffect,useRef, useState } from 'react';
import {
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View} from 'react-native';

import type { ChatMessage} from '../store/chat';
import {useChatStore } from '../store/chat';

export default function ChatDetailScreen({ route, navigation }: any) {
  const sessionId = route.params?.sessionId || 'default';

  const messages = useChatStore((state) => state.messages[sessionId] || []);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const session = useChatStore((state) => state.sessions.find(s => s.id === sessionId));

  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (session) {
      navigation.setOptions({ title: session.title });
    }
  }, [session, navigation]);

  const handleSend = () => {
    if (!inputText.trim()) return;
    sendMessage(sessionId, inputText.trim());
    setInputText('');
    Keyboard.dismiss();
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';

    return (
      <View className={`flex-row w-full mb-4 px-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
        {!isUser && (
          <View className="w-8 h-8 rounded-full bg-primary/10 items-center justify-center mr-2 mt-1">
            <Bot color="#007aff" size={18} />
          </View>
        )}

        <View className={`max-w-[75%] rounded-2xl px-4 py-3 ${
          isUser ? 'bg-primary rounded-tr-sm' : 'bg-card border border-border/50 rounded-tl-sm'
        }`}>
          <Text className={`text-base leading-6 ${isUser ? 'text-white' : 'text-foreground'}`}>
            {item.content}
          </Text>
        </View>

        {isUser && (
          <View className="w-8 h-8 rounded-full bg-foreground/10 items-center justify-center ml-2 mt-1">
            <User className="text-foreground" color="#666" size={18} />
          </View>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-background"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <FlatList
        contentContainerStyle={{ paddingVertical: 16 }}
        data={messages}
        keyExtractor={(item) => item.id}
        ref={flatListRef}
        renderItem={renderMessage}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center py-10 mt-10">
            <View className="w-16 h-16 bg-primary/10 rounded-full items-center justify-center mb-4">
              <Bot color="#007aff" size={32} />
            </View>
            <Text className="text-foreground font-semibold text-lg">MinkHub Assistant</Text>
            <Text className="text-secondary text-sm mt-2 text-center px-10">
              I'm here to help. Send a message to start our conversation!
            </Text>
          </View>
        }
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      {/* Input Area */}
      <View className="flex-row items-end p-3 bg-card border-t border-border pb-safe">
        <TextInput
          multiline
          className="flex-1 bg-background border border-border rounded-2xl px-4 py-3 text-foreground min-h-[44px] max-h-32 text-base leading-5"
          placeholder="Type a message..."
          placeholderTextColor="#8c8c8c"
          value={inputText}
          onChangeText={setInputText}
        />
        <TouchableOpacity
          disabled={!inputText.trim()}
          className={`ml-3 p-3 rounded-full items-center justify-center ${
            inputText.trim() ? 'bg-primary' : 'bg-primary/50'
          }`}
          onPress={handleSend}
        >
          <Send color="#fff" size={20} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
