import { defineCollection, z } from "astro:content";

// Reusable schemas
const categoryEnum = z.enum(["photography", "writing", "datastories", "lab0"]);
const layoutEnum = z.enum(["post", "longform", "photo-essay", "photo-album", "notebook", "timeline", "thread"]);
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
  }).optional()
});

export const collections = {
  photography: defineCollection({ schema: baseSchema }),
  writing: defineCollection({ schema: baseSchema }),
  datastories: defineCollection({ schema: baseSchema }),
  lab0: defineCollection({ schema: baseSchema })  
};
