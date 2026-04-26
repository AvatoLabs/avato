import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { describe, expect, it } from 'vitest';

import { remarkEncodedBreakTag } from './remarkEncodedBreakTag';

const processMarkdown = (markdown: string) => {
  const processor = unified().use(remarkParse).use(remarkGfm).use(remarkEncodedBreakTag);

  const tree = processor.parse(markdown);
  return processor.runSync(tree);
};

describe('remarkEncodedBreakTag', () => {
  it('converts encoded br tags inside table cells into break nodes', () => {
    const tree = processMarkdown(
      '| role | budget |\n| --- | --- |\n| Rust | **$22,500**&lt;br&gt;&lt;br/&gt;($4,500/人) |',
    );

    const budgetCell = (((tree.children[0] as any).children[1] as any).children[1] as any).children;

    expect(
      budgetCell.map((node: any) => ('value' in node ? `${node.type}:${node.value}` : node.type)),
    ).toEqual(['strong', 'break', 'break', 'text:($4,500/人)']);
  });

  it('keeps ordinary text unchanged when no break tag is present', () => {
    const tree = processMarkdown('| role | budget |\n| --- | --- |\n| Rust | $22,500 |');

    const budgetCell = (((tree.children[0] as any).children[1] as any).children[1] as any).children;

    expect(budgetCell).toEqual([
      expect.objectContaining({
        type: 'text',
        value: '$22,500',
      }),
    ]);
  });
});
