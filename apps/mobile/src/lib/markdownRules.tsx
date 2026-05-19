/**
 * Shared markdown render rules for react-native-markdown-display.
 * Fixes "View config getter callback for component `code` must be a function"
 * by explicitly rendering code/code_inline with Text instead of relying on defaults.
 */
import React from 'react';
import { Text } from 'react-native';

export const codeInlineRules = {
  code_inline: (
    node: { key?: string; content?: string },
    _children: unknown,
    _parent: unknown,
    styles: { body?: object; code_inline?: object },
  ) => (
    <Text key={node.key} style={styles.code_inline ?? styles.body ?? {}}>
      {node.content}
    </Text>
  ),
  code: (
    node: { key?: string; content?: string },
    _children: unknown,
    _parent: unknown,
    styles: { body?: object; code_inline?: object },
  ) => (
    <Text key={node.key} style={styles.code_inline ?? styles.body ?? {}}>
      {node.content}
    </Text>
  ),
};
