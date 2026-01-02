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
  - `photogallery` - Photo/video collection with explicit image lists and layout options (tile/one-up)
  - `project` - Collection of related content using Collection References
- **Content Location**: Markdown files in `src/content/{collection-name}/`
- **Schema Structure**:
  - Required: `title`, `excerpt`, `status` (private/draft/published)
  - Taxonomy: `geography[]`, `theme[]`
  - Optional: `date`, `heroImage`, `lightbox` settings
  - Datastory: requires `notebook` object with `engine` (marimo/jupyter) and `entry`
  - Photogallery: `images[]` array with `src`, `caption`, `alt`; `layout` (tile/one-up)
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

### Homepage Featured Content
- **Manual Control**: `src/data/featured.ts` - curated list of featured items
- **No Auto-fetch**: Homepage "The Projects" section uses manual selection
- **Supports**: Flat list or grouped sections layout
- **Override Options**: Custom display title, excerpt, image, and labels per item

### Routing & Pages
- **File-based routing**: `src/pages/` directory
- **Main sections**: `/photogallery`, `/essay`, `/longform`, `/post`, `/datastory`, `/code`, `/project`
- **Dynamic routes**: Collections generate pages via `[...slug].astro` pattern
- **Index**: Home page at `src/pages/index.astro`

### Components
- **Location**: `src/components/`
- **Mixed stack**: Astro components (.astro) + React components (.tsx)
- **React integration**: Via `@astrojs/react` for interactive features

### Assets & Media
- **Static assets**: `public/` directory (served as-is)
- **High-resolution media**: `public/library/` for photography and visual content

### Styling
- **Vanilla CSS3**: No CSS framework.
- **Global styles**: `src/styles/global.css` (variables and core styles).
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
