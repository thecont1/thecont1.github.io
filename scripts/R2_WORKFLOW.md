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

### Recommended: Upload directly to R2, then generate metadata

**1. Upload images directly to R2:**
```bash
# Using rclone
rclone sync ~/my_photos/ myR2:thecontrarian-library/originals/NEW_SERIES/

# Or use Cloudflare R2 web dashboard
```

**2. Generate metadata:**
```bash
./scripts/generate_r2_metadata.sh NEW_SERIES
```

This script will:
- Download images from R2 temporarily
- Generate `metadata.json` with EXIF data
- Upload metadata to R2
- Keep metadata.json locally (for C2PA)
- Clean up downloaded images

**3. Commit metadata to Git:**
```bash
git add public/library/originals/NEW_SERIES/metadata.json
git commit -m "Add NEW_SERIES metadata"
git push
```

---

### Alternative: Upload from local directory

If you prefer to keep images locally first:

**1. Add images locally:**
```bash
cp ~/my_photos/*.jpg public/library/originals/NEW_SERIES/
```

**2. Upload to R2:**
```bash
./scripts/upload_to_r2.sh NEW_SERIES
```

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
./scripts/upload_to_r2.sh DIRECTORY

# Commit updated metadata
git add public/library/originals/DIRECTORY/metadata.json
git commit -m "Update DIRECTORY images"
git push
```

---

## Syncing from R2 (Recovery)

If you need to download images from R2 (e.g., new machine, recovery):

```bash
./scripts/sync_r2_metadata.sh
```

This will:
- Download all images from R2
- Regenerate metadata.json
- Upload metadata back to R2
- Clean up images locally (keeping only metadata.json)

**Note**: This is a recovery/sync tool. For normal operations, use `upload_to_r2.sh`.

---

## Quick Reference

| Task | Command |
|------|---------|
| **Generate metadata (recommended)** | `./scripts/generate_r2_metadata.sh DIRECTORY` |
| Upload images from local | `./scripts/upload_to_r2.sh DIRECTORY` |
| Upload all local directories | `./scripts/upload_to_r2.sh` |
| Sync from R2 (recovery) | `./scripts/sync_r2_metadata.sh` |
| Direct R2 upload | `rclone sync local/ myR2:thecontrarian-library/originals/DIR/` |
| Extract metadata only | `uv run python scripts/build_exif.py --dir DIRECTORY` |

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

1. **Always run `upload_to_r2.sh` after adding/modifying images**
2. **Commit metadata.json files to Git**
3. **Keep local originals directory for C2PA functionality**
4. **Use meaningful directory names** (they become URL paths)
5. **Don't commit images** (they're gitignored and on R2)
