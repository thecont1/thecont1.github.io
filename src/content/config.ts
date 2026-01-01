import { defineCollection, z } from "astro:content";

// Reusable schemas
const categoryEnum = z.enum(["photography", "writing", "datastories", "lab0"]);
const layoutEnum = z.enum(["post", "essay", "longform", "photo-album", "timeline", "thread", "code", "datastory", "project"]);
const geographyEnum = z.enum(["bangalore", "india", "africa", "europe", "usa", "asia", "middle-east", "airtime"]);
const themeEnum = z.enum(["weddings", "travel", "society", "justice", "technology", "motorcycling", "humour", "interview", "lore", "night"]);
const containerEnum = z.enum(["matrimania", "the-african-portraits", "last-days-of-manmohan", "magazine-work", "indiacomestogether", "caerdydd-diary", "bruxelles-diary", "conakry-diary"]);

const baseSchema = z.object({
  title: z.string(),
  excerpt: z.string(),
  status: z.enum(["private", "draft", "published"]),
  heroImage: z.string().optional(),
  
  // Taxonomy
  category: categoryEnum.optional(), // Optional for now to avoid breaking existing content immediately, will strict later if needed
  layout: layoutEnum.optional(),
  geography: z.array(geographyEnum).max(2).optional().default([]),
  theme: z.array(themeEnum).max(5).optional().default([]),
  container: containerEnum.optional(),

  // Optional dates
  date: z.date().optional(),
  
  // For notebook layouts
  notebook: z.object({
    engine: z.enum(["marimo", "jupyter"]).optional(),
    entry: z.string().optional(),
    env: z.string().optional(),
  }).optional(),

  // Lightbox settings
  lightbox: z.object({
    gallery: z.boolean().optional().default(true),
  }).optional().default({ gallery: true }),

  // Table of Contents control
  toc: z.boolean().optional().default(false),

  // Appearance
  backgroundColor: z.string().optional(),
  "background-color": z.string().optional(),

  // Hero Image visibility control
  showhero: z.boolean().optional().default(true)
});

// Code collection schema for GitHub repositories
const codeSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  excerpt: z.string().optional(),
  status: z.enum(["private", "draft", "published"]).default("published"),
  
  // Repository metadata
  repoUrl: z.string().url(),
  repoOwner: z.string(),
  repoName: z.string(),
  language: z.string().optional(),
  stars: z.number().optional(),
  forks: z.number().optional(),
  license: z.string().optional(),
  homepage: z.string().url().optional(),
  
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
    languages: z.record(z.number()).optional(),
  }).optional(),
});

export const collections = {
  photography: defineCollection({ schema: baseSchema }),
  writing: defineCollection({ schema: baseSchema }),
  datastories: defineCollection({ schema: baseSchema }),
  lab0: defineCollection({ schema: baseSchema }),
  code: defineCollection({ schema: codeSchema })
};
