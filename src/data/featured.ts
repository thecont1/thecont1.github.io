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

  /** Optional: Override the subtitle/description */
  displaySubtitle?: string;

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
    title: "Photography",
    items: [
      { type: "photogallery", slug: "kashmir", label: "Album" },
      { type: "photogallery", slug: "matrimania-series", label: "Series" },
      { type: "photogallery", slug: "matrimania-photobook", label: "Book" },
      { type: "photogallery", slug: "the-african-portraits", label: "Series" },
      { type: "photogallery", slug: "kashmir", label: "Album" },
      { type: "photogallery", slug: "matrimania-series", label: "Series" },
      { type: "photogallery", slug: "matrimania-photobook", label: "Book" },
      { type: "photogallery", slug: "the-african-portraits", label: "Series" },
    ]
  },

  {
    title: "Travels",
    items: [
      { type: "post", slug: "bundelkhand", label: "Itinerary" },
      { type: "post", slug: "writefathername", label: "Patriarchy" },
      { type: "post", slug: "bundelkhand", label: "Itinerary" },
      { type: "post", slug: "writefathername", label: "Patriarchy" },
      { type: "post", slug: "bundelkhand", label: "Itinerary" },
      { type: "post", slug: "writefathername", label: "Patriarchy" },
      { type: "post", slug: "bundelkhand", label: "Itinerary" },
      { type: "post", slug: "writefathername", label: "Patriarchy" },
    ]
  },

  {
    title: "MATRIMANIA",
    items: [
      { type: "essay", slug: "matrimania-bond-and-bondage", displayTitle: "Bond & Bondage: Essay", label: "Essay"},
      { type: "post", slug: "matrimania-bond-and-bondage", displayTitle: "Bond & Bondage: Post", label: "Post"},
      { type: "essay", slug: "matrimania-bond-and-bondage", displayTitle: "Bond & Bondage: Essay", label: "Essay"},
      { type: "post", slug: "matrimania-bond-and-bondage", displayTitle: "Bond & Bondage: Post", label: "Post"},
      { type: "essay", slug: "matrimania-bond-and-bondage", displayTitle: "Bond & Bondage: Essay", label: "Essay"},
      { type: "post", slug: "matrimania-bond-and-bondage", displayTitle: "Bond & Bondage: Post", label: "Post"},
    ]
  },

  {
    title: "Code",
    items: [
      { type: "datastory", slug: "bangalore-traffic-monitor"},
      { type: "datastory", slug: "bangalore-metro-conspiracy-theory"},
      { type: "datastory", slug: "bangalore-metro-phenomena-inspector"},
      { type: "code", slug: "ngl-storyteller"},
      { type: "code", slug: "vscode"},
      { type: "code", slug: "ngl-storyteller"},
      { type: "code", slug: "vscode"},
      { type: "code", slug: "ngl-storyteller"},
      { type: "code", slug: "vscode"},
      { type: "code", slug: "ngl-storyteller"},
      { type: "code", slug: "vscode"},
    ]
  },

];
