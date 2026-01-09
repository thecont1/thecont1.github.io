import chokidar from 'chokidar';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = path.resolve(__dirname, '../src/content');
const CONFIG_PATH = path.resolve(__dirname, '../src/content/config.ts');

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
        }
      }
    }
  };
}
