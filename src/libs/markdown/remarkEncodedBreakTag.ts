import { type Plugin } from 'unified';
import { SKIP, visit } from 'unist-util-visit';

const ENCODED_BREAK_TAG_REGEXP = /&lt;\s*br\s*(?:\/\s*)?&gt;/gi;
const INLINE_BREAK_TAG_REGEXP = /<\s*br\s*(?:\/\s*)?>|&lt;\s*br\s*(?:\/\s*)?&gt;/gi;
const EXACT_RAW_BREAK_TAG_REGEXP = /^\s*<\s*br\s*(?:\/\s*)?>\s*$/i;

export const normalizeMarkdownBreakTags = (value: string) =>
  value.replaceAll(ENCODED_BREAK_TAG_REGEXP, '<br />');

const createBreakNodes = (value: string) => {
  const hasBreakTag = INLINE_BREAK_TAG_REGEXP.test(value);
  INLINE_BREAK_TAG_REGEXP.lastIndex = 0;

  if (!hasBreakTag) return;

  const nodes: Array<{ type: 'break' } | { type: 'text'; value: string }> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = INLINE_BREAK_TAG_REGEXP.exec(value)) !== null) {
    if (match.index > lastIndex) {
      nodes.push({ type: 'text', value: value.slice(lastIndex, match.index) });
    }

    nodes.push({ type: 'break' });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < value.length) {
    nodes.push({ type: 'text', value: value.slice(lastIndex) });
  }

  return nodes;
};

export const remarkEncodedBreakTag: Plugin<[], any> = () => {
  return (tree) => {
    visit(tree, 'html', (node: any, index: number | undefined, parent: any) => {
      if (!parent || typeof index !== 'number' || typeof node.value !== 'string') return;
      if (!EXACT_RAW_BREAK_TAG_REGEXP.test(node.value)) return;

      parent.children.splice(index, 1, { type: 'break' });
      return [SKIP, index + 1];
    });

    visit(tree, 'text', (node: any, index: number | undefined, parent: any) => {
      if (!parent || typeof index !== 'number' || typeof node.value !== 'string') return;

      const nodes = createBreakNodes(node.value);

      if (!nodes || nodes.length === 0) return;

      parent.children.splice(index, 1, ...nodes);
      return [SKIP, index + nodes.length];
    });
  };
};

export const documentMarkdownRemarkPlugins = [remarkEncodedBreakTag] as const;
