import { defineCollection, reference, z } from "astro:content";
import { glob } from "astro/loaders";

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

const baseSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  author: z.string(),
  status: z.enum(["private", "draft", "published"]),
  heroImage: z.string().optional(),
  metaDescription: z.string().max(160).optional(),
  geography: z.array(geographyEnum).max(2).optional().default([]),
  theme: z.array(themeEnum).max(5).optional().default([]),
  container: containerEnum.optional(),
  date: z.date().optional(),
  lightbox: z.object({
    gallery: z.boolean().optional().default(true),
  }).optional().default({ gallery: true }),
  toc: z.boolean().optional().default(false),
  backgroundColor: z.string().optional(),
  showhero: z.boolean().optional().default(true)
});

const postSchema = baseSchema.extend({
  category: z.string().optional(),
});

const essaySchema = baseSchema.extend({
  readingTime: z.number().optional(),
  series: z.string().optional(),
  category: z.string().optional(),
});

const longformSchema = baseSchema.extend({
  parts: z.array(z.object({
    title: z.string(),
    slug: z.string(),
  })).optional(),
  currentPart: z.number().optional(),
  totalParts: z.number().optional(),
  category: z.string().optional(),
});

const codeSchema = z.object({
  title: z.string(),
  author: z.string(),
  description: z.string().optional(),
  subtitle: z.string().optional(),
  status: z.enum(["private", "draft", "published"]).default("published"),
  repoUrl: z.url(),
  repoOwner: z.string(),
  repoName: z.string(),
  language: z.string().optional(),
  stars: z.number().optional(),
  forks: z.number().optional(),
  license: z.string().optional(),
  homepage: z.url().optional(),
  date: z.date().optional(),
  lastUpdated: z.date().optional(),
  tags: z.array(z.string()).default([]),
  topics: z.array(z.string()).default([]),
  dependencies: z.array(z.string()).default([]),
  devDependencies: z.array(z.string()).default([]),
  backgroundColor: z.string().optional(),
  apiData: z.object({
    fetchedAt: z.date(),
    readme: z.string().optional(),
    fileTree: z.array(z.string()).default([]),
    languages: z.record(z.string(), z.number()).optional(),
  }).optional(),
});

const datastorySchema = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  metaDescription: z.string().max(160).optional(),
  author: z.string(),
  status: z.enum(["private", "draft", "published"]),
  heroImage: z.string().optional(),
  notebook: z.object({
    engine: z.enum(["marimo", "jupyter"]),
    entry: z.string(),
    excludeCodeCells: z.boolean().optional().default(false),
  }),
  geography: z.array(geographyEnum).max(2).optional().default([]),
  theme: z.array(z.string()).max(5).optional().default([]),
  date: z.date().optional(),
  toc: z.boolean().optional().default(false),
  lightbox: z.object({
    gallery: z.boolean().optional().default(true),
  }).optional().default({ gallery: true }),
  backgroundColor: z.string().optional(),
  showhero: z.boolean().optional().default(true),
});

const photogallerySchema = z.object({
  status: z.enum(["private", "draft", "published"]),
  project: z.union([z.string(), z.array(z.string())]).optional(),
  title: z.string(),
  subtitle: z.string(),
  metaDescription: z.string().max(160).optional(),
  author: z.string(),
  category: z.string().optional(),
  heroImage: z.string().optional(),
  date: z.date().optional(),
  layoutType: z.enum(["tile", "one-up", "carousel"]).default("tile"),
  geography: z.array(geographyEnum).max(2).optional().default([]),
  theme: z.array(themeEnum).max(5).optional().default([]),
  images: z.array(z.object({
    src: z.string(),
    caption: z.string().optional(),
    alt: z.string().optional(),
  })).default([]),
  lightbox: z.object({
    gallery: z.boolean().optional().default(true),
  }).optional().default({ gallery: true }),
  backgroundColor: z.string().optional().nullable(),
  showhero: z.boolean().optional().default(true),
});

const projectSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  author: z.string(),
  status: z.enum(["private", "draft", "published"]),
  heroImage: z.string().optional(),
  photogalleries: z.array(reference("photogallery")).optional().default([]),
  essays: z.array(reference("essay")).optional().default([]),
  longforms: z.array(reference("longform")).optional().default([]),
  posts: z.array(reference("post")).optional().default([]),
  datastories: z.array(reference("datastory")).optional().default([]),
  code: z.array(reference("code")).optional().default([]),
  geography: z.array(geographyEnum).max(2).optional().default([]),
  theme: z.array(themeEnum).max(5).optional().default([]),
  date: z.date().optional(),
  backgroundColor: z.string().optional(),
  showhero: z.boolean().optional().default(true),
});

const markdownLoader = (collection: string) => glob({
  base: `./src/content/${collection}`,
  pattern: "**/*.{md,mdx}",
  generateId: ({ entry }) => entry.replace(/\.(md|mdx)$/i, ""),
});

export const collections = {
  post: defineCollection({ loader: markdownLoader("post"), schema: postSchema }),
  essay: defineCollection({ loader: markdownLoader("essay"), schema: essaySchema }),
  longform: defineCollection({ loader: markdownLoader("longform"), schema: longformSchema }),
  code: defineCollection({ loader: markdownLoader("code"), schema: codeSchema }),
  datastory: defineCollection({ loader: markdownLoader("datastory"), schema: datastorySchema }),
  photogallery: defineCollection({ loader: markdownLoader("photogallery"), schema: photogallerySchema }),
  project: defineCollection({ loader: markdownLoader("project"), schema: projectSchema }),
};
