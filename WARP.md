# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

Personal website for Mahesh Shantaram (thecontrarian.in) — a documentary photographer, data scientist, and visual artist. Built with Astro 5.x + React 19, serving as a long-term archive, public thinking space, and data-driven storytelling platform.

## Commands

### Development
```bash
npm install              # Install dependencies
npm run dev              # Start dev server at localhost:4321
npm run build            # Build production site to ./dist/
npm run preview          # Preview production build locally
npm run astro check      # Run Astro type checking
```

### Utility Scripts
```bash
npm run astro            # Access Astro CLI directly
npm run extract:exif     # Extract EXIF metadata locally (see use cases below)
npm run r2:upload        # End-to-end: extract metadata + upload to R2
npm run deploy           # Full deployment: R2 sync + build + FTP upload
```

**EXIF Extraction Use Cases:**
- **Local-only updates**: `npm run extract:exif` - Regenerate all metadata without R2 upload
- **Specific directory**: `npm run extract:exif -- --dir DIRECTORY` - Update one folder only
- **End-to-end workflow**: `npm run r2:upload` - Extract metadata AND upload to R2 (recommended for new images)

## Architecture

### Content System
- **Content Collections**: Defined in `src/content/config.ts` with strict typing via Zod schemas
- **Collections**: 
  - `post` - Simple text page (blog post)
  - `essay` - Complex content designed for reading (The New Yorker style)
  - `longform` - Multi-page essay with parts
  - `code` - GitHub repository presentation
  - `datastory` - Jupyter/Marimo notebook presentation
  - `photogallery` - Photo/video collection with explicit image lists and layout options (tile/one-up/carousel)
  - `project` - Collection of related content using Collection References
- **Content Location**: Markdown files in `src/content/{collection-name}/`
- **Schema Structure**:
  - Required: `title`, `subtitle`, `status` (private/draft/published)
  - Taxonomy: `geography[]`, `theme[]`
  - Optional: `date`, `heroImage`, `lightbox` settings, `backgroundColor` (for page background)
  - Datastory: requires `notebook` object with `engine` (marimo/jupyter) and `entry`
  - Photogallery: `images[]` array with `src`, `caption`, `alt`; `layoutType` (tile/one-up/carousel)
  - Project: Collection References to `photogalleries`, `essays`, `longforms`, `posts`, `datastories`, `code`

### GitHub Integration (Code Layout)
- **Integration**: `src/integrations/github.ts` - GitHub API utilities for fetching repo data
- **Content Generator**: `src/integrations/github-content.ts` - Astro integration for auto-generating code content
- **Layout**: `src/components/layouts/Code.astro` - Display template for GitHub repositories
- **Component**: `src/components/ui/GitHubRepo.astro` - Reusable component for embedding repos
- **Styles**: `src/styles/code.css` - Code layout styling
- **Collection**: `src/content/code/` - Generated markdown files for repositories

### Content Credentials (C2PA)
- **Live Extraction**: Managed via `src/pages/api/c2pa.ts`, which calls a Python extraction script.
- **Python Dependencies**: Uses `c2pa-python` library (v0.27.0+) installed via UV in local `.venv`
- **API Endpoint**: `/api/c2pa` accepts image path and returns full manifest with validation status
- **Python Resolution**: Automatically finds Python in `.venv/bin/python3` or falls back to system Python
- **Styles**: Custom overlay and indicator styles in `src/styles/c2pa.css`.
- **Scripts**: Core extraction logic in `scripts/c2pa_xtract.py` (uses `c2pa` Python package from Reader class)

### Image Metadata (EXIF) + `metadata.json`
- **Manual extraction**: `scripts/build_exif.py` scans `public/library/originals/` and writes co-located `metadata.json` files per directory.
- **Scoped extraction**: `scripts/build_exif.py --dir <TOP_FOLDER>` regenerates metadata only for that subtree under `public/library/originals/`.
- **Junk file purging**: Script automatically purges system junk files (`.DS_Store`, `Thumbs.db`, `.localized`) from all directories under `public/library/` on every run.
- **Dev-time scaffolding**: `scripts/scaffold-integration.ts` (Astro integration) watches `src/content/**` to auto-scaffold new empty `.md/.mdx`.
- **R2 CDN Migration**: Images are now served from Cloudflare R2 (https://pub-94814f577b9949a59be8bf7b24fd4963.r2.dev/originals/). Local `public/library/originals/` is maintained for metadata extraction and C2PA processing.
- **R2 Upload**: Run `scripts/upload_to_r2.sh` to generate metadata and sync entire `public/library/` to R2 (local is source of truth, remote files not in local will be deleted). Optionally pass a directory name to sync only that subdirectory: `scripts/upload_to_r2.sh <DIR_NAME>`.
  1. Generate metadata.json files locally
  2. Purge junk files from all directories
  3. Upload both images and metadata to R2 using rclone
  - Optionally target specific directory: `bash scripts/upload_to_r2.sh DIRECTORY`
  - Requires env vars: `CLOUDFLARE_ACCESS_KEY_ID`, `CLOUDFLARE_SECRET_ACCESS_KEY`, `CLOUDFLARE_R2_ENDPOINT`, `CLOUDFLARE_BUCKET_NAME`

### Homepage Featured Content
- **Manual Control**: `src/data/featured.ts` - curated list of featured items
- **No Auto-fetch**: Homepage "The Projects" section uses manual selection
- **Supports**: Flat list or grouped sections layout
- **Override Options**: Custom display title, excerpt, image, and labels per item

### Components
- **Location**: `src/components/`
- **Mixed stack**: Astro components (.astro) + React components (.tsx)
- **React integration**: Via `@astrojs/react` for interactive features
- **File-based routing**: `src/pages/` directory
- **Main sections**: `/photogallery`, `/essay`, `/longform`, `/post`, `/datastory`, `/code`, `/project`
- **Dynamic routes**: Collections generate pages via `[...slug].astro` pattern
- **Index**: Home page at `src/pages/index.astro`
- **Auto-scaffolding**: `scripts/scaffold-integration.ts` - Astro integration that auto-creates empty markdown files for new content and watches for image changes

### Carousel System
- **Components**: 
  - `src/components/carousel/Carousel.tsx` - Main carousel component with autoplay, drag detection, and metadata support
  - `src/components/carousel/InfoPanel.tsx` - Metadata display panel with C2PA integration
  - `src/components/carousel/CaptionToggle.tsx` - Info button toggle component
- **Features**:
  - **Smart Autoplay**: 5-second intervals, stops on user interaction (drag, navigation), resumes when curtain returns
  - **User Interaction Detection**: Trackpad scrolling, mouse drag, keyboard arrows, navigation buttons
  - **Metadata Integration**: Loads `metadata.json` from image folders, displays camera settings, descriptions, copyright
  - **C2PA Integration**: Content Credentials verification via existing C2PA overlay system
  - **Responsive Design**: Adapts info panel position for mobile devices
- **Homepage/Photogallery carousel metadata**: `src/components/home/Hero.astro` and `src/components/layouts/Photogallery.astro` load `metadata.json` per image directory (not just the first image’s folder).
- **Usage**: Homepage hero, photogallery carousel layout, project carousels
- **Styling**: `src/styles/carousel.css` - All carousel-related styles including info panel

### Routing & Pages
- **File-based routing**: `src/pages/` directory
- **Main sections**: `/photogallery`, `/essay`, `/longform`, `/post`, `/datastory`, `/code`, `/project`
- **Dynamic routes**: Collections generate pages via `[...slug].astro` pattern
- **Index**: Home page at `src/pages/index.astro`
- **Static assets**: `public/` directory (served as-is)
- **High-resolution media**: Served from Cloudflare R2 CDN (https://pub-94814f577b9949a59be8bf7b24fd4963.r2.dev/originals/)
- **Local library**: `public/library/originals/` maintained locally for metadata extraction and C2PA processing
- **About images**: `public/library/about/` (used by `src/components/home/About.astro`)
- **Metadata**: `metadata.json` files in image folders contain EXIF data, descriptions, and technical details (also uploaded to R2)

### Styling
- **Vanilla CSS3**: No CSS framework.
- **Global styles**: `src/styles/global.css` (variables and core styles).
- **Component styles**: 
  - `src/styles/carousel.css` - All carousel-related styles (homepage hero, photogallery carousel layout, controls, animations, curtain effects)
  - `src/styles/hero.css` - Homepage hero-specific styles (minimal after carousel refactor)
  - `src/styles/photogallery.css` - Photogallery layouts (tile, one-up)
  - `src/styles/post.css` - Post layout styling with hover info panels
  - `src/styles/info-panel.css` - Metadata info panel styling for both carousel and post layouts
  - `src/styles/code.css` - Code layout styling
  - `src/styles/c2pa.css` - C2PA overlay and indicator styles
- **Carousel Layout Features**:
  - **Curtain System**: Title/subtitle overlay with backgroundColor transparency and blur effects
  - **Scroll-driven Animations**: CSS `animation-timeline: scroll()` with JavaScript fallbacks
  - **Smart Autoplay**: Pauses when user takes control, resumes when curtain returns
  - **Responsive Controls**: Navigation buttons appear/disappear based on scroll position
  - **Footer Integration**: Carousel shifts up minimally to accommodate footer without overlap
- **Z-Index Hierarchy**:
  - `SiteHeader`: 100
  - `ContentsToggle` Sidebar: 500
  - `SiteFooter`: 2000 (Ensures visibility over sliding panels)
  - `C2PAOverlay`: 20000
- **Layout system**: `src/layouts/` for page templates

## Data Science Integration

The site integrates computational notebooks for data storytelling:
- **DuckDB**: For data queries and analysis
- **Marimo/Jupyter**: Interactive notebooks embedded via `notebook` frontmatter
- Specify notebook engine, entry point, and environment in content frontmatter

## Deployment

### Production Deployment (thecontrarian.in)
- **Platform**: cPanel hosting via FTP
- **Script**: `npm run deploy` (wraps `deploy.sh`)
- **Build output**: Static site to `./dist/client/` (client) and `./dist/server/` (server)
- **Site URL**: https://thecontrarian.in
- **Deployment Steps**:
  1. R2 Sync: Extract EXIF metadata + upload to Cloudflare R2
  2. Build: Astro static build with server-side rendering
  3. Clean: Remove `dist/client/library` (served from R2 CDN)
  4. FTP Upload: Deploy to remote `public_html/` and `server/` via lftp
- **Scripts**:
  - `deploy.sh` - Master orchestration script
  - `scripts/deploy_ftp.sh` - FTP mirroring with lftp
  - `scripts/upload_to_r2.sh` - R2 sync via rclone
- **Options**:
  - `--skip-r2` - Skip R2 sync
  - `--skip-build` - Skip Astro build
  - `--skip-ftp` - Skip FTP deployment
  - `--r2-dir DIR` - Only sync specific directory to R2
- **Requirements**: 
  - `lftp` for FTP mirroring
  - `rclone` for R2 sync
  - Environment variables: `THECONT1_FTP_PASSWORD`, R2 credentials

### Development Deployment (GitHub Pages)
- **Platform**: GitHub Pages
- **Workflow**: `.github/workflows/astro.yml` handles CI/CD
- **Site URL**: https://thecont1.github.io
- **Requirements**: Node.js 20, Python 3.12, UV package manager

## Content Authoring

When creating new content:
1. Add Markdown file to appropriate `src/content/{collection}/` directory
2. Include required frontmatter: title, excerpt, status
3. Set `status: "published"` to make content visible
4. Use taxonomy fields (geography, theme, container) for organization
5. Specify `layout` to control rendering template
6. For notebooks, add `notebook` object with engine and entry details

## Post Layout Features

- **Hover Info Panels**: Images in Post layout show metadata panel on hover
- **Metadata Display**: Dynamically loads `metadata.json` for each image's directory
- **C2PA Integration**: Content Credentials button integrated into info panel
- **Background Color Support**: Custom `backgroundColor` frontmatter property applies to entire page, header, and body
- **Image Captions**: Auto-generates `<figure>` and `<figcaption>` from markdown alt text
- **Orientation Detection**: Automatically detects and styles vertical/horizontal images
- **Note Component**: Supports floating callouts in Post and Essay layouts via `<Note>` component

## TypeScript Configuration

### Type Safety Status
- **100% type coverage** across all Astro components
- **Clean TypeScript compilation** with strict type checking
- **Zero errors, zero warnings** in `npm run astro check`
- **Global type declarations**: `src/types/global.d.ts` for custom window properties

### Major Type Safety Improvements (Jan 2026)
Completed comprehensive TypeScript error resolution (183 errors → 0 errors):

**Schema Enhancements:**
- Added `category` field to essay, longform, and post schemas
- Added `author` field to project and photogallery schemas  
- Enhanced datastory schema with `author`, `lightbox`, and `toc` fields
- Fixed collection naming: `datastory` (not `datastories`)

**Type Declarations:**
- Created `src/types/global.d.ts` for window/globalThis properties:
  - `__PUBLIC_R2_CDN_ORIGIN`: CDN origin URL
  - `__postMetadataCache`: Post metadata caching
  - `__lightboxMetadataCache`: Lightbox metadata caching  
  - `__attachLightboxListeners`: Lightbox listener function
- Added class property declarations to C2PAManager
- Fixed implicit `any` types across all components

**Component Type Safety:**
- All DOM manipulation code properly typed (Element → HTMLElement)
- Event handlers with explicit `this` typing
- Proper typing for `setTimeout` return values (`ReturnType<typeof setTimeout>`)
- Collection reference map operations with type assertions
- Fixed language color maps with `Record<string, string>`

**Astro 5.x Compatibility:**
- Migrated from deprecated `ViewTransitions` to `ClientRouter`
- Added `is:inline` directives to all external script tags
- Updated script handling for new Astro 5.x behavior

**Best Practices:**
- Use type assertions (`as HTMLElement`) for DOM queries
- Prefix unused parameters with underscore (`_param`)
- Use `ReturnType<typeof fn>` for complex return types
- Cast browser-specific properties: `(element.style as any).webkitBackdropFilter`
- Type collection references: `.map((ref: any) => ref())`

## Key Constraints

- Content must validate against Zod schemas in `src/content/config.ts`
- Geography limited to max 2 values, themes to max 5
- Status must be one of: private, draft, published
- React version 19 requires compatible component patterns
- Astro 5.x uses latest conventions (check docs for breaking changes from v4)
- Python environment managed via UV (specified in `pyproject.toml`)
- TypeScript strict mode enabled - all components must be fully typed
