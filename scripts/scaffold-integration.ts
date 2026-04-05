import chokidar from 'chokidar';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = path.resolve(__dirname, '../src/content');

const AUTHOR = "Vikram Nair";

function today() {
  return new Date().toISOString().split('T')[0];
}

const TEMPLATES: Record<string, () => string> = {
  post: () => `---
title: ""
subtitle: ""
author: "${AUTHOR}"
status: draft
date: ${today()}
heroImage: ""
metaDescription: ""
geography: []
theme: []
---
`,

  essay: () => `---
title: ""
subtitle: ""
author: "${AUTHOR}"
status: draft
date: ${today()}
heroImage: ""
metaDescription: ""
geography: []
theme: []
toc: false
readingTime: 5
lightbox:
  gallery: true
---
`,

  longform: () => `---
title: ""
subtitle: ""
author: "${AUTHOR}"
status: draft
date: ${today()}
heroImage: ""
metaDescription: ""
geography: []
theme: []
toc: false
currentPart: 1
totalParts: 1
parts:
  - title: ""
    slug: ""
lightbox:
  gallery: true
---
`,

  datastory: () => `---
title: ""
subtitle: ""
author: "${AUTHOR}"
status: draft
date: ${today()}
heroImage: ""
metaDescription: ""
geography: []
theme: []
toc: false
notebook:
  engine: jupyter
  entry: ""
  excludeCodeCells: false
lightbox:
  gallery: true
---
`,

  photogallery: () => `---
title: ""
subtitle: ""
author: "${AUTHOR}"
status: draft
date: ${today()}
heroImage: ""
metaDescription: ""
geography: []
theme: []
layoutType: tile
images: []
lightbox:
  gallery: true
---
`,

  project: () => `---
title: ""
subtitle: ""
author: "${AUTHOR}"
status: draft
date: ${today()}
heroImage: ""
geography: []
theme: []
photogalleries: []
essays: []
longforms: []
posts: []
datastories: []
code: []
---
`,

  code: () => `---
title: ""
subtitle: ""
author: "${AUTHOR}"
status: draft
date: ${today()}
repoUrl: "https://github.com/owner/repo"
repoOwner: ""
repoName: ""
language: ""
tags: []
topics: []
dependencies: []
devDependencies: []
---
`,
};

function scaffoldFile(filePath: string) {
  const ext = path.extname(filePath);
  if (ext !== '.md' && ext !== '.mdx') return;

  const content = fs.readFileSync(filePath, 'utf8');
  if (content.trim().length > 0) return;

  const relativePath = path.relative(CONTENT_DIR, filePath);
  const collectionName = relativePath.split(path.sep)[0];

  const templateFn = TEMPLATES[collectionName];
  if (templateFn) {
    console.log(`[Scaffold] Populating ${collectionName}: ${relativePath}`);
    fs.writeFileSync(filePath, templateFn());
  } else {
    console.warn(`[Scaffold] No template for collection "${collectionName}", skipping.`);
  }
}

export default function scaffoldIntegration() {
  return {
    name: 'astro-auto-scaffold',
    hooks: {
      'astro:config:setup': ({ command }: { command: string }) => {
        if (command === 'dev') {
          console.log('[Scaffold] Content watcher active.');
          const watcher = chokidar.watch(CONTENT_DIR, {
            ignored: /(^|[\/\\])\../,
            persistent: true,
            ignoreInitial: true,
          });

          watcher.on('add', (filePath) => {
            setTimeout(() => scaffoldFile(filePath), 150);
          });
        }
      }
    }
  };
}
