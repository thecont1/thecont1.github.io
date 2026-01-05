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

### 1. Add images locally
Place your images in the appropriate directory:
```bash
public/library/originals/YOUR_DIRECTORY_NAME/image1.jpg
public/library/originals/YOUR_DIRECTORY_NAME/image2.jpg
```

### 2. Upload to R2
```bash
# Upload a specific directory
./scripts/upload_to_r2.sh YOUR_DIRECTORY_NAME

# Or upload all directories
./scripts/upload_to_r2.sh
```

This script will:
- Generate `metadata.json` with EXIF data
- Upload images to R2
- Upload metadata to R2
- Keep files locally for C2PA processing

### 3. Commit metadata to Git
```bash
git add public/library/originals/YOUR_DIRECTORY_NAME/metadata.json
git commit -m "Add YOUR_DIRECTORY_NAME images"
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
| Add new images | `./scripts/upload_to_r2.sh DIRECTORY` |
| Update existing images | `./scripts/upload_to_r2.sh DIRECTORY` |
| Upload all directories | `./scripts/upload_to_r2.sh` |
| Sync from R2 | `./scripts/sync_r2_metadata.sh` |
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
