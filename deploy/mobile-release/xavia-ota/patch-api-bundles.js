/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('node:fs');
const path = require('node:path');

const apiDir = '/app/.next/server/pages/api';

const replacements = [
  {
    from: 'SELECT id, runtime_version as "runtimeVersion", path, timestamp, commit_hash as "commitHash"',
    to: 'SELECT id, runtime_version as "runtimeVersion", path, timestamp, commit_hash as "commitHash", update_id as "updateId"',
  },
];

const walk = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walk(entryPath);
      continue;
    }

    if (!entry.isFile() || !entry.name.endsWith('.js')) continue;

    const original = fs.readFileSync(entryPath, 'utf8');
    let next = original;

    for (const { from, to } of replacements) {
      next = next.split(from).join(to);
    }

    if (next !== original) {
      fs.writeFileSync(entryPath, next);
      console.info(`patched ${entryPath}`);
    }
  }
};

if (!fs.existsSync(apiDir)) {
  throw new Error(`API bundle directory not found: ${apiDir}`);
}

walk(apiDir);
