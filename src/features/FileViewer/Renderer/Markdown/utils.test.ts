/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from 'vitest';

import { documentMarkdownRemarkPlugins } from '@/libs/markdown/remarkEncodedBreakTag';

import {
  createMarkdownPreviewProps,
  extractMarkdownCodeBlock,
  isLikelyMermaidContent,
  resolveCodeBlockLanguage,
} from './utils';

describe('createMarkdownPreviewProps', () => {
  it('enables the richer markdown preview capabilities for resource files', () => {
    expect(
      createMarkdownPreviewProps({
        fontSize: 15,
        highlighterTheme: 'github-dark',
        mermaidTheme: 'neutral',
      }),
    ).toEqual({
      componentProps: {
        highlight: {
          fullFeatured: true,
          theme: 'github-dark',
        },
        mermaid: {
          fullFeatured: false,
          theme: 'neutral',
        },
      },
      enableCustomFootnotes: true,
      enableGithubAlert: true,
      enableImageGallery: true,
      enableMermaid: true,
      fontSize: 15,
      fullFeaturedCodeBlock: true,
      remarkPluginsAhead: [...documentMarkdownRemarkPlugins],
    });
  });
});

describe('extractMarkdownCodeBlock', () => {
  it('reads fenced code block content and language from the markdown pre node', () => {
    expect(
      extractMarkdownCodeBlock({
        props: {
          children: ['console.log("hello")\n'],
          className: 'language-ts',
        },
      }),
    ).toEqual({
      content: 'console.log("hello")\n',
      language: 'ts',
    });
  });

  it('falls back to plaintext when the code block has no language', () => {
    expect(
      extractMarkdownCodeBlock({
        props: {
          children: 'plain text',
        },
      }),
    ).toEqual({
      content: 'plain text',
      language: 'plaintext',
    });
  });

  it('promotes plain fenced blocks to mermaid when the content matches mermaid syntax', () => {
    expect(
      extractMarkdownCodeBlock({
        props: {
          children: 'flowchart TD\nA-->B',
        },
      }),
    ).toEqual({
      content: 'flowchart TD\nA-->B',
      language: 'mermaid',
    });
  });
});

describe('resolveCodeBlockLanguage', () => {
  it('treats mmd aliases as mermaid', () => {
    expect(resolveCodeBlockLanguage('mmd', 'flowchart TD\nA-->B')).toBe('mermaid');
  });

  it('keeps plain text when the content is not mermaid', () => {
    expect(resolveCodeBlockLanguage('txt', 'hello world')).toBe('txt');
  });
});

describe('isLikelyMermaidContent', () => {
  it('recognizes common mermaid starters', () => {
    expect(isLikelyMermaidContent('graph LR\nA-->B')).toBe(true);
    expect(isLikelyMermaidContent('sequenceDiagram\nA->>B: ping')).toBe(true);
  });

  it('does not over-match ordinary text', () => {
    expect(isLikelyMermaidContent('hello world')).toBe(false);
  });

  it('recognizes mermaid blocks with init directives or comments', () => {
    expect(isLikelyMermaidContent('%%{init: { "theme": "dark" }}%%\nflowchart TD\nA-->B')).toBe(
      true,
    );
    expect(isLikelyMermaidContent('%% comment\nsequenceDiagram\nA->>B: ping')).toBe(true);
  });
});
