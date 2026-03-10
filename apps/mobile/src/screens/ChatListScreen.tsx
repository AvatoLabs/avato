import { MessageSquare,MessageSquarePlus } from 'lucide-react-native';
import React from 'react';
import { FlatList, Image,Text, TouchableOpacity, View } from 'react-native';

import { useChatStore } from '../store/chat';

export default function ChatListScreen({ navigation }: any) {
  const sessions = useChatStore((state) => state.sessions);
  const createSession = useChatStore((state) => state.createSession);

  const handleCreateChat = () => {
    const newId = createSession('New Conversation');
    navigation.navigate('ChatDetail', { sessionId: newId });
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      className="flex-row items-center px-4 py-3 border-b border-border/40 active:bg-foreground/5"
      onPress={() => navigation.navigate('ChatDetail', { sessionId: item.id })}
    >
      <View className="w-12 h-12 bg-primary/10 rounded-full items-center justify-center mr-4">
        {item.avatar ? (
          <Image className="w-12 h-12 rounded-full" source={{ uri: item.avatar }} />
        ) : (
          <MessageSquare color="#007aff" size={24} />
        )}
      </View>
      <View className="flex-1 justify-center">
        <Text className="text-base font-semibold text-foreground mb-1" numberOfLines={1}>
          {item.title}
        </Text>
        <Text className="text-secondary text-sm" numberOfLines={1}>
          {item.description || 'No messages yet...'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border bg-card shadow-sm z-10">
        <Text className="text-2xl font-bold text-foreground tracking-tight">Chats</Text>
        <TouchableOpacity
          className="p-2 bg-primary/10 rounded-full active:bg-primary/20"
          onPress={handleCreateChat}
        >
          <MessageSquarePlus color="#007aff" size={22} />
        </TouchableOpacity>
      </View>

      {/* List */}
      <FlatList
        contentContainerStyle={{ flexGrow: 1 }}
        data={sessions}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center p-8">
            <Text className="text-secondary text-base text-center">No active chats yet.</Text>
            <TouchableOpacity
              className="mt-6 px-6 py-3 bg-primary rounded-xl active:bg-primary/80"
              onPress={handleCreateChat}
            >
              <Text className="text-white font-bold text-base">Start a Conversation</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}
