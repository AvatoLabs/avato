import React from 'react';
import { View, Text, Switch, TouchableOpacity, ScrollView } from 'react-native';
import { useColorScheme } from 'nativewind';
import { Settings, User, Bell, Shield, LogOut, Info } from 'lucide-react-native';

export default function ProfileScreen() {
  const { colorScheme, toggleColorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const ListItem = ({ icon: Icon, title, rightElement, border = true }: any) => (
    <View className={`flex-row items-center justify-between px-4 py-3 ${border ? 'border-b border-border/40' : ''}`}>
      <View className="flex-row items-center">
        <View className="w-8 h-8 rounded-full bg-primary/10 items-center justify-center mr-3">
          <Icon size={18} color="#007aff" />
        </View>
        <Text className="text-base text-foreground font-medium">{title}</Text>
      </View>
      {rightElement || <Text className="text-border text-lg">{'>'}</Text>}
    </View>
  );

  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Header Profile Info */}
      <View className="items-center py-8">
        <View className="w-24 h-24 rounded-full bg-primary/20 items-center justify-center mb-4">
          <User size={40} color="#007aff" />
        </View>
        <Text className="text-2xl font-bold text-foreground mb-1">Local User</Text>
        <Text className="text-secondary text-base">local@localhost</Text>
      </View>

      {/* Settings Sections */}
      <View className="px-4">
        <Text className="text-secondary text-sm font-semibold mb-2 ml-2 uppercase">Preferences</Text>
        <View className="bg-card rounded-2xl overflow-hidden mb-6 border border-border/50">
          <ListItem
            icon={Settings}
            title="Dark Mode"
            rightElement={
              <Switch
                value={isDark}
                onValueChange={toggleColorScheme}
                trackColor={{ false: '#d9d9d9', true: '#007aff' }}
              />
            }
          />
          <ListItem icon={Bell} title="Notifications" border={false} />
        </View>

        <Text className="text-secondary text-sm font-semibold mb-2 ml-2 uppercase">About</Text>
        <View className="bg-card rounded-2xl overflow-hidden mb-6 border border-border/50">
          <ListItem icon={Shield} title="Privacy Policy" />
          <ListItem icon={Info} title="Version 1.0.0 (MinkHub Mobile MVP)" border={false} />
        </View>

        <TouchableOpacity className="bg-card rounded-2xl border border-border/50 py-4 items-center active:bg-foreground/5 mb-6">
          <Text className="text-red-500 font-bold text-base">Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
