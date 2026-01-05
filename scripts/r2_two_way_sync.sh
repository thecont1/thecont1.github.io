#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== R2 Two-Way Sync (originals) ===${NC}"
echo ""

# Load environment variables (local dev)
if [ -f ".env" ]; then
    set -a
    # shellcheck disable=SC1091
    source ".env"
    set +a
fi

LOCAL_ORIGINALS="public/library/originals"

# Required env vars
if [ -z "${CLOUDFLARE_ACCESS_KEY_ID}" ] || [ -z "${CLOUDFLARE_SECRET_ACCESS_KEY}" ] || [ -z "${CLOUDFLARE_R2_ENDPOINT}" ] || [ -z "${CLOUDFLARE_BUCKET_NAME}" ]; then
    echo -e "${RED}Error: Missing required Cloudflare R2 env vars${NC}"
    echo "Expected: CLOUDFLARE_ACCESS_KEY_ID, CLOUDFLARE_SECRET_ACCESS_KEY, CLOUDFLARE_R2_ENDPOINT, CLOUDFLARE_BUCKET_NAME"
    exit 1
fi

# rclone S3 remote via env vars (avoid relying on global rclone config)
R2_REMOTE=":s3:${CLOUDFLARE_BUCKET_NAME}"
RCLONE_S3_PROVIDER="Cloudflare"
RCLONE_S3_ENV_AUTH="true"
RCLONE_S3_ACCESS_KEY_ID="${CLOUDFLARE_ACCESS_KEY_ID}"
RCLONE_S3_SECRET_ACCESS_KEY="${CLOUDFLARE_SECRET_ACCESS_KEY}"
RCLONE_S3_ENDPOINT="${CLOUDFLARE_R2_ENDPOINT}"
RCLONE_S3_REGION="${CLOUDFLARE_REGION:-auto}"
RCLONE_S3_ACL="private"

if [ ! -d "$LOCAL_ORIGINALS" ]; then
    mkdir -p "$LOCAL_ORIGINALS"
fi

# Optional: sync only one top-level folder
SUBDIR=""
if [ $# -gt 0 ]; then
    SUBDIR="$1"
    echo -e "${YELLOW}Folder: $SUBDIR${NC}"
fi

LOCAL_PATH="$LOCAL_ORIGINALS"
REMOTE_PATH="$R2_REMOTE/originals"
if [ -n "$SUBDIR" ]; then
    LOCAL_PATH="$LOCAL_ORIGINALS/$SUBDIR"
    REMOTE_PATH="$R2_REMOTE/originals/$SUBDIR"
fi

# Two-way sync strategy:
# 1) Determine which side has the newest change (based on newest mtime among jpg/jpeg/metadata.json)
# 2) Sync from that side to the other
#
# Notes:
# - This is not conflict-free if you modify the same file in both places between runs.
# - For a real bi-directional sync with per-file conflict detection you need a VFS/locking layer.

echo -e "${YELLOW}Scanning for newest change...${NC}"

LOCAL_NEWEST_EPOCH=0
if [ -d "$LOCAL_PATH" ]; then
    # macOS: stat -f %m
    while IFS= read -r f; do
        m=$(stat -f %m "$f" 2>/dev/null || echo 0)
        if [ "$m" -gt "$LOCAL_NEWEST_EPOCH" ]; then
            LOCAL_NEWEST_EPOCH=$m
        fi
    done < <(find "$LOCAL_PATH" -type f \( -iname "*.jpg" -o -iname "*.jpeg" -o -name "metadata.json" \) 2>/dev/null)
fi

REMOTE_NEWEST_EPOCH=0
REMOTE_NEWEST_EPOCH=$(rclone lsf -R --format "tp" "$REMOTE_PATH" 2>/dev/null | awk '
  BEGIN{max=0}
  { 
    # rclone outputs: <time>;<path>
    split($0,a,";");
    t=a[1];
    # RFC3339 like 2026-01-05T01:23:45Z
    gsub(/Z$/, "", t);
    gsub(/T/, " ", t);
    # best-effort parse using date(1)
    cmd="date -u -j -f \"%Y-%m-%d %H:%M:%S\" \"" t "\" +%s 2>/dev/null";
    cmd | getline s;
    close(cmd);
    if (s+0 > max) max=s+0;
  }
  END{print max}
')

echo -e "${BLUE}Local newest : ${LOCAL_NEWEST_EPOCH}${NC}"
echo -e "${BLUE}Remote newest: ${REMOTE_NEWEST_EPOCH}${NC}"

echo ""
if [ "$REMOTE_NEWEST_EPOCH" -gt "$LOCAL_NEWEST_EPOCH" ]; then
    echo -e "${GREEN}Remote is newer -> syncing R2 -> local${NC}"
    rclone sync "$REMOTE_PATH" "$LOCAL_PATH" --progress
else
    echo -e "${GREEN}Local is newer (or equal) -> syncing local -> R2${NC}"
    rclone sync "$LOCAL_PATH" "$REMOTE_PATH" --progress
fi

echo ""
echo -e "${GREEN}✅ Two-way sync complete${NC}"
