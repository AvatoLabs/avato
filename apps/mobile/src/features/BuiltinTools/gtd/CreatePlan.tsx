/**
 * GTD CreatePlan Render — RN version of lobe-gtd CreatePlan.
 * Displays plan (goal, description, context) from pluginState or parsed content.
 */
import { ListChecks } from 'lucide-react-native';
import React, { memo, useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Markdown from 'react-native-markdown-display';

import { codeInlineRules } from '../../../lib/markdownRules';
import { getThemedMarkdownStyles } from '../../../lib/markdownStyles';
import { useThemeColors } from '../../../theme/colors';
import type { MobileBuiltinRenderProps } from '../types';

interface Plan {
  completed?: boolean;
  context?: string;
  createdAt?: string;
  description?: string;
  goal: string;
  id?: string;
  updatedAt?: string;
}

function parsePlan(content?: string, pluginState?: Record<string, unknown>): Plan | null {
  const plan = pluginState?.plan as Plan | undefined;
  if (plan?.goal) return plan;
  if (content) {
    try {
      const parsed = JSON.parse(content) as { plan?: Plan; state?: { plan?: Plan } };
      const p = parsed.plan ?? parsed.state?.plan;
      return p?.goal ? p : null;
    } catch {
      return null;
    }
  }
  return null;
}

const MAX_CONTEXT_HEIGHT = 120;

const CreatePlanRender = memo<MobileBuiltinRenderProps>(({ content, pluginState }) => {
  const colors = useThemeColors();
  const plan = useMemo(() => parsePlan(content, pluginState), [content, pluginState]);
  const markdownStyles = useMemo(() => getThemedMarkdownStyles(colors), [colors]);

  if (!plan) return null;

  const hasContext = !!plan.context;

  return (
    <View
      className="rounded-xl border p-3"
      style={{
        backgroundColor: colors.background,
        borderColor: colors.border,
      }}
    >
      <View className="mb-2 flex-row items-center gap-2">
        <ListChecks color={colors.primary} size={18} strokeWidth={2} />
        <Text
          className="flex-1 text-[15px] font-semibold"
          numberOfLines={2}
          style={{ color: colors.foreground }}
        >
          {plan.goal}
        </Text>
      </View>
      {plan.description ? (
        <Text
          className="mb-2 text-[13px]"
          numberOfLines={2}
          style={{ color: colors.secondaryText }}
        >
          {plan.description}
        </Text>
      ) : null}
      {hasContext ? (
        <ScrollView
          nestedScrollEnabled
          className="rounded-lg p-3"
          showsVerticalScrollIndicator={false}
          style={{ backgroundColor: colors.overlay, maxHeight: MAX_CONTEXT_HEIGHT }}
        >
          <Markdown rules={codeInlineRules as any} style={markdownStyles}>
            {plan.context!}
          </Markdown>
        </ScrollView>
      ) : null}
    </View>
  );
});

CreatePlanRender.displayName = 'GTDCreatePlanRender';

export default CreatePlanRender;
