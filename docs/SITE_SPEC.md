# thecontrarian.in: Website Specification

## 1. PURPOSE & PHILOSOPHY

This website is the definitive, long-term home for all work by Mahesh Shantaram — photography, writing, data science, and whatever else is to come.

It is designed as:

* An archive that grows over decades
* A place for thinking in public
* A system where content outlives design
* A site that serves both humans and machines equally well

This is a home for visual-first intellectually-stimulating content. It could also function as a marketing website, portfolio, or viewing feed for Mahesh Shantaram's varied work.


## 2. CORE STACK (FINAL)

### Content & Authoring

* Markdown + YAML frontmatter
* Git-backed CMS (GitHub login)
* No traditional database for content

### Data & Computation

* DuckDB for private metrics, indexing, and discovery. 
* Marimo notebooks as first-class data posts
* Optional Jupyter support for legacy or external work

### Media Library

* Original hi-resolution images uploaded once
* Automatic generation of responsive derivatives
* CDN delivery

### Build & Delivery

* Static-first architecture
* HTML5, CSS3, modern JavaScript
* WCAG 2.2 compliant
* Core Web Vitals optimized


## 3. INFORMATION ARCHITECTURE

### Top-Level Pages

	/
	├── /about
	├── /works
	├── /services
	└── /contact

Categories are views, not identities.
Canonical URLs never include categories.


## 4. HOMEPAGE BEHAVIOUR

### Visual Structure

* Fullscreen image carousel
* Single page-filling introductory sentence overlaid:

	*Mahesh Shantaram. Documentary Photographer. Data Scientist. Visual Artist. Bangalore, India.*

### Carousel Rules

* Mixed portrait and landscape images allowed
* Images fit inside viewport (object-fit: contain)
* Aspect ratios always preserved
* Auto-advance every 5 seconds
* Calm transitions only
* Thin gap between images

### Scroll Interaction

1. Initial scroll → intro text scrolls away, carousel remains
2. Further scroll → carousel scrolls out, Projects appear

### Captions

* Default: OFF
* User-toggle: “Show captions”
* Captions appear below images, never overlay
* Toggle state persists per session only

### Images Mode (Eye Icon)

* Default: ON
* User-toggle: all images disappear, design adjusts accordingly
* Toggle state persists per session only


## 5. CONTENT MODEL

### Post States (Required)

Every post must have a status:

* `private`   → visible only in CMS

* `draft`     → visible in CMS + preview links

* `published` → public

### Post Frontmatter Schema

```yaml
---
title: ""
slug: ""
date: YYYY-MM-DD

status: private | draft | published

category: photography | writing | data-story | tech-play
layout: post | longform | photo-essay | photo-album | code | timeline | thread
geography: []
theme: []

heroImage: /images/originals/...
excerpt: ""
---
```


## 6. TAG SYSTEM (EXTENSIBLE, GOVERNED)

### Current Canonical Vocabulary

#### Category (exactly one)

* `photography`
* `writing`
* `data-story`
* `tech-play`

#### Layout (exactly one)

* `post` - Classic blog post (text + optional captioned images).
* `photo-essay` - Text interleaved with images (narrative driven).
* `longform` - Multi-part content with sliding Table of Contents (chapters).
* `datastory` - Narrative with executable code blocks (Marimo/Jupyter).
* `project` - Meta-layout combining multiple content pieces (e.g. Essay + Gallery + Interview).

#### Display Components (Internal)

These are used to construct the layouts above:

1. **PhotoAlbum**: Self-arranging image tiles (Masonry/Grid).
2. **Timeline**: Horizontally scrollable series of cards (Chronological).
3. **Carousel**: Fullscreen, calm transition image viewer.
4. **Thread**: Social media style thread format (short bursts of text/media).
5. **Code**: Executable code cell output (static render).

#### Geography (0–2)

* `bangalore`
* `india`
* `africa`
* `europe`
* `usa`
* `asia`
* `middle-east`
* `airtime`

#### Theme (0–5)

* `wedding`
* `travel`
* `society`
* `justice`
* `technology`
* `motorcycling`
* `humour`
* `interview`
* `lore`
* `night`

#### Container (0-1)

* `matrimania`
* `the-african-portraits`
* `last-days-of-manmohan`
* `magazine-work`
* `india-comes-together`
* `caerdydd-diary`
* `bruxelles-diary`
* `conakry-diary`


### Adding New Tags (Explicitly Allowed)

Tags are centrally managed via CMS

Adding a new tag requires:

* Selecting its axis (medium / form / geography / theme)
* Optional description

CMS enforces:

* No duplicates
* No free-text tags at post level
* Existing posts are not auto-retagged

This prevents entropy while allowing evolution.


## 7. IMAGES & MEDIA PIPELINE

### Upload Rules

* Only original, maximum-resolution images are uploaded
* No manual resizing or exporting by the author

### Automatic Derivatives

Generated at build or request time:

* Widths: 1280 / 2048 / 3000 (for 640 / 1024 / 1500 display width respectively)
* Formats: AVIF → WebP → JPEG fallback
* ICC profiles preserved
* Aspect ratio preserved

### Image Metadata Schema

	image:
	caption: ""
	alt: ""
	orientation: portrait | landscape
	focalPoint: center | top | bottom


## 8. DATA SCIENCE POSTS (MARIMO)

Notebook Support

* Marimo is the preferred format
* Jupyter notebooks optionally supported

Notebook Post Example

```yaml
---
title: "Namma Metro Ridership Inspector"
slug: "namma-metro-ridership-inspector"
date: 2025-03-13

medium: datascience
form: code
layout: notebook

status: published

category: data-story
layout: code
geography: ['bangalore']
theme: ['technology', 'travel', 'society']

notebook:
  engine: marimo
  entry: code/namma-metro-ridership-inspector/analysis.py
  env: virtue
---
```

Execution Model
	•	Notebooks execute at build time
	•	Output is frozen to static HTML
	•	No live kernels in production
	•	User has option to download and run locally


## 9. PYTHON ENVIRONMENT STRATEGY

### Tiered Environments

/envs/
  virtue

* Single environment managed by `uv`

* Shared across all posts that need it

* Dependencies pinned via lockfiles


## 10. BIOGRAPHY PAGE

### Timeline

* Horizontally scrollable
* Newest → oldest
* Scroll via mouse, trackpad, drag, keyboard
* Reference image attached: Carrie Mae Weems timeline 

### Event Types

* Text
* Image
* Image + text

### Event Schema

```yaml
---
id: photoproject-2015-matrimania
dateStart: 2008
dateEnd: 2015
title: "MATRIMANIA"
media:
  type: image
  src: /images/originals/matrimania/cover.jpg
description: >
  Days of mirth and merriment, dance and debauchery, prayer and pretence go by before the inevitable night appears.
relatedSlugs:
  - matrimania
---
```


## 11. SEARCH & DISCOVERY

### Search

* Full-text + metadata search
* Keyboard-first (Cmd/Ctrl + K)
* Grouped by medium

### Discovery

* Related content by shared tags + temporal proximity
* Tag landing pages (e.g. /theme/wedding)
* Biography ↔ content cross-linking


## 12. PRIVATE METRICS (AUTHOR-ONLY)

### Tracked (No Cookies)

* Page views (10d / 30d / 90d / 180d / 360d / all)
* Top referrers
* Entry pages

### Storage

* DuckDB (private)
* Nightly aggregation

### CMS Display

* Read-only metrics per post
* Never visible publicly
* Available for view at /metrics when logged in


## 13. FOLDER STRUCTURE (CANONICAL)

```
.
├── public
│   ├── library
│   │   └── originals
│   │       ├── african-portraits
│   │       ├── matrimania
│   │       ├── caerdydd-diary
│   │       └── tcnwm
│   │       └── weddings
├── src
│   ├── assets
│   ├── components
│   │   ├── home
│   │   │   ├── CaptionToggle.tsx
│   │   │   ├── Carousel.tsx
│   │   │   ├── HeroStatement.astro
│   │   │   ├── HomeHero.astro
│   │   │   └── ImageModeToggle.tsx
│   │   └── SiteHeader.astro
│   ├── content
│       ├── matrimania
│       │   ├── bond-and-bondage.md
│       │   ├── matrimania-series.md
│       │   └── geo-magazine-interview.md
│       ├── magazine-work
│       │   ├── 2025-01-nytimes.md
│       │   ├── 2024-03-washington-post.md
│       │   └── 2017-02-vanity-fair.md
│       └── caerdydd-diary
│           ├── photo-series.md
│           ├── foam-magazine-interview.md
│           ├── book-review-mazures.md
│           ├── letters-from-cardiff.md
│           └── visiting-arts-contract.md
```


## 14. NON-GOALS

* No comments
* No user accounts
* No personalization
* No ad tech
* No social feeds


15. LONG-TERM PRINCIPLES

* URLs never change
* Content is portable
* Design may evolve
* Archives must remain readable forever

