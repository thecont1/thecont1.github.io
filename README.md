# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Commands

| Command | Description |
|---------|-------------|
| `npm install` | Install dependencies |
| `npm run dev` | Start dev server at `localhost:4321` |
| `npm run build` | Build production site to `./dist/` |
| `npm run preview` | Preview production build locally |
| `npm run astro add <integration>` | Add Astro integrations |
| `npm run astro check` | Run Astro type checking |

## Tech Stack

- **Framework**: Astro 5.x with React 19 integration
- **Language**: TypeScript (strict mode via `astro/tsconfigs/strict`)
- **Styling**: Plain CSS (no Tailwind/preprocessors)
- **Content**: Astro Content Collections with Zod schemas

## Architecture

### Content Collections (`src/content/`)

Three collections defined in `src/content/config.ts` with a shared schema:
- `photography/` - Photo project entries
- `essays/` - Text-based writing
- `datascience/` - Data science projects

Each collection uses the same base schema:
```ts
{ title, excerpt, status: "draft" | "published", heroImage?: string }
```

Content is filtered by `status === "published"` when queried.

### Component Pattern

- **`.astro` files**: Static/server-rendered components (layouts, pages, structural components)
- **`.tsx` files**: React components for client-side interactivity (use `client:load` directive)

Example: `HomeHero.astro` wraps `Carousel.tsx` with `client:load` for hydration.

### Hero Carousel System

The homepage hero uses a scroll-driven "curtain lift" animation:

1. `HomeHero.astro` - Globs images from `/public/library/originals/collection/`
2. `Carousel.tsx` - React component with auto-play, manual navigation, caption toggle
3. `curtain-scroll-fallback.js` - JS fallback for browsers without CSS `animation-timeline: scroll()`
4. `.hero-statement` element slides up as user scrolls, revealing carousel beneath

### Public Scripts (`public/`)

Vanilla JS loaded via `<script>` tags (not bundled):
- `snow.js` - Animated snowfall canvas effect with toggle button, respects `prefers-reduced-motion`
- `textmode.js` - Text-only mode toggle
- `curtain-scroll-fallback.js` - Scroll animation polyfill

### Image Handling

- Hero images referenced via `heroImage` frontmatter field (path like `/public/library/originals/...`)
- `normalizePublicPath()` strips `/public/` prefix for browser URLs
- `hasPublicFile()` checks file existence at build time before rendering `<img>`

### CSS Architecture

Single `src/styles/home.css` file contains all homepage styles including:
- Site header with dynamic `--nav-bg-alpha` CSS variable (controlled by scroll JS)
- Carousel styles
- Project cards grid
- Responsive breakpoints

The `--nav-bg-alpha` variable is set by `curtain-scroll-fallback.js` based on scroll position, enabling smooth header background transitions.
