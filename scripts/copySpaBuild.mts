import { cpSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const spaDir = path.resolve(root, 'public/spa');
const distDirs = ['desktop', 'mobile'] as const;
const copyDirs = [
  '.well-known',
  'assets',
  'avatars',
  'i18n',
  'icons',
  'images',
  'og',
  'provider',
  'screenshots',
  'vendor',
  'videos',
] as const;

mkdirSync(spaDir, { recursive: true });

for (const distDir of distDirs) {
  for (const dir of copyDirs) {
    const sourceDir = path.resolve(root, `dist/${distDir}/${dir}`);
    const targetDir = path.resolve(spaDir, dir);

    if (!existsSync(sourceDir)) continue;

    cpSync(sourceDir, targetDir, { recursive: true });
    console.log(`Copied dist/${distDir}/${dir} -> public/spa/${dir}`);
  }
}
