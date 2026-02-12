/**
 * Author metadata — used for JSON-LD structured data, OG tags, and author bio.
 * Single-author site: Mahesh Shantaram.
 */

export const AUTHOR = {
  name: "Mahesh Shantaram",
  url: "https://thecontrarian.in",
  email: "ms@thecontrarian.in",
  jobTitle: "Visual Artist & Data Scientist",
  description: "Documentary photographer, visual artist, and data scientist based in Bangalore, India.",
  image: "/library/about/ms1.jpg",
  location: {
    city: "Bangalore",
    country: "India",
  },
  sameAs: [
    "https://www.instagram.com/thesquarerootofindia/",
    "https://www.linkedin.com/in/mahesh-shantaram/",
    "https://github.com/thecont1",
    "https://gravatar.com/thecont1",
    "https://x.com/thecontrarian",
  ],
} as const;
