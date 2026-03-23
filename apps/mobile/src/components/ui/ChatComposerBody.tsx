/**
 * ChatComposerBody — Shared input + toolbar inside ComposerShell (home Chats tab vs ChatDetail).
 * Keeps layout/spacing consistent; screens own data and sheet wiring.
 */
import {
  Brain,
  BrainCircuit,
  Cpu,
  Eraser,
  Globe,
  Paperclip,
  Puzzle,
  Send,
  Square,
} from 'lucide-react-native';
import React from 'react';
import { Image as RNImage, TextInput, TouchableOpacity, View, type ViewStyle } from 'react-native';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';

import { useThemeColors } from '../../theme/colors';
import { tokens } from '../../theme/tokens';
import {
  ComposerCountBadge,
  ComposerIconButton,
  ComposerPrimaryAction,
  ComposerShell,
} from './ComposerShell';
import { GroupMentionInput, type MentionMember } from './GroupMentionInput';

export type ChatComposerVariant = 'home' | 'detailPersonal' | 'detailGroup';

export interface ChatComposerBodyProps {
  active?: boolean;
  canSend: boolean;
  generating?: boolean;
  groupMembers?: MentionMember[];
  memoryEnabled: boolean;
  modelDrawerVisible: boolean;

  onAttach: () => void;

  onChangeText: (text: string) => void;
  /** ChatDetail only (clears messages in current topic). */
  onClear?: () => void;
  onMemoryPress: () => void;
  onModelPress: () => void;
  onPluginsPress: () => void;
  onProviderLogoError: () => void;
  onSend: () => void;
  onStop?: () => void;
  onToggleSearch: () => void;
  pendingFilesCount: number;

  placeholder: string;
  pluginsEnabled: boolean;
  providerLogoError: boolean;

  searchEnabled: boolean;

  sendAnimStyle?: AnimatedStyle<ViewStyle>;
  textEditable?: boolean;
  toolbarProviderLogo?: string | null;
  /** File preview row above the input (e.g. pending attachments). */
  topSlot?: React.ReactNode;
  value: string;

  variant: ChatComposerVariant;
}

const INPUT_CLASS = 'text-foreground text-[16px] leading-[22px] min-h-[36px] max-h-28';

export function ChatComposerBody({
  topSlot,
  placeholder,
  value,
  onChangeText,
  textEditable = true,
  groupMembers,
  variant,
  modelDrawerVisible,
  onModelPress,
  searchEnabled,
  onToggleSearch,
  pendingFilesCount,
  onAttach,
  pluginsEnabled,
  onPluginsPress,
  memoryEnabled,
  onMemoryPress,
  toolbarProviderLogo,
  providerLogoError,
  onProviderLogoError,
  onClear,
  generating = false,
  onStop,
  canSend,
  onSend,
  sendAnimStyle,
  active = false,
}: ChatComposerBodyProps) {
  const colors = useThemeColors();
  const primary = colors.primary;
  const actionSize = tokens.mobile.heights.composerAction;

  const showSeparatorAndClear = variant === 'detailPersonal' || variant === 'detailGroup';

  const renderModelSearch = () => (
    <View style={{ alignItems: 'center', flexDirection: 'row', flexShrink: 1 }}>
      <ComposerIconButton
        accessibilityLabel="Select model"
        active={modelDrawerVisible}
        containerStyle={{ marginRight: 6 }}
        onPress={onModelPress}
      >
        {toolbarProviderLogo && !providerLogoError ? (
          <RNImage
            source={{ uri: toolbarProviderLogo }}
            style={{ width: 16, height: 16, borderRadius: 4 }}
            onError={onProviderLogoError}
          />
        ) : (
          <Cpu
            color={modelDrawerVisible ? primary : colors.secondaryText}
            size={16}
            strokeWidth={tokens.icon.strokeWidth}
          />
        )}
      </ComposerIconButton>
      <ComposerIconButton
        accessibilityLabel="Toggle search"
        active={searchEnabled}
        containerStyle={{ marginLeft: 6 }}
        onPress={onToggleSearch}
      >
        <Globe
          color={searchEnabled ? primary : colors.muted}
          size={18}
          strokeWidth={tokens.icon.strokeWidth}
        />
      </ComposerIconButton>
    </View>
  );

  const renderAttach = (attachMarginLeft: number) => (
    <ComposerIconButton
      accessibilityLabel="Attach file"
      active={pendingFilesCount > 0}
      containerStyle={{ marginLeft: attachMarginLeft }}
      badge={
        pendingFilesCount > 0 ? (
          <ComposerCountBadge
            color={colors.primary}
            value={pendingFilesCount > 9 ? '9+' : pendingFilesCount}
          />
        ) : null
      }
      onPress={onAttach}
    >
      <Paperclip
        color={pendingFilesCount > 0 ? primary : colors.muted}
        size={18}
        strokeWidth={tokens.icon.strokeWidth}
      />
    </ComposerIconButton>
  );

  const renderPluginsMemory = () => (
    <>
      <ComposerIconButton
        accessibilityLabel="Toggle tools"
        active={pluginsEnabled}
        containerStyle={{ marginLeft: 6 }}
        onPress={onPluginsPress}
      >
        <Puzzle
          color={pluginsEnabled ? primary : colors.muted}
          size={18}
          strokeWidth={tokens.icon.strokeWidth}
        />
      </ComposerIconButton>
      <ComposerIconButton
        accessibilityLabel="Toggle memory"
        active={memoryEnabled}
        containerStyle={{ marginLeft: 6 }}
        onPress={onMemoryPress}
      >
        {memoryEnabled ? (
          <BrainCircuit color={primary} size={18} strokeWidth={tokens.icon.strokeWidth} />
        ) : (
          <Brain color={colors.muted} size={18} strokeWidth={tokens.icon.strokeWidth} />
        )}
      </ComposerIconButton>
    </>
  );

  return (
    <ComposerShell active={active}>
      {topSlot}
      <View className="px-3 pt-2">
        {groupMembers && groupMembers.length > 0 ? (
          <GroupMentionInput
            accessibilityLabel={placeholder}
            className={INPUT_CLASS}
            editable={textEditable}
            members={groupMembers}
            placeholder={placeholder}
            style={{ paddingVertical: 0, textAlignVertical: 'top' }}
            value={value}
            onChangeText={onChangeText}
          />
        ) : (
          <TextInput
            multiline
            accessibilityLabel={placeholder}
            className={INPUT_CLASS}
            editable={textEditable}
            placeholder={placeholder}
            placeholderTextColor={colors.secondaryText}
            style={{ paddingVertical: 0, textAlignVertical: 'top' }}
            underlineColorAndroid="transparent"
            value={value}
            onChangeText={onChangeText}
          />
        )}
      </View>
      <View className="px-2 pb-1.5 pt-1" style={{ alignItems: 'center', flexDirection: 'row' }}>
        {variant === 'detailGroup' ? (
          <View style={{ alignItems: 'center', flexDirection: 'row', flexShrink: 1 }}>
            {renderAttach(0)}
          </View>
        ) : (
          <View style={{ alignItems: 'center', flexDirection: 'row', flexShrink: 1 }}>
            {renderModelSearch()}
            {renderAttach(6)}
            {renderPluginsMemory()}
          </View>
        )}

        {showSeparatorAndClear && (
          <>
            <View
              style={{
                backgroundColor: colors.borderSubtle,
                height: 16,
                marginHorizontal: 8,
                width: 1,
              }}
            />
            {onClear ? (
              <ComposerIconButton accessibilityLabel="Clear messages" onPress={onClear}>
                <Eraser color={colors.muted} size={18} strokeWidth={tokens.icon.strokeWidth} />
              </ComposerIconButton>
            ) : null}
          </>
        )}

        <View className="flex-1" />

        {generating && onStop ? (
          <Animated.View style={sendAnimStyle}>
            <TouchableOpacity
              activeOpacity={0.7}
              className="rounded-full items-center justify-center"
              style={{
                backgroundColor: colors.muted,
                height: actionSize,
                width: actionSize,
              }}
              onPress={onStop}
            >
              <Square
                color={colors.iconOnPrimary}
                fill={colors.iconOnPrimary}
                size={12}
                strokeWidth={0}
              />
            </TouchableOpacity>
          </Animated.View>
        ) : canSend ? (
          <Animated.View style={sendAnimStyle}>
            <ComposerPrimaryAction active onPress={onSend}>
              <Send
                color={colors.iconOnPrimary}
                size={16}
                strokeWidth={tokens.icon.strokeWidth}
                style={{ marginLeft: 1 }}
              />
            </ComposerPrimaryAction>
          </Animated.View>
        ) : (
          <View
            style={{
              height: actionSize,
              width: actionSize,
            }}
          />
        )}
      </View>
    </ComposerShell>
  );
}
