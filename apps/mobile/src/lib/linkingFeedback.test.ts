import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const SOURCE_ROOT = path.join(process.cwd(), 'src');
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);

const collectSourceFiles = (directory: string): string[] => {
  const entries = readdirSync(directory);
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
      continue;
    }

    const extension = fullPath.endsWith('.tsx') ? '.tsx' : fullPath.endsWith('.ts') ? '.ts' : '';
    const isTestFile = /\.test\.tsx?$/.test(fullPath);
    if (SOURCE_EXTENSIONS.has(extension) && !isTestFile) files.push(fullPath);
  }

  return files;
};

describe('linking feedback', () => {
  it('does not silently swallow failed Linking.openURL calls', () => {
    const violations = collectSourceFiles(SOURCE_ROOT).flatMap((filePath) => {
      const source = readFileSync(filePath, 'utf8');
      const patterns = [
        /Linking\.openURL\([^)]*\)\.catch\(\(\) => undefined\)/g,
        /onPress=\{\(\) => Linking\.openURL\(/g,
      ];

      return patterns.flatMap((pattern) =>
        [...source.matchAll(pattern)].map(
          (match) => `${path.relative(SOURCE_ROOT, filePath)}:${match.index}`,
        ),
      );
    });

    expect(violations).toEqual([]);
  });
});
