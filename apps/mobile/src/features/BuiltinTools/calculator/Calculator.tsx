import React, { memo, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { useThemeStore } from '../../../store/theme';
import { useThemeColors } from '../../../theme/colors';
import type { MobileBuiltinRenderProps } from '../types';

interface CalculatorData {
  expression?: string;
  lowerBound?: number | string;
  result?: number | string;
  upperBound?: number | string;
  variable?: string | string[];
}

const isCalculatorData = (value: unknown): value is CalculatorData =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeMath = (value: string) =>
  value
    .replaceAll(/\bpi\b/gi, '\\pi')
    .replaceAll(/\b(sin|cos|tan|log|ln|sqrt|exp)\s*\(/g, '\\$1(')
    .replaceAll('*', ' \\cdot ');

const FormulaBlock = memo<{ math: string }>(({ math }) => {
  const colors = useThemeColors();
  const effectiveTheme = useThemeStore((s) => s.effectiveTheme);
  const [height, setHeight] = useState(56);
  const escaped = normalizeMath(math)
    .replaceAll('\\', '\\\\')
    .replaceAll('`', '\\`')
    .replaceAll('</script', '<\\/script');

  const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
<style>:root{color-scheme:${effectiveTheme === 'dark' ? 'dark' : 'light'}}
body{margin:0;padding:8px;background:transparent;color:${colors.foreground};display:flex;align-items:center;justify-content:center}
.katex{color:${colors.foreground};font-size:1.04rem}</style></head><body>
<div id="m"></div><script>
try{katex.render(String.raw\`${escaped}\`,document.getElementById('m'),{displayMode:true,throwOnError:false});
setTimeout(()=>window.ReactNativeWebView.postMessage(JSON.stringify({height:document.body.scrollHeight})),80)}
catch(e){document.getElementById('m').textContent=String.raw\`${escaped}\`}</script></body></html>`;

  return (
    <WebView
      javaScriptEnabled
      originWhitelist={['*']}
      scrollEnabled={false}
      source={{ html }}
      style={{ backgroundColor: 'transparent', height, width: '100%' }}
      onMessage={(e) => {
        try {
          const data = JSON.parse(e.nativeEvent.data);
          if (data.height) setHeight(Math.min(Math.max(Number(data.height), 40), 160));
        } catch {
          // Ignore malformed height payloads from the embedded renderer.
        }
      }}
    />
  );
});

FormulaBlock.displayName = 'CalculatorFormulaBlock';

const parseCalculatorData = (
  content?: string,
  pluginState?: Record<string, unknown>,
): CalculatorData => {
  if (isCalculatorData(pluginState)) return pluginState;

  if (!content) return {};

  try {
    const parsed = JSON.parse(content) as { state?: CalculatorData };
    return isCalculatorData(parsed.state) ? parsed.state : {};
  } catch {
    return {};
  }
};

const parseCalculatorArgs = (args?: string): CalculatorData => {
  if (!args) return {};

  try {
    const parsed = JSON.parse(args) as CalculatorData;
    return isCalculatorData(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const CalculatorRender = memo<MobileBuiltinRenderProps>(
  ({ arguments: argsStr, content, pluginState }) => {
    const colors = useThemeColors();
    const state = useMemo(() => parseCalculatorData(content, pluginState), [content, pluginState]);
    const args = useMemo(() => parseCalculatorArgs(argsStr), [argsStr]);

    const expression =
      (typeof state.expression === 'string' ? state.expression : undefined) ||
      (typeof args.expression === 'string' ? args.expression : undefined);
    const result =
      state.result !== undefined
        ? String(state.result)
        : content?.trim()
          ? content.trim()
          : undefined;
    const variable = Array.isArray(state.variable)
      ? state.variable.join(', ')
      : typeof state.variable === 'string'
        ? state.variable
        : Array.isArray(args.variable)
          ? args.variable.join(', ')
          : typeof args.variable === 'string'
            ? args.variable
            : undefined;
    const lowerBound =
      state.lowerBound !== undefined ? String(state.lowerBound) : args.lowerBound?.toString();
    const upperBound =
      state.upperBound !== undefined ? String(state.upperBound) : args.upperBound?.toString();

    if (!expression && !result) return null;

    return (
      <View
        className="rounded-xl border p-3"
        style={{
          backgroundColor: colors.background,
          borderColor: colors.border,
        }}
      >
        {expression ? (
          <View
            className="rounded-xl px-2 py-1"
            style={{ backgroundColor: colors.fillQuaternary, minHeight: 56 }}
          >
            <FormulaBlock math={expression} />
          </View>
        ) : null}

        {(variable || lowerBound || upperBound) && (
          <View className="mt-2 flex-row flex-wrap gap-2">
            {variable ? (
              <View
                className="rounded-full px-2.5 py-1"
                style={{ backgroundColor: colors.primarySubtle }}
              >
                <Text className="text-[11px] font-medium" style={{ color: colors.primary }}>
                  d{variable}
                </Text>
              </View>
            ) : null}
            {lowerBound !== undefined && upperBound !== undefined ? (
              <View
                className="rounded-full px-2.5 py-1"
                style={{ backgroundColor: colors.fillQuaternary }}
              >
                <Text className="text-[11px] font-medium" style={{ color: colors.secondaryText }}>
                  {lowerBound}
                  {' -> '}
                  {upperBound}
                </Text>
              </View>
            ) : null}
          </View>
        )}

        {result ? (
          <View className="mt-3">
            <Text
              className="mb-1 text-[10px] font-semibold uppercase"
              style={{ color: colors.tertiaryText }}
            >
              Result
            </Text>
            <View
              className="rounded-xl px-2 py-1"
              style={{ backgroundColor: colors.fillQuaternary, minHeight: 56 }}
            >
              <FormulaBlock math={result} />
            </View>
          </View>
        ) : null}
      </View>
    );
  },
);

CalculatorRender.displayName = 'CalculatorRender';

export default CalculatorRender;
