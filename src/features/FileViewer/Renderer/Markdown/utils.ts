import type { MarkdownProps } from '@lobehub/ui';
import { Highlighter, SyntaxMermaid } from '@lobehub/ui';
import { type ComponentProps } from 'react';

const FALLBACK_CODE_LANGUAGE = 'plaintext';
const MERMAID_LANGUAGE_ALIASES = new Set([
  '',
  'mermaid',
  'mmd',
  'plain',
  'plaintext',
  'text',
  'txt',
]);
const MERMAID_BLOCK_START =
  /^(?:architecture-beta|block-beta|c4context|classDiagram|erDiagram|flowchart|gitGraph|gantt|graph|journey|kanban|mindmap|packet-beta|pie|quadrantChart|requirementDiagram|sankey-beta|sequenceDiagram|stateDiagram(?:-v2)?|timeline|xychart-beta)\b/i;
const MERMAID_INIT_DIRECTIVE = /^%%\{[\s\S]*?\}%%\s*/i;
const MERMAID_LINE_COMMENT = /^%%.*(?:\r?\n|$)/;

const stripMermaidPreamble = (content: string) => {
  let normalized = content.trimStart();

  while (normalized) {
    const withoutInit = normalized.replace(MERMAID_INIT_DIRECTIVE, '');

    if (withoutInit !== normalized) {
      normalized = withoutInit.trimStart();
      continue;
    }

    const withoutComment = normalized.replace(MERMAID_LINE_COMMENT, '');

    if (withoutComment !== normalized) {
      normalized = withoutComment.trimStart();
      continue;
    }

    break;
  }

  return normalized;
};

export interface MarkdownPreviewSettings {
  fontSize?: number;
  highlighterTheme?: ComponentProps<typeof Highlighter>['theme'];
  mermaidTheme?: ComponentProps<typeof SyntaxMermaid>['theme'];
}

export interface MarkdownCodeBlock {
  content: string;
  language: string;
}

export const isLikelyMermaidContent = (content: string) => {
  const normalized = stripMermaidPreamble(content);

  if (!normalized) return false;

  return MERMAID_BLOCK_START.test(normalized);
};

export const resolveCodeBlockLanguage = (language: string | undefined, content: string) => {
  const normalizedLanguage = language?.trim().toLowerCase() || '';

  if (normalizedLanguage === 'mermaid' || normalizedLanguage === 'mmd') return 'mermaid';

  if (MERMAID_LANGUAGE_ALIASES.has(normalizedLanguage) && isLikelyMermaidContent(content)) {
    return 'mermaid';
  }

  return normalizedLanguage || FALLBACK_CODE_LANGUAGE;
};

export const extractMarkdownCodeBlock = (children: unknown): MarkdownCodeBlock | undefined => {
  if (!children || typeof children !== 'object') return;

  const codeElement = children as {
    props?: {
      children?: string | string[];
      className?: string;
    };
  };

  const content = Array.isArray(codeElement.props?.children)
    ? codeElement.props?.children[0]
    : codeElement.props?.children;

  if (typeof content !== 'string') return;

  return {
    content,
    language: resolveCodeBlockLanguage(
      codeElement.props?.className?.replace('language-', ''),
      content,
    ),
  };
};

export const createMarkdownPreviewProps = ({
  fontSize,
  highlighterTheme,
  mermaidTheme,
}: MarkdownPreviewSettings): Pick<
  MarkdownProps,
  | 'componentProps'
  | 'enableCustomFootnotes'
  | 'enableGithubAlert'
  | 'enableImageGallery'
  | 'enableMermaid'
  | 'fontSize'
  | 'fullFeaturedCodeBlock'
> => ({
  componentProps: {
    highlight: {
      fullFeatured: true,
      theme: highlighterTheme,
    },
    mermaid: {
      fullFeatured: false,
      theme: mermaidTheme,
    },
  },
  enableCustomFootnotes: true,
  enableGithubAlert: true,
  enableImageGallery: true,
  enableMermaid: true,
  fontSize,
  fullFeaturedCodeBlock: true,
});
