import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, extname, resolve } from 'path';

const ICON_REGEX = /\bIcon[A-Z][a-zA-Z0-9]*/g;
const ICON_NAME_REGEX = /iconName:\s*["'](\bIcon[A-Z][a-zA-Z0-9]*)["']/g;

const FRONT_CORE_DIR = resolve(import.meta.dir, '../..');
const SHIM_FILE = resolve(FRONT_CORE_DIR, 'src/icons-shim/icons.ts');

function findFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
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
    let m;
    const regex = new RegExp(ICON_NAME_REGEX.source, ICON_NAME_REGEX.flags);
    while ((m = regex.exec(content)) !== null) {
      icons.add(m[1]);
    }
  }

  return [...icons].sort();
}

function findTablerIconsDir(): string | null {
  // Walk up from FRONT_CORE_DIR looking for node_modules with @tabler/icons-react
  let dir = FRONT_CORE_DIR;
  for (let i = 0; i < 10; i++) {
    const candidate = join(dir, 'node_modules', '@tabler', 'icons-react', 'dist', 'esm', 'icons');
    if (existsSync(candidate)) return candidate;
    // Check bun's .bun directory
    const bunModules = join(dir, 'node_modules', '.bun');
    if (existsSync(bunModules)) {
      const entries = readdirSync(bunModules).filter(e => e.startsWith('@tabler+icons-react'));
      for (const entry of entries) {
        const bunCandidate = join(bunModules, entry, 'node_modules', '@tabler', 'icons-react', 'dist', 'esm', 'icons');
        if (existsSync(bunCandidate)) return bunCandidate;
      }
    }
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function generateShim(icons: string[]) {
  const iconsDir = findTablerIconsDir();
  const filtered = icons.filter(icon => {
    if (icon === 'IconComponent' || icon === 'IconProps') return false;
    if (iconsDir && !existsSync(join(iconsDir, `${icon}.mjs`))) {
      console.warn(`[shim] Skipping ${icon} — not found in @tabler/icons-react`);
      return false;
    }
    return true;
  });

  const lines = filtered.map(
    (icon) =>
      `export { default as ${icon} } from '@tabler/icons-react/dist/esm/icons/${icon}.mjs';`
  );

  mkdirSync(resolve(FRONT_CORE_DIR, 'src/icons-shim'), { recursive: true });
  writeFileSync(SHIM_FILE, lines.join('\n') + '\n');

  console.log(`[shim] Generated ${SHIM_FILE} with ${filtered.length} icons.`);
}

// Scan front-core/src + any extra dirs passed as args
const scanDirs = [resolve(FRONT_CORE_DIR, 'src')];
for (const arg of process.argv.slice(2)) {
  scanDirs.push(resolve(arg));
}

const allFiles: string[] = [];
for (const dir of scanDirs) {
  allFiles.push(...findFiles(dir));
}

const icons = extractIcons(allFiles);
generateShim(icons);
