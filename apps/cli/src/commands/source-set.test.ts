import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { log } from '../utils/logger';
import { registerSourceSetCommand } from './source-set';

const { mockTrpcClient } = vi.hoisted(() => ({
  mockTrpcClient: {
    sourceSet: {
      addFilesToSourceSet: { mutate: vi.fn() },
      createSourceSet: { mutate: vi.fn() },
      deleteSourceSet: { mutate: vi.fn() },
      getSourceSetById: { query: vi.fn() },
      getSourceSets: { query: vi.fn() },
      removeFilesFromSourceSet: { mutate: vi.fn() },
      updateSourceSet: { mutate: vi.fn() },
    },
  },
}));

const { getTrpcClient: mockGetTrpcClient } = vi.hoisted(() => ({
  getTrpcClient: vi.fn(),
}));

vi.mock('../api/client', () => ({ getTrpcClient: mockGetTrpcClient }));
vi.mock('../utils/logger', () => ({
  log: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
  setVerbose: vi.fn(),
}));

describe('source-set command', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockGetTrpcClient.mockResolvedValue(mockTrpcClient);
    // Reset all mocks
    for (const router of Object.values(mockTrpcClient)) {
      for (const method of Object.values(router)) {
        for (const fn of Object.values(method)) {
          (fn as ReturnType<typeof vi.fn>).mockReset();
        }
      }
    }
  });

  afterEach(() => {
    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  function createProgram() {
    const program = new Command();
    program.exitOverride();
    registerSourceSetCommand(program);
    return program;
  }

  describe('list', () => {
    it('should display source sets in table format', async () => {
      mockTrpcClient.sourceSet.getSourceSets.query.mockResolvedValue([
        { description: 'My KB', id: 'kb1', name: 'Test KB', updatedAt: new Date().toISOString() },
      ]);

      const program = createProgram();
      await program.parseAsync(['node', 'test', 'source-set', 'list']);

      expect(consoleSpy).toHaveBeenCalledTimes(2); // header + 1 row
      expect(consoleSpy.mock.calls[0][0]).toContain('ID');
    });

    it('should output JSON when --json flag is used', async () => {
      const items = [{ id: 'kb1', name: 'Test' }];
      mockTrpcClient.sourceSet.getSourceSets.query.mockResolvedValue(items);

      const program = createProgram();
      await program.parseAsync(['node', 'test', 'source-set', 'list', '--json']);

      expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify(items, null, 2));
    });

    it('should show message when no source sets found', async () => {
      mockTrpcClient.sourceSet.getSourceSets.query.mockResolvedValue([]);

      const program = createProgram();
      await program.parseAsync(['node', 'test', 'source-set', 'list']);

      expect(consoleSpy).toHaveBeenCalledWith('No source sets found.');
    });
  });

  describe('view', () => {
    it('should display source-set details', async () => {
      mockTrpcClient.sourceSet.getSourceSetById.query.mockResolvedValue({
        description: 'A test KB',
        id: 'kb1',
        name: 'Test KB',
      });

      const program = createProgram();
      await program.parseAsync(['node', 'test', 'source-set', 'view', 'kb1']);

      expect(mockTrpcClient.sourceSet.getSourceSetById.query).toHaveBeenCalledWith({
        id: 'kb1',
      });
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Test KB'));
    });

    it('should exit when not found', async () => {
      mockTrpcClient.sourceSet.getSourceSetById.query.mockResolvedValue(null);

      const program = createProgram();
      await program.parseAsync(['node', 'test', 'source-set', 'view', 'nonexistent']);

      expect(log.error).toHaveBeenCalledWith(expect.stringContaining('not found'));
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('create', () => {
    it('should create a source set', async () => {
      mockTrpcClient.sourceSet.createSourceSet.mutate.mockResolvedValue({ id: 'kb-new' });

      const program = createProgram();
      await program.parseAsync([
        'node',
        'test',
        'source-set',
        'create',
        '--name',
        'New KB',
        '--description',
        'Test desc',
      ]);

      expect(mockTrpcClient.sourceSet.createSourceSet.mutate).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'Test desc', name: 'New KB' }),
      );
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('kb-new'));
    });
  });

  describe('edit', () => {
    it('should update a source set', async () => {
      mockTrpcClient.sourceSet.updateSourceSet.mutate.mockResolvedValue({});

      const program = createProgram();
      await program.parseAsync(['node', 'test', 'source-set', 'edit', 'kb1', '--name', 'Updated']);

      expect(mockTrpcClient.sourceSet.updateSourceSet.mutate).toHaveBeenCalledWith({
        id: 'kb1',
        value: { name: 'Updated' },
      });
    });

    it('should exit when no changes specified', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'test', 'source-set', 'edit', 'kb1']);

      expect(log.error).toHaveBeenCalledWith(expect.stringContaining('No changes'));
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('delete', () => {
    it('should delete with --yes', async () => {
      mockTrpcClient.sourceSet.deleteSourceSet.mutate.mockResolvedValue({});

      const program = createProgram();
      await program.parseAsync(['node', 'test', 'source-set', 'delete', 'kb1', '--yes']);

      expect(mockTrpcClient.sourceSet.deleteSourceSet.mutate).toHaveBeenCalledWith({
        id: 'kb1',
        removeFiles: undefined,
      });
    });

    it('should pass --remove-files flag', async () => {
      mockTrpcClient.sourceSet.deleteSourceSet.mutate.mockResolvedValue({});

      const program = createProgram();
      await program.parseAsync([
        'node',
        'test',
        'source-set',
        'delete',
        'kb1',
        '--yes',
        '--remove-files',
      ]);

      expect(mockTrpcClient.sourceSet.deleteSourceSet.mutate).toHaveBeenCalledWith({
        id: 'kb1',
        removeFiles: true,
      });
    });
  });

  describe('add-files', () => {
    it('should add files to a source set', async () => {
      mockTrpcClient.sourceSet.addFilesToSourceSet.mutate.mockResolvedValue({});

      const program = createProgram();
      await program.parseAsync([
        'node',
        'test',
        'source-set',
        'add-files',
        'kb1',
        '--ids',
        'f1',
        'f2',
      ]);

      expect(mockTrpcClient.sourceSet.addFilesToSourceSet.mutate).toHaveBeenCalledWith({
        ids: ['f1', 'f2'],
        sourceSetId: 'kb1',
      });
    });
  });
});
