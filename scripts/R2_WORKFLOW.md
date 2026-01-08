# R2 Image Workflow

This document explains how to manage images for the website using Cloudflare R2.

## Overview

Images are stored on Cloudflare R2 CDN but kept locally in `public/library/originals/` for:
- EXIF metadata extraction
- C2PA Content Credentials processing
- Local development

The `.gitignore` excludes image files, but `metadata.json` files are tracked in Git.

---

## Adding New Images

### Recommended: Add locally, then upload to R2

**1. Add images locally:**
```bash
cp ~/my_photos/*.jpg public/library/originals/NEW_SERIES/
```

**2. Upload to R2 (generates metadata automatically):**
```bash
npm run r2:upload
# Or for specific directory:
bash scripts/upload_to_r2.sh NEW_SERIES
```

This script will:
- Generate `metadata.json` with EXIF data
- Upload images and metadata to R2
- Keep files locally for C2PA processing

**3. Commit metadata to Git:**
```bash
git add public/library/originals/NEW_SERIES/metadata.json
git commit -m "Add NEW_SERIES images"
git push
```


---

## Modifying Existing Images

If you modify an image (e.g., re-export with different settings):

```bash
# Replace the image locally
cp new_version.jpg public/library/originals/DIRECTORY/image.jpg

# Upload the specific directory
bash scripts/upload_to_r2.sh DIRECTORY

# Commit updated metadata
git add public/library/originals/DIRECTORY/metadata.json
git commit -m "Update DIRECTORY images"
git push
```

---

## Quick Reference

| Task | Command |
|------|--------|
| **Upload images to R2** | `npm run r2:upload` or `bash scripts/upload_to_r2.sh` |
| Upload specific directory | `bash scripts/upload_to_r2.sh DIRECTORY` |
| Extract metadata only | `uv run python scripts/build_exif.py --dir DIRECTORY` |
| Direct R2 upload (rclone) | `rclone sync local/ :s3:bucket/originals/DIR/` |

---

## Development Workflow

During development (`npm run dev`):
- The scaffold integration watches `public/library/originals/`
- When JPGs are added/modified, metadata is auto-regenerated
- Remember to upload to R2 before deployment!

---

## Architecture

```
Local:
  public/library/originals/
    KASHMIR/
      *.jpg                  (gitignored, for local dev/C2PA)
      metadata.json          (tracked in Git)

R2 CDN:
  https://pub-94814f577b9949a59be8bf7b24fd4963.r2.dev/originals/
    KASHMIR/
      *.jpg                  (served to users)
      metadata.json          (fetched at runtime)
```

---

## Best Practices

1. **Add images locally first** - Keep them in `public/library/originals/` for C2PA processing
2. **Run `npm run r2:upload` after adding/modifying images** - Generates metadata and uploads to R2
3. **Commit metadata.json files to Git** - They're tracked and used at runtime
4. **Use meaningful directory names** - They become URL paths
5. **Don't commit images** - They're gitignored and served from R2 CDN
6. **Dev mode auto-updates** - Metadata regenerates automatically when images change during `npm run dev`
