/**
 * FEATURED CONTENT - Manual control for homepage "The Projects" section
 */

export type FeaturedItemType = "post" | "essay" | "longform" | "photogallery" | "code" | "datastory" | "project";

export interface FeaturedItem {
  /** The content collection type */
  type: FeaturedItemType;

  /** The slug (filename without extension) of the content */
  slug: string;

  /** Optional: Override the display title */
  displayTitle?: string;

  /** Optional: Override the excerpt/description */
  displayExcerpt?: string;

  /** Optional: Override the hero image */
  displayImage?: string;

  /** Optional: Custom label (e.g., "Featured", "New", "Updated") */
  label?: string;
}

/**
 * Section groupings for the homepage (optional)
 * Use this if you want to group featured items by category
 */
export interface FeaturedSection {
  title: string;
  items: FeaturedItem[];
}

/**
 * Featured items for "The Projects" section on the homepage.
 * Order matters - items appear in the order listed here.
 */
export const FEATURED_ITEMS: FeaturedItem[] = [
  { type: "essay", slug: "fictional"},
  { type: "datastory", slug: "nammametro", displayTitle: "The NammaMetro Ridership Inspector"},
];

export const FEATURED_SECTIONS: FeaturedSection[] = [
  {
    title: "MATRIMANIA",
    items: [
      { type: "essay", slug: "matrimania-bond-and-bondage", displayTitle: "Bond & Bondage", label: "Essay"},
      { type: "post", slug: "matrimania-bond-and-bondage", displayTitle: "Name's Bond: A Surmise", label: "Post"},
    ]
  },

  {
    title: "Photography",
    items: [
      { type: "photogallery", slug: "matrimania-series", label: "Series" },
      { type: "photogallery", slug: "matrimania-photobook", label: "Book" },
      { type: "photogallery", slug: "the-african-portraits", label: "Series" },
    ]
  },

  {
    title: "Code",
    items: [
      { type: "code", slug: "ngl-storyteller"},
      { type: "code", slug: "vscode"},
    ]
  },

];
