import { defineCollection, reference, z } from "astro:content";
import { glob } from "astro/loaders";

// ============================================================================
// TAXONOMY ENUMS
// ============================================================================
const geographyEnum = z.enum([
  "bangalore", "india", "africa", "europe", "usa", "asia", "middle-east", "airtime"
]);
const themeEnum = z.enum([
  "weddings", "travel", "society", "justice", "technology", "motorcycling", "patriarchy",
  "humour", "interview", "lore", "night", "racism", "india", "portraits"
]);
const containerEnum = z.enum([
  "matrimania", "the-african-portraits", "last-days-of-manmohan", "magazine-work", 
  "indiacomestogether", "caerdydd-diary", "bruxelles-diary", "conakry-diary", "facebook"
]);

// ============================================================================
// SHARED BASE SCHEMA (for text-based content)
// ============================================================================
const baseSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  author: z.string(),
  status: z.enum(["private", "draft", "published"]),
  heroImage: z.string().optional(),

  // SEO
  metaDescription: z.string().max(160).optional(),
  
  // Taxonomy
  geography: z.array(geographyEnum).max(2).optional().default([]),
  theme: z.array(themeEnum).max(5).optional().default([]),
  container: containerEnum.optional(),

  // Dates
  date: z.date().optional(),
  
  // Lightbox settings
  lightbox: z.object({
    gallery: z.boolean().optional().default(true),
  }).optional().default({ gallery: true }),

  // Table of Contents control
  toc: z.boolean().optional().default(false),

  // Appearance
  backgroundColor: z.string().optional(),

  // Hero Image visibility control
  showhero: z.boolean().optional().default(true)
});

// ============================================================================
// 1. POST - Simple text page (blog post)
// ============================================================================
const postSchema = baseSchema.extend({
  category: z.string().optional(),
});

// ============================================================================
// 2. ESSAY - More complex, designed for reading (The New Yorker style)
// ============================================================================
const essaySchema = baseSchema.extend({
  // Essays typically have more metadata
  readingTime: z.number().optional(), // minutes
  series: z.string().optional(),
  category: z.string().optional(),
});

// ============================================================================
// 3. LONGFORM - Multi-page essay
// ============================================================================
const longformSchema = baseSchema.extend({
  // Multi-page structure
  parts: z.array(z.object({
    title: z.string(),
    slug: z.string(),
  })).optional(),
  currentPart: z.number().optional(),
  totalParts: z.number().optional(),
  category: z.string().optional(),
});

// ============================================================================
// 4. CODE - GitHub repository presentation
// ============================================================================
const codeSchema = z.object({
  title: z.string(),
  author: z.string(),
  description: z.string().optional(),
  subtitle: z.string().optional(),
  status: z.enum(["private", "draft", "published"]).default("published"),
  
  // Repository metadata
  repoUrl: z.url(),
  repoOwner: z.string(),
  repoName: z.string(),
  language: z.string().optional(),
  stars: z.number().optional(),
  forks: z.number().optional(),
  license: z.string().optional(),
  homepage: z.url().optional(),
  
  // Dates
  date: z.date().optional(),
  lastUpdated: z.date().optional(),
  
  // Tags and topics
  tags: z.array(z.string()).default([]),
  topics: z.array(z.string()).default([]),
  
  // Dependencies and tech stack
  dependencies: z.array(z.string()).default([]),
  devDependencies: z.array(z.string()).default([]),
  
  // Appearance
  backgroundColor: z.string().optional(),
  
  // GitHub API data cache
  apiData: z.object({
    fetchedAt: z.date(),
    readme: z.string().optional(),
    fileTree: z.array(z.string()).default([]),
    languages: z.record(z.string(), z.number()).optional(),
  }).optional(),
});

// ============================================================================
// 5. DATASTORY - Jupyter/Marimo notebook presentation
// ============================================================================
const datastorySchema = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  metaDescription: z.string().max(160).optional(),
  author: z.string(),
  status: z.enum(["private", "draft", "published"]),
  heroImage: z.string().optional(),
  
  // Lightbox settings
  lightbox: z.object({
    gallery: z.boolean().optional().default(true),
  }).optional().default({ gallery: true }),

  // Notebook configuration (required for datastories)
  notebook: z.object({
    engine: z.enum(["marimo", "jupyter"]),
    entry: z.string(),
    excludeCodeCells: z.boolean().optional().default(false),
  }),
  
  // Taxonomy
  geography: z.array(geographyEnum).max(2).optional().default([]),
  theme: z.array(z.string()).max(5).optional().default([]),
  
  // Dates
  date: z.date().optional(),
  
  // Table of Contents control
  toc: z.boolean().optional().default(false),
  
  // Appearance
  backgroundColor: z.string().optional(),
  showhero: z.boolean().optional().default(true),
});

// ============================================================================
// 6. PHOTOGALLERY - Photo/video collection (replaces photography)
// ============================================================================
const photogallerySchema = z.object({
  // Status first
  status: z.enum(["private", "draft", "published"]),
  
  // Project reference(s) - which Project(s) this gallery belongs to
  project: z.union([z.string(), z.array(z.string())]).optional(),
  
  // Core content
  title: z.string(),
  subtitle: z.string(),
  metaDescription: z.string().max(160).optional(),
  author: z.string(),
  category: z.string().optional(),
  heroImage: z.string().optional(),
  date: z.date().optional(),
  
  // Layout style
  layoutType: z.enum(["tile", "one-up", "carousel"]).default("tile"),
  
  // Taxonomy
  geography: z.array(geographyEnum).max(2).optional().default([]),
  theme: z.array(themeEnum).max(5).optional().default([]),
  
  // Images array - explicit list of images to display
  images: z.array(z.object({
    src: z.string(),
    caption: z.string().optional(),
    alt: z.string().optional(),
  })).default([]),
  
  // Lightbox settings
  lightbox: z.object({
    gallery: z.boolean().optional().default(true),
  }).optional().default({ gallery: true }),
  
  // Appearance
  backgroundColor: z.string().optional().nullable(),
  showhero: z.boolean().optional().default(true),
});

// ============================================================================
// 7. PROJECT - Collection of related content using Collection References
// ============================================================================
const projectSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  author: z.string(),
  status: z.enum(["private", "draft", "published"]),
  heroImage: z.string().optional(),
  
  // Project description (markdown body)
  
  // Collection References - link to other content
  photogalleries: z.array(reference("photogallery")).optional().default([]),
  essays: z.array(reference("essay")).optional().default([]),
  longforms: z.array(reference("longform")).optional().default([]),
  posts: z.array(reference("post")).optional().default([]),
  datastories: z.array(reference("datastory")).optional().default([]),
  code: z.array(reference("code")).optional().default([]),
  
  // Taxonomy
  geography: z.array(geographyEnum).max(2).optional().default([]),
  theme: z.array(themeEnum).max(5).optional().default([]),
  
  // Dates
  date: z.date().optional(),
  
  // Appearance
  backgroundColor: z.string().optional(),
  showhero: z.boolean().optional().default(true),
});

// Helper to strip file extension from entry path so entry.id matches the old entry.slug behavior
const stripExt = ({ entry }: { entry: string }) => entry.replace(/\.(md|mdx)$/, "");

// ============================================================================
// EXPORT COLLECTIONS
// ============================================================================
export const collections = {
  post: defineCollection({
    loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/post", generateId: stripExt }),
    schema: postSchema,
  }),
  essay: defineCollection({
    loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/essay", generateId: stripExt }),
    schema: essaySchema,
  }),
  longform: defineCollection({
    loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/longform", generateId: stripExt }),
    schema: longformSchema,
  }),
  code: defineCollection({
    loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/code", generateId: stripExt }),
    schema: codeSchema,
  }),
  datastory: defineCollection({
    loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/datastory", generateId: stripExt }),
    schema: datastorySchema,
  }),
  photogallery: defineCollection({
    loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/photogallery", generateId: stripExt }),
    schema: photogallerySchema,
  }),
  project: defineCollection({
    loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/project", generateId: stripExt }),
    schema: projectSchema,
  }),
};
