# SEO Implementation Guide

This document explains the SEO enhancements added to make thecontrarian.in search-engine ready.

## What's Been Added

### 1. FAQ Schema (`src/data/faq-schema.json`)

A structured FAQ dataset organized by project with Q&A pairs covering:

**Projects with FAQs:**
- **Matrimania** (5 FAQs) - About the wedding photography project, exhibitions, themes
- **The African Portraits** (5 FAQs) - About the racism/identity documentation project
- **General** (5 FAQs) - About Mahesh Shantaram, his work, and approach

**How to use:**
The FAQ schema can be integrated into project pages to provide structured data for search engines. This helps with:
- Featured snippets in Google search results
- "People also ask" sections
- Rich results/knowledge panels

### 2. Meta Descriptions

All 11 content files now have optimized `metaDescription` fields (~150-155 characters) that:
- Clearly describe the content
- Include relevant keywords
- Are compelling for click-through
- Stay within Google's recommended length

## Implementation Instructions

### Rendering FAQ Schema Markup

To add FAQ structured data to your pages, you'll need to convert the JSON to JSON-LD format in your page head. Here's an example for Astro:

```astro
---
// In your Project or Photogallery layout
import faqSchema from '@/data/faq-schema.json';

// Get the relevant FAQ data
const projectFaqs = faqSchema.projects['matrimania']?.faqs || [];
---

<head>
  {projectFaqs.length > 0 && (
    <script type="application/ld+json" set:html={JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": projectFaqs.map(faq => ({
        "@type": "Question",
        "name": faq.question,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": faq.answer
        }
      }))
    })} />
  )}
</head>
```

### Rendering Meta Descriptions

Meta descriptions should be rendered in the page `<head>`. In your layout components:

```astro
---
// layouts/Base.astro or similar
const { frontmatter } = Astro.props;
const metaDescription = frontmatter?.metaDescription || 
  "Mahesh Shantaram - Documentary photographer and data scientist exploring Indian society through visual storytelling.";
---

<head>
  <meta name="description" content={metaDescription} />
  <meta property="og:description" content={metaDescription} />
  <meta name="twitter:description" content={metaDescription} />
</head>
```

### Project Mapping

Map content files to FAQ schema:

| Content File | FAQ Schema Key |
|-------------|----------------|
| `photogallery/matrimania-*.md` | `matrimania` |
| `essay/matrimania-*.md` | `matrimania` |
| `longform/matrimania-*.md` | `matrimania` |
| `post/matrimania-*.md` | `matrimania` |
| `photogallery/the-african-portraits.md` | `the-african-portraits` |
| All other pages | `general` |

Use the `container` or `project` frontmatter field to determine which FAQ set to use.

## Additional SEO Recommendations

### 1. Sitemap
Ensure your `sitemap.xml` is being generated and includes:
- All published content (status: "published")
- Last modified dates
- Priority levels based on content type

### 2. Robots.txt
Make sure your `robots.txt` allows search engines to crawl:
```txt
User-agent: *
Allow: /
Sitemap: https://thecontrarian.in/sitemap.xml
```

### 3. Open Graph Images
Each content piece has a `heroImage` - use these for:
- `og:image` meta tags
- Twitter Card images
- Better social media sharing

### 4. Canonical URLs
Add canonical URL tags to prevent duplicate content issues:
```astro
<link rel="canonical" href={`https://thecontrarian.in${Astro.url.pathname}`} />
```

### 5. Structured Data for Photography
Consider adding additional schema types:
- **ImageObject** for individual photographs
- **PhotographAction** for photography projects
- **Person** schema for author/photographer page
- **CreativeWork** for essays and longform content

### 6. Performance Optimization
SEO also considers page speed:
- Images are served from R2 CDN ✓
- Consider lazy loading for photogallery pages
- Minimize JavaScript bundle size
- Add preload hints for critical resources

## Validation Tools

Test your implementation:

1. **Google Rich Results Test**: https://search.google.com/test/rich-results
2. **Schema Markup Validator**: https://validator.schema.org/
3. **Meta Tags Checker**: https://metatags.io/
4. **Google Search Console**: Monitor indexing and search performance

## Content Best Practices

When adding new content:

1. **Always include metaDescription** (150-155 chars)
2. **Use descriptive titles** that include relevant keywords
3. **Write compelling subtitles** that expand on the title
4. **Add alt text** to all images (already in images array)
5. **Use semantic HTML** in markdown content
6. **Internal linking** between related projects

## FAQ Schema Maintenance

When updating FAQs:
1. Keep answers concise but informative (150-250 words)
2. Use natural language (how people actually search)
3. Update based on actual questions received
4. Add new FAQs as projects evolve
5. Remove outdated information

## Monitoring

Track SEO performance:
- Google Search Console impressions/clicks
- Featured snippet appearances
- Ranking for target keywords:
  - "documentary photography India"
  - "Indian wedding photography"
  - "racism in India photography"
  - "Mahesh Shantaram photographer"
  - "Matrimania project"

---

**Last Updated**: February 17, 2026
**Status**: Ready for implementation
