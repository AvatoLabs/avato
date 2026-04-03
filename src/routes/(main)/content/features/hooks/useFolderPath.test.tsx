/**
 * @vitest-environment happy-dom
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { useFolderPath } from './useFolderPath';

const HookProbe = () => {
  const value = useFolderPath();

  return <pre data-testid="folder-path">{JSON.stringify(value)}</pre>;
};

const renderRoute = (initialEntry: string) =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route element={<HookProbe />} path="/content/source-sets/:id" />
        <Route element={<HookProbe />} path="/content/source-sets/:id/:slug" />
        <Route element={<HookProbe />} path="/content/spaces/:spaceId/source-sets/:id" />
        <Route element={<HookProbe />} path="/content/spaces/:spaceId/source-sets/:id/:slug" />
        <Route element={<HookProbe />} path="/content/spaces/:spaceId" />
        <Route element={<HookProbe />} path="/content/spaces/:spaceId/:slug" />
        <Route element={<HookProbe />} path="/spaces/:spaceId/files" />
        <Route element={<HookProbe />} path="/spaces/:spaceId/files/:slug" />
      </Routes>
    </MemoryRouter>,
  );

describe('useFolderPath', () => {
  it('recognizes source-set folders on the legacy route', () => {
    renderRoute('/content/source-sets/ss_1/folder-a');

    expect(screen.getByTestId('folder-path')).toHaveTextContent(
      JSON.stringify({
        currentFolderSlug: 'folder-a',
        isInKnowledgeBase: true,
        sourceSetId: 'ss_1',
      }),
    );
  });

  it('recognizes source-set folders on the space-scoped route', () => {
    renderRoute('/content/spaces/spc_1/source-sets/ss_1/folder-a');

    expect(screen.getByTestId('folder-path')).toHaveTextContent(
      JSON.stringify({
        currentFolderSlug: 'folder-a',
        isInKnowledgeBase: true,
        sourceSetId: 'ss_1',
      }),
    );
  });

  it('keeps space root folders out of source-set context', () => {
    renderRoute('/content/spaces/spc_1/folder-a');

    expect(screen.getByTestId('folder-path')).toHaveTextContent(
      JSON.stringify({
        currentFolderSlug: 'folder-a',
        isInKnowledgeBase: false,
        sourceSetId: null,
      }),
    );
  });

  it('recognizes source-set scope on the files route', () => {
    renderRoute('/spaces/spc_1/files/folder-a?scope=source-set:ss_1');

    expect(screen.getByTestId('folder-path')).toHaveTextContent(
      JSON.stringify({
        currentFolderSlug: 'folder-a',
        isInKnowledgeBase: true,
        sourceSetId: 'ss_1',
      }),
    );
  });
});
