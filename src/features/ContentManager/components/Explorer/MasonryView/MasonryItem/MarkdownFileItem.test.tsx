/**
 * @vitest-environment happy-dom
 */
import { render } from '@testing-library/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { describe, expect, it, vi } from 'vitest';

import MarkdownFileItem from './MarkdownFileItem';

vi.mock('antd-style', () => ({
  createStaticStyles: vi.fn((factory: any) =>
    factory({
      css: () => 'mock-class',
      cssVar: new Proxy(
        {},
        {
          get: (_, prop) => String(prop),
        },
      ),
    }),
  ),
  cx: (...classNames: Array<string | false | null | undefined>) =>
    classNames.filter(Boolean).join(' '),
}));

vi.mock('@lobehub/ui', () => ({
  Button: vi.fn(({ children, ...props }) => <button {...props}>{children}</button>),
  Markdown: vi.fn(({ children, components }: any) => (
    <ReactMarkdown components={components} remarkPlugins={[remarkGfm]}>
      {children}
    </ReactMarkdown>
  )),
  Tooltip: vi.fn(({ children }: any) => children),
  stopPropagation: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/components/FileIcon', () => ({
  default: vi.fn(() => <div data-testid="file-icon" />),
}));

vi.mock('@/config/contentIcons', () => ({
  RESOURCE_ENTRY_ICONS: {
    chunk: 'chunk-icon',
  },
}));

vi.mock('@/store/file', () => ({
  fileManagerSelectors: {
    isCreatingFileParseTask: () => () => false,
  },
  useFileStore: vi.fn((selector: any) =>
    selector({
      parseFilesToChunks: vi.fn(),
    }),
  ),
}));

vi.mock('@/utils/isChunkingUnsupported', () => ({
  isChunkingUnsupported: vi.fn(() => true),
}));

vi.mock('../../ListView/ListItem/ChunkTag', () => ({
  default: vi.fn(() => <div data-testid="chunks-badge" />),
}));

describe('MarkdownFileItem', () => {
  it('renders gfm tables in the masonry preview', () => {
    const markdownContent = ['| Model | Score |', '| --- | --- |', '| GPT-5.4 | 98 |'].join('\n');

    const { container } = render(
      <MarkdownFileItem
        id="file-1"
        isLoadingMarkdown={false}
        markdownContent={markdownContent}
        name="README.md"
        size={128}
      />,
    );

    const table = container.querySelector('table');

    expect(table).not.toBeNull();
    expect(table?.querySelector('th')?.textContent).toContain('Model');
    expect(table?.querySelector('td')?.textContent).toContain('GPT-5.4');
  });
});
