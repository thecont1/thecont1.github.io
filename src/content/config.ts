import { defineCollection, z } from "astro:content";

const base = {
  title: z.string(),
  excerpt: z.string(),
  status: z.enum(["draft", "published"]),
  heroImage: z.string().optional()
};

export const collections = {
  photography: defineCollection({ schema: z.object(base) }),
  essays: defineCollection({ schema: z.object(base) }),
  datascience: defineCollection({ schema: z.object(base) })
};
