import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, extname } from 'path';

const ICON_REGEX = /\bIcon[A-Z][a-zA-Z0-9]*/g;
const SOURCE_DIR = 'src';
const SHIM_FILE = 'src/icons-shim/index.ts';

function findFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findFiles(fullPath));
    } else if (['.ts', '.tsx'].includes(extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

function extractIcons(files: string[]): string[] {
  const icons = new Set<string>();

  for (const file of files) {
    const content = readFileSync(file, 'utf-8');
    const matches = content.match(ICON_REGEX);
    if (matches) matches.forEach((icon) => icons.add(icon));
  }

  return [...icons].sort();
}

function generateShim(icons: string[]) {
  const lines = icons.filter(icon => icon !== 'IconComponent').map(
    (icon) =>
      `export { default as ${icon} } from '@tabler/icons-react/dist/esm/icons/${icon}.mjs';`
  );

  mkdirSync('src/icons-shim', { recursive: true });
  writeFileSync(SHIM_FILE, lines.join('\n') + '\n');

  console.log(`✅ Generated ${SHIM_FILE} with ${icons.length} icons.`);
}

const files = findFiles(SOURCE_DIR);
const icons = extractIcons(files);
generateShim(icons);
