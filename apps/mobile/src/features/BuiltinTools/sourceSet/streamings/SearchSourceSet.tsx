/**
 * Source-set search streaming placeholder while the tool is running.
 */
import { FileText } from 'lucide-react-native';
import React, { memo } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { useI18n } from '../../../../lib/i18n';
import { useThemeColors } from '../../../../theme/colors';
import type { MobileBuiltinStreamingProps } from '../../types';

const SearchSourceSetStreaming = memo<MobileBuiltinStreamingProps>(({ args }) => {
  const { t } = useI18n();
  const colors = useThemeColors();
  const query = (args?.query as string) || '';

  return (
    <View
      className="flex-row items-center gap-2 rounded-xl border px-3 py-2.5"
      style={{
        backgroundColor: colors.overlay,
        borderColor: colors.border,
      }}
    >
      <ActivityIndicator color={colors.primary} size="small" />
      <FileText color={colors.primary} size={16} strokeWidth={2} />
      <Text
        className="flex-1 text-[13px]"
        numberOfLines={1}
        style={{ color: colors.secondaryText }}
      >
        {query ? `${t.chatToolStreamingSourceSet} ${query}` : t.chatToolStreamingSourceSet}
      </Text>
    </View>
  );
});

SearchSourceSetStreaming.displayName = 'SourceSetSearchStreaming';

export default SearchSourceSetStreaming;
