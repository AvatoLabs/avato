import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Compass, Bot, Sparkles, Code } from 'lucide-react-native';

const DISCOVER_ITEMS = [
  { id: '1', title: 'Code Assistant', desc: 'Expert in debugging and refactoring', icon: Code, color: '#007aff' },
  { id: '2', title: 'Creative Writer', desc: 'Brainstorm marketing copy and stories', icon: Sparkles, color: '#34c759' },
  { id: '3', title: 'General AI', desc: 'Default versatile assistant', icon: Bot, color: '#ff9500' },
];

export default function DiscoverScreen() {
  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 16 }}>
      {/* Header */}
      <View className="mb-6 mt-2">
        <Text className="text-3xl font-extrabold text-foreground tracking-tight">Discover</Text>
        <Text className="text-secondary text-base mt-1">
          Explore AI assistants and community agents
        </Text>
      </View>

      {/* Featured Card */}
      <View className="bg-primary/10 rounded-3xl p-6 mb-6">
        <Compass size={32} color="#007aff" className="mb-4" />
        <Text className="text-foreground text-xl font-bold mb-2">Community Market</Text>
        <Text className="text-secondary text-sm leading-5">
          Find hundreds of specialized AI agents created by the MinkHub community.
        </Text>
        <TouchableOpacity className="mt-4 bg-primary self-start px-5 py-2 rounded-full">
          <Text className="text-white font-bold">Browse All</Text>
        </TouchableOpacity>
      </View>

      {/* Recommended List */}
      <Text className="text-foreground text-lg font-bold mb-4 ml-1">Recommended</Text>
      <View className="bg-card rounded-2xl overflow-hidden border border-border/50">
        {DISCOVER_ITEMS.map((item, index) => (
          <TouchableOpacity
            key={item.id}
            className={`flex-row items-center p-4 ${index !== DISCOVER_ITEMS.length - 1 ? 'border-b border-border/40' : ''}`}
          >
            <View className="w-12 h-12 rounded-full items-center justify-center mr-4" style={{ backgroundColor: `${item.color}20` }}>
              <item.icon size={24} color={item.color} />
            </View>
            <View className="flex-1">
              <Text className="text-foreground text-base font-bold mb-1">{item.title}</Text>
              <Text className="text-secondary text-sm">{item.desc}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}
