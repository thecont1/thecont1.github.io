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
    
### Direct Astro CLI
```bash
npm run astro            # Access Astro CLI directly
```

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
  - Required: `title`, `excerpt`, `status` (private/draft/published)
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
- **Tools**: Requires `c2patool` in a sibling directory (`../c2patool/.venv/bin/python3`).
- **Styles**: Custom overlay and indicator styles in `src/styles/c2pa.css`.
- **Scripts**: Core extraction logic lives in `scripts/c2pa_xtract.py`.

### Image Metadata (EXIF) + `metadata.json`
- **Build-time extraction**: `scripts/build_exif.py` scans `public/library/originals/` and writes co-located `metadata.json` files per directory.
- **Scoped extraction**: `scripts/build_exif.py --dir <TOP_FOLDER>` regenerates metadata only for that subtree under `public/library/originals/`.
- **Dev-time watcher**: `scripts/scaffold-integration.ts` (Astro integration) watches:
  - `src/content/**` to auto-scaffold new empty `.md/.mdx`
  - `public/library/originals/**/*.{jpg,jpeg}` to keep `metadata.json` up-to-date by running the scoped Python extractor
- **Startup sync in dev**: on `npm run dev`, the integration scans `public/library/originals/` and regenerates metadata for any folder whose newest JPG/JPEG is newer than `metadata.json`.
- **R2 CDN Migration**: Images are now served from Cloudflare R2 (https://pub-94814f577b9949a59be8bf7b24fd4963.r2.dev/originals/). Local `public/library/originals/` is maintained for metadata extraction and C2PA processing.
- **Metadata Sync**: Run `scripts/sync_r2_metadata.sh` to download images from R2, regenerate metadata.json files, and upload metadata back to R2. This keeps metadata in sync across both local and CDN.

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

- **Platform**: GitHub Pages
- **Workflow**: `.github/workflows/astro.yml` handles CI/CD
- **Build output**: Static site to `./dist/`
- **Site URL**: https://thecont1.github.io

## Content Authoring

When creating new content:
1. Add Markdown file to appropriate `src/content/{collection}/` directory
2. Include required frontmatter: title, excerpt, status
3. Set `status: "published"` to make content visible
4. Use taxonomy fields (geography, theme, container) for organization
5. Specify `layout` to control rendering template
6. For notebooks, add `notebook` object with engine and entry details

## Key Constraints

- Content must validate against Zod schemas in `src/content/config.ts`
- Geography limited to max 2 values, themes to max 5
- Status must be one of: private, draft, published
- React version 19 requires compatible component patterns
- Astro 5.x uses latest conventions (check docs for breaking changes from v4)
