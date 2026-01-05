import chokidar from 'chokidar';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = path.resolve(__dirname, '../src/content');
const CONFIG_PATH = path.resolve(__dirname, '../src/content/config.ts');

const ORIGINALS_DIR = path.resolve(__dirname, '../public/library/originals');
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg']);

/**
 * A simplified schema extractor that parses config.ts directly to avoid 
 * 'astro:content' import issues during the config loading phase.
 */
function extractSchemasFromConfig(configContent: string) {
  const schemas: Record<string, string[]> = {};
  
  // Basic regex to find collection definitions
  // e.g., post: defineCollection({ schema: postSchema })
  const collectionRegex = /(\w+):\s*defineCollection\s*\(\s*{\s*schema:\s*(\w+)\s*}\s*\)/g;
  let match;
  
  while ((match = collectionRegex.exec(configContent)) !== null) {
    const [_, collectionName, schemaName] = match;
    schemas[collectionName] = [];
    
    // Find the schema definition
    // const postSchema = baseSchema; OR const essaySchema = baseSchema.extend({ ... })
    const schemaDefRegex = new RegExp(`const\\s+${schemaName}\\s*=\\s*(?:baseSchema|z\\.object\\s*\\()([\\s\\S]*?)(?:\\);|\\n\\n)`, 'm');
    const schemaMatch = schemaDefRegex.exec(configContent);
    
    if (schemaMatch) {
      const body = schemaMatch[1];
      // Extract keys (very basic)
      const keyRegex = /^\s*(\w+):\s*z\./gm;
      let keyMatch;
      while ((keyMatch = keyRegex.exec(body)) !== null) {
        schemas[collectionName].push(keyMatch[1]);
      }
      
      // If it extends baseSchema, add base keys
      if (schemaMatch[0].includes('baseSchema')) {
        const baseMatch = /const\s+baseSchema\s*=\s*z\.object\s*\(\s*{([\s\S]*?)}\s*\)/m.exec(configContent);
        if (baseMatch) {
          const baseKeyRegex = /^\s*(\w+):\s*z\./gm;
          let baseKeyMatch;
          while ((baseKeyMatch = baseKeyRegex.exec(baseMatch[1])) !== null) {
            if (!schemas[collectionName].includes(baseKeyMatch[1])) {
              schemas[collectionName].push(baseKeyMatch[1]);
            }
          }
        }
      }
    }
  }
  return schemas;
}

function generateFrontmatter(keys: string[], collectionName: string) {
  let yaml = "---\n";
  const today = new Date().toISOString().split('T')[0];
  
  // Sort keys to maintain a consistent order
  const order = ['title', 'excerpt', 'author', 'status', 'date', 'heroImage', 'geography', 'theme', 'container'];
  const sortedKeys = [...keys].sort((a, b) => {
    const idxA = order.indexOf(a);
    const idxB = order.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });

  for (const key of sortedKeys) {
    if (key === 'title') {
      yaml += `${key}: "New ${collectionName.charAt(0).toUpperCase() + collectionName.slice(1)}"\n`;
    } else if (key === 'excerpt') {
      yaml += `${key}: "A brief summary of this ${collectionName}."\n`;
    } else if (key === 'author') {
      yaml += `${key}: "Mahesh Shantaram"\n`;
    } else if (key === 'status') {
      yaml += `${key}: "draft"\n`;
    } else if (key === 'date' || key === 'lastUpdated' || key === 'fetchedAt') {
      yaml += `${key}: ${today}\n`;
    } else if (key === 'heroImage') {
      yaml += `${key}: "https://pub-94814f577b9949a59be8bf7b24fd4963.r2.dev/originals/2016-LastDaysofManmohan/MS201403-02TrivandrumTharoor0001.jpg"\n`;
    } else if (key === 'lightbox') {
      yaml += `${key}:\n  gallery: true\n`;
    } else if (key === 'notebook' && collectionName === 'datastory') {
      yaml += `${key}:\n  engine: "jupyter"\n  entry: ""\n  env: ""\n`;
    } else if (['geography', 'theme', 'tags', 'topics', 'parts', 'images', 'photogalleries', 'essays', 'longforms', 'posts', 'datastories', 'code', 'dependencies', 'devDependencies'].includes(key)) {
      yaml += `${key}: []\n`;
    } else if (['toc', 'showhero'].includes(key)) {
      yaml += `${key}: true\n`;
    } else if (['readingTime', 'stars', 'forks', 'currentPart', 'totalParts'].includes(key)) {
      yaml += `${key}: 0\n`;
    } else {
      yaml += `${key}: ""\n`;
    }
  }
  yaml += "---\n";
  return yaml;
}

function scaffoldFile(filePath: string) {
  const ext = path.extname(filePath);
  if (ext !== '.md' && ext !== '.mdx') return;

  const content = fs.readFileSync(filePath, 'utf8');
  if (content.trim().length > 0) return;

  const configContent = fs.readFileSync(CONFIG_PATH, 'utf8');
  const schemas = extractSchemasFromConfig(configContent);
  
  const relativePath = path.relative(CONTENT_DIR, filePath);
  const collectionName = relativePath.split(path.sep)[0];
  
  const keys = schemas[collectionName];
  if (keys) {
    console.log(`[Scaffold] Populating ${collectionName} at: ${relativePath}`);
    const template = generateFrontmatter(keys, collectionName);
    fs.writeFileSync(filePath, template);
  }
}

function isJpeg(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}

const pendingByDir = new Map<string, NodeJS.Timeout>();
const runningDirs = new Set<string>();
const queuedDirs = new Set<string>();

function runExifForDir(dirName: string) {
  if (!dirName) return;
  if (runningDirs.has(dirName)) {
    queuedDirs.add(dirName);
    return;
  }

  runningDirs.add(dirName);
  const projectRoot = path.resolve(__dirname, '..');

  const cmd = 'uv';
  const args = ['run', 'python', 'scripts/build_exif.py', '--dir', dirName];

  const child = spawn(cmd, args, {
    cwd: projectRoot,
    stdio: 'inherit'
  });

  child.on('exit', (code) => {
    runningDirs.delete(dirName);
    if (queuedDirs.has(dirName)) {
      queuedDirs.delete(dirName);
      runExifForDir(dirName);
      return;
    }

    if (code !== 0) {
      console.error(`[Scaffold] EXIF regeneration failed for ${dirName} (exit ${code})`);
    } else {
      console.log(`[Scaffold] EXIF metadata refreshed: ${dirName}`);
    }
  });
}

function updateMetadataForImagePath(imagePath: string) {
  if (!isJpeg(imagePath)) return;

  const rel = path.relative(ORIGINALS_DIR, imagePath);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return;

  const parts = rel.split(path.sep).filter(Boolean);
  const topDir = parts[0];
  if (!topDir) return;

  const existing = pendingByDir.get(topDir);
  if (existing) clearTimeout(existing);
  pendingByDir.set(
    topDir,
    setTimeout(() => {
      pendingByDir.delete(topDir);
      runExifForDir(topDir);
    }, 750)
  );
}

function listTopLevelOriginalsDirs(): string[] {
  if (!fs.existsSync(ORIGINALS_DIR)) return [];
  return fs
    .readdirSync(ORIGINALS_DIR)
    .filter((name) => {
      const full = path.join(ORIGINALS_DIR, name);
      try {
        return fs.statSync(full).isDirectory();
      } catch {
        return false;
      }
    });
}

function getNewestJpegMtimeMsInTree(rootDir: string): number {
  let newest = 0;
  const stack: string[] = [rootDir];
  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const ent of entries) {
      if (ent.name.startsWith('.')) continue;
      const full = path.join(current, ent.name);
      if (ent.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (!ent.isFile()) continue;
      if (!isJpeg(full)) continue;
      try {
        const m = fs.statSync(full).mtimeMs;
        if (m > newest) newest = m;
      } catch {
        // ignore
      }
    }
  }
  return newest;
}

function shouldRegenerateDir(topDir: string): boolean {
  const dirPath = path.join(ORIGINALS_DIR, topDir);
  const metadataPath = path.join(dirPath, 'metadata.json');

  if (!fs.existsSync(metadataPath)) return true;

  const newestImageMtime = getNewestJpegMtimeMsInTree(dirPath);
  if (!newestImageMtime) return false;

  try {
    const metaMtime = fs.statSync(metadataPath).mtimeMs;
    return newestImageMtime > metaMtime;
  } catch {
    return true;
  }
}

function runStartupOriginalsSync() {
  const dirs = listTopLevelOriginalsDirs();
  if (!dirs.length) return;

  const toRegen = dirs.filter(shouldRegenerateDir);
  if (!toRegen.length) {
    console.log('[Scaffold] Originals metadata up-to-date.');
    return;
  }

  console.log(`[Scaffold] Originals startup sync: regenerating metadata for ${toRegen.length} folder(s)...`);
  for (const d of toRegen) runExifForDir(d);
}

export default function scaffoldIntegration() {
  return {
    name: 'astro-auto-scaffold',
    hooks: {
      'astro:config:setup': ({ command }: { command: string }) => {
        if (command === 'dev') {
          console.log('[Scaffold] Starting content watcher...');
          const watcher = chokidar.watch(CONTENT_DIR, {
            ignored: /(^|[\/\\])\../,
            persistent: true,
            ignoreInitial: true
          });

          watcher.on('add', (filePath) => {
            setTimeout(() => scaffoldFile(filePath), 100);
          });

          runStartupOriginalsSync();

          console.log('[Scaffold] Starting originals image watcher (jpg/jpeg)...');
          const imageWatcher = chokidar.watch(ORIGINALS_DIR, {
            ignored: /(^|[\/\\])\../,
            persistent: true,
            ignoreInitial: true
          });

          const scheduleUpdate = (filePath: string) => {
            if (!isJpeg(filePath)) return;
            setTimeout(() => updateMetadataForImagePath(filePath), 150);
          };

          imageWatcher.on('add', scheduleUpdate);
          imageWatcher.on('change', scheduleUpdate);
          imageWatcher.on('unlink', scheduleUpdate);
        }
      }
    }
  };
}
