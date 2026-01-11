# Deployment Guide

## Master Deployment Script

The `deploy.sh` script orchestrates the entire build and deployment process. It's located in the root directory and handles all steps automatically.

## Quick Start

```bash
# Full deployment (recommended)
npm run deploy
# or
./deploy.sh

# Show all options
./deploy.sh --help
```

## What It Does

The master script executes these steps in order:

1. **R2 Sync** (EXIF extraction + upload)
   - Runs `scripts/build_exif.py` to extract EXIF metadata
   - Purges junk files (`.DS_Store`, `Thumbs.db`, etc.)
   - Uploads `public/library/` to R2 CDN via `scripts/upload_to_r2.sh`

2. **Astro Build**
   - Runs `npm run build` to generate static site

3. **Clean Build Output**
   - Deletes `dist/client/library` (served from R2 CDN, not needed on server)

4. **FTP Deployment**
   - Deploys `dist/client/` to remote `public_html/`
   - Deploys `dist/server/` to remote `server/`
   - Uses `scripts/deploy_ftp.sh`

## Command Options

```bash
# Skip R2 sync (useful if images haven't changed)
./deploy.sh --skip-r2

# Skip Astro build (deploy existing build)
./deploy.sh --skip-build

# Skip FTP deployment (test builds locally)
./deploy.sh --skip-ftp

# Sync only specific directory to R2
./deploy.sh --r2-dir AFRICA

# Combine options
./deploy.sh --skip-r2 --skip-build
```

## Common Workflows

### Full Deployment (All Changes)
```bash
npm run deploy
```
Use when: You've added/modified images AND made code changes.

### Code Changes Only
```bash
./deploy.sh --skip-r2
```
Use when: You've only modified code/content, no image changes.

### Images Changes Only
```bash
# Update just one folder
./deploy.sh --r2-dir WEDDINGS --skip-build --skip-ftp

# Update all images
./deploy.sh --skip-build --skip-ftp
```
Use when: You've added/modified images but haven't changed code.

### Local Testing
```bash
# Build and test locally
./deploy.sh --skip-r2 --skip-ftp
npm run preview
```

### Specific Directory Update
```bash
# Add new images to AFRICA folder, then:
./deploy.sh --r2-dir AFRICA
```
Only syncs the AFRICA directory to R2, then builds and deploys everything.

## Environment Variables Required

Create a `.env` file in the root directory with:

```bash
# Cloudflare R2 CDN
CLOUDFLARE_ACCESS_KEY_ID=your_key
CLOUDFLARE_SECRET_ACCESS_KEY=your_secret
CLOUDFLARE_R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
CLOUDFLARE_BUCKET_NAME=your_bucket_name
CLOUDFLARE_REGION=auto

# FTP Deployment
THECONT1_FTP_PASSWORD=your_ftp_password
```

## Required Tools

The script checks for these commands:
- `uv` - Python package manager
- `npm` - Node package manager
- `lftp` - FTP client
- `rclone` - R2 sync tool

## Individual Scripts (Legacy)

These scripts are still available but you should prefer `deploy.sh`:

- `scripts/build_exif.py` - Extract EXIF metadata
- `scripts/upload_to_r2.sh` - Sync to R2 CDN
- `scripts/deploy_ftp.sh` - FTP deployment

## Troubleshooting

### Script exits with "command not found"
Install missing tools:
```bash
brew install uv rclone lftp
```

### FTP connection fails
Check your `.env` file has the correct `THECONT1_FTP_PASSWORD`.

### R2 sync fails
Verify all Cloudflare R2 environment variables are set correctly.

### Build fails
Run `npm install` to ensure all dependencies are installed.

## Notes

- Local `public/library/originals/` is the source of truth
- Remote R2 files not present locally will be deleted
- The script is idempotent - safe to run multiple times
- Use `--skip-*` flags for faster partial deployments
