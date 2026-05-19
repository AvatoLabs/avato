import { describe, expect, it, vi } from 'vitest';

import type { FileListItem } from '../types';
import { moveFilesBetweenSourceSets, shouldFallbackSourceSetScope } from './resourceSourceSet';

describe('shouldFallbackSourceSetScope', () => {
  it('does not fall back before the directory has loaded successfully', () => {
    expect(
      shouldFallbackSourceSetScope({
        pendingSourceSetSelectionId: null,
        sourceSetDirectoryStatus: 'loading',
        sourceSetId: 'source-1',
        sourceSets: [],
      }),
    ).toBe(false);

    expect(
      shouldFallbackSourceSetScope({
        pendingSourceSetSelectionId: null,
        sourceSetDirectoryStatus: 'error',
        sourceSetId: 'source-1',
        sourceSets: [],
      }),
    ).toBe(false);
  });

  it('does not fall back while a cross-space source set switch is pending', () => {
    expect(
      shouldFallbackSourceSetScope({
        pendingSourceSetSelectionId: 'source-1',
        sourceSetDirectoryStatus: 'success',
        sourceSetId: 'source-1',
        sourceSets: [],
      }),
    ).toBe(false);
  });

  it('falls back only after a successful load confirms the source set is missing', () => {
    expect(
      shouldFallbackSourceSetScope({
        pendingSourceSetSelectionId: null,
        sourceSetDirectoryStatus: 'success',
        sourceSetId: 'source-1',
        sourceSets: [{ id: 'source-2', name: 'Other' }],
      }),
    ).toBe(true);

    expect(
      shouldFallbackSourceSetScope({
        pendingSourceSetSelectionId: null,
        sourceSetDirectoryStatus: 'success',
        sourceSetId: 'source-1',
        sourceSets: [{ id: 'source-1', name: 'Current' }],
      }),
    ).toBe(false);
  });
});

describe('moveFilesBetweenSourceSets', () => {
  const nestedFile = {
    chunkCount: null,
    chunkingError: null,
    createdAt: '2026-04-11T00:00:00.000Z',
    embeddingError: null,
    fileType: 'image/png',
    finishEmbedding: true,
    id: 'file-nested',
    name: 'nested.png',
    parentId: 'folder-1',
    size: 1,
    sourceType: 'file',
    url: '',
  } satisfies FileListItem;

  const rootDocument = {
    chunkCount: null,
    chunkingError: null,
    createdAt: '2026-04-11T00:00:00.000Z',
    embeddingError: null,
    fileType: 'text/plain',
    finishEmbedding: true,
    id: 'docs-root',
    name: 'root-doc',
    parentId: null,
    size: 1,
    sourceType: 'document',
    url: '',
  } satisfies FileListItem;

  it('adds to the target first, then resets nested parents, then removes from the source', async () => {
    const events: string[] = [];
    const addFiles = vi.fn(async () => {
      events.push('add');
    });
    const moveResourceToRoot = vi.fn(async () => {
      events.push('reset');
    });
    const removeFiles = vi.fn(async () => {
      events.push('remove');
    });

    await moveFilesBetweenSourceSets(
      {
        currentSourceSetId: 'source-old',
        ids: ['file-nested', 'docs-root'],
        resourceItemsById: new Map<string, FileListItem>([
          ['file-nested', nestedFile],
          ['docs-root', rootDocument],
        ]),
        targetSourceSetId: 'source-new',
      },
      { addFiles, moveResourceToRoot, removeFiles },
    );

    expect(events).toEqual(['add', 'reset', 'remove']);
    expect(addFiles).toHaveBeenCalledWith('source-new', ['file-nested', 'docs-root']);
    expect(moveResourceToRoot).toHaveBeenCalledTimes(1);
    expect(moveResourceToRoot).toHaveBeenCalledWith('file-nested', 'file');
    expect(removeFiles).toHaveBeenCalledWith('source-old', ['file-nested', 'docs-root']);
  });
});
