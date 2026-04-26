import type { Command } from 'commander';
import pc from 'picocolors';

import { getTrpcClient } from '../api/client';
import { confirm, outputJson, printTable, timeAgo, truncate } from '../utils/format';
import { log } from '../utils/logger';

export function registerSourceSetCommand(program: Command) {
  const sourceSet = program.command('source-set').description('Manage source sets');

  // ── list ──────────────────────────────────────────────

  sourceSet
    .command('list')
    .description('List source sets')
    .option('--json [fields]', 'Output JSON, optionally specify fields (comma-separated)')
    .action(async (options: { json?: string | boolean }) => {
      const client = await getTrpcClient();
      const result = await client.sourceSet.getSourceSets.query();
      const items = Array.isArray(result) ? result : [];

      if (options.json !== undefined) {
        const fields = typeof options.json === 'string' ? options.json : undefined;
        outputJson(items, fields);
        return;
      }

      if (items.length === 0) {
        console.log('No source sets found.');
        return;
      }

      const rows = items.map((sourceSetItem: any) => [
        sourceSetItem.id,
        truncate(sourceSetItem.name || 'Untitled', 40),
        truncate(sourceSetItem.description || '', 50),
        sourceSetItem.updatedAt ? timeAgo(sourceSetItem.updatedAt) : '',
      ]);

      printTable(rows, ['ID', 'NAME', 'DESCRIPTION', 'UPDATED']);
    });

  // ── view ──────────────────────────────────────────────

  sourceSet
    .command('view <id>')
    .description('View a source set')
    .option('--json [fields]', 'Output JSON, optionally specify fields (comma-separated)')
    .action(async (id: string, options: { json?: string | boolean }) => {
      const client = await getTrpcClient();
      const result = await client.sourceSet.getSourceSetById.query({ id });

      if (!result) {
        log.error(`Source set not found: ${id}`);
        process.exit(1);
        return;
      }

      if (options.json !== undefined) {
        const fields = typeof options.json === 'string' ? options.json : undefined;
        outputJson(result, fields);
        return;
      }

      console.log(pc.bold(result.name || 'Untitled'));
      const meta: string[] = [];
      if (result.description) meta.push(result.description);
      if ((result as any).updatedAt) meta.push(`Updated ${timeAgo((result as any).updatedAt)}`);
      if (meta.length > 0) console.log(pc.dim(meta.join(' · ')));

      // Show files if available
      if ((result as any).files && Array.isArray((result as any).files)) {
        const files = (result as any).files;
        if (files.length > 0) {
          console.log();
          console.log(pc.bold(`Files (${files.length}):`));
          const rows = files.map((f: any) => [
            f.id,
            truncate(f.name || f.filename || '', 50),
            f.fileType || '',
          ]);
          printTable(rows, ['ID', 'NAME', 'TYPE']);
        }
      }
    });

  // ── create ────────────────────────────────────────────

  sourceSet
    .command('create')
    .description('Create a source set')
    .requiredOption('-n, --name <name>', 'Source set name')
    .option('-d, --description <desc>', 'Description')
    .option('--avatar <url>', 'Avatar URL')
    .action(async (options: { avatar?: string; description?: string; name: string }) => {
      const client = await getTrpcClient();

      const input: { avatar?: string; description?: string; name: string } = {
        name: options.name,
      };
      if (options.description) input.description = options.description;
      if (options.avatar) input.avatar = options.avatar;

      const result = await client.sourceSet.createSourceSet.mutate(input);
      console.log(`${pc.green('✓')} Created source set ${pc.bold((result as any).id)}`);
    });

  // ── edit ──────────────────────────────────────────────

  sourceSet
    .command('edit <id>')
    .description('Update a source set')
    .option('-n, --name <name>', 'New name')
    .option('-d, --description <desc>', 'New description')
    .option('--avatar <url>', 'New avatar URL')
    .action(
      async (id: string, options: { avatar?: string; description?: string; name?: string }) => {
        if (!options.name && !options.description && !options.avatar) {
          log.error('No changes specified. Use --name, --description, or --avatar.');
          process.exit(1);
        }

        const client = await getTrpcClient();

        const value: Record<string, any> = {};
        if (options.name) value.name = options.name;
        if (options.description) value.description = options.description;
        if (options.avatar) value.avatar = options.avatar;

        await client.sourceSet.updateSourceSet.mutate({ id, value });
        console.log(`${pc.green('✓')} Updated source set ${pc.bold(id)}`);
      },
    );

  // ── delete ────────────────────────────────────────────

  sourceSet
    .command('delete <id>')
    .description('Delete a source set')
    .option('--remove-files', 'Also delete associated files')
    .option('--yes', 'Skip confirmation prompt')
    .action(async (id: string, options: { removeFiles?: boolean; yes?: boolean }) => {
      if (!options.yes) {
        const confirmed = await confirm('Are you sure you want to delete this source set?');
        if (!confirmed) {
          console.log('Cancelled.');
          return;
        }
      }

      const client = await getTrpcClient();
      await client.sourceSet.deleteSourceSet.mutate({
        id,
        removeFiles: options.removeFiles,
      });
      console.log(`${pc.green('✓')} Deleted source set ${pc.bold(id)}`);
    });

  // ── add-files ─────────────────────────────────────────

  sourceSet
    .command('add-files <sourceSetId>')
    .description('Add files to a source set')
    .requiredOption('--ids <ids...>', 'File IDs to add')
    .action(async (sourceSetId: string, options: { ids: string[] }) => {
      const client = await getTrpcClient();
      await client.sourceSet.addFilesToSourceSet.mutate({
        ids: options.ids,
        sourceSetId,
      });
      console.log(
        `${pc.green('✓')} Added ${options.ids.length} file(s) to source set ${pc.bold(sourceSetId)}`,
      );
    });

  // ── remove-files ──────────────────────────────────────

  sourceSet
    .command('remove-files <sourceSetId>')
    .description('Remove files from a source set')
    .requiredOption('--ids <ids...>', 'File IDs to remove')
    .option('--yes', 'Skip confirmation prompt')
    .action(async (sourceSetId: string, options: { ids: string[]; yes?: boolean }) => {
      if (!options.yes) {
        const confirmed = await confirm(`Remove ${options.ids.length} file(s) from source set?`);
        if (!confirmed) {
          console.log('Cancelled.');
          return;
        }
      }

      const client = await getTrpcClient();
      await client.sourceSet.removeFilesFromSourceSet.mutate({
        ids: options.ids,
        sourceSetId,
      });
      console.log(
        `${pc.green('✓')} Removed ${options.ids.length} file(s) from source set ${pc.bold(sourceSetId)}`,
      );
    });
}
