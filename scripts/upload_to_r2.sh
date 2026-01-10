#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Sync Library to R2 ===${NC}"
echo ""

# Load environment variables (local dev)
if [ -f ".env" ]; then
    set -a
    # shellcheck disable=SC1091
    source ".env"
    set +a
fi

# Configuration
LOCAL_LIBRARY="public/library"
LOCAL_ORIGINALS="public/library/originals"

# Required env vars
if [ -z "${CLOUDFLARE_ACCESS_KEY_ID}" ] || [ -z "${CLOUDFLARE_SECRET_ACCESS_KEY}" ] || [ -z "${CLOUDFLARE_R2_ENDPOINT}" ] || [ -z "${CLOUDFLARE_BUCKET_NAME}" ]; then
    echo -e "${RED}Error: Missing required Cloudflare R2 env vars${NC}"
    echo "Expected: CLOUDFLARE_ACCESS_KEY_ID, CLOUDFLARE_SECRET_ACCESS_KEY, CLOUDFLARE_R2_ENDPOINT, CLOUDFLARE_BUCKET_NAME"
    exit 1
fi

# rclone S3 remote via env vars (avoid relying on global rclone config)
R2_REMOTE=":s3:${CLOUDFLARE_BUCKET_NAME}"
export RCLONE_S3_PROVIDER="Cloudflare"
export RCLONE_S3_ENV_AUTH="true"
export RCLONE_S3_ACCESS_KEY_ID="${CLOUDFLARE_ACCESS_KEY_ID}"
export RCLONE_S3_SECRET_ACCESS_KEY="${CLOUDFLARE_SECRET_ACCESS_KEY}"
export RCLONE_S3_ENDPOINT="${CLOUDFLARE_R2_ENDPOINT}"
export RCLONE_S3_REGION="${CLOUDFLARE_REGION:-auto}"
export RCLONE_S3_ACL="private"

# Check if directory argument is provided
DIR_ARG=""
if [ $# -gt 0 ]; then
    DIR_ARG="--dir $1"
    echo -e "${YELLOW}Processing originals directory: $1${NC}"
else
    echo -e "${YELLOW}Processing all content${NC}"
fi

# Check if library directory exists
if [ ! -d "$LOCAL_LIBRARY" ]; then
    echo -e "${RED}Error: $LOCAL_LIBRARY directory not found${NC}"
    exit 1
fi

# Check if originals directory exists
if [ ! -d "$LOCAL_ORIGINALS" ]; then
    echo -e "${RED}Error: $LOCAL_ORIGINALS directory not found${NC}"
    echo "Please add images to $LOCAL_ORIGINALS first"
    exit 1
fi

# Count images in originals
IMAGE_COUNT=$(find "$LOCAL_ORIGINALS" -type f \( -iname "*.jpg" -o -iname "*.jpeg" \) | wc -l | tr -d ' ')
if [ "$IMAGE_COUNT" -eq 0 ]; then
    echo -e "${RED}No images found in $LOCAL_ORIGINALS${NC}"
    exit 1
fi

echo -e "${GREEN}Found $IMAGE_COUNT image(s) in originals/${NC}"
echo ""

# Step 1: Clean up junk files
echo -e "${YELLOW}Step 1: Cleaning up junk files${NC}"

# Define junk file patterns
JUNK_PATTERNS=(
    ".DS_Store"
    "Thumbs.db"
    "desktop.ini"
    ".Spotlight-V100"
    ".Trashes"
    "._*"  # macOS resource forks
    "*.tmp"
    "*.temp"
)

# Find and delete junk files locally
JUNK_COUNT=0
for pattern in "${JUNK_PATTERNS[@]}"; do
    while IFS= read -r -d '' file; do
        echo -e "${RED}Removing: ${file}${NC}"
        rm -f "$file"
        JUNK_COUNT=$((JUNK_COUNT + 1))
    done < <(find "$LOCAL_LIBRARY" -type f -name "$pattern" -print0 2>/dev/null)
done

if [ "$JUNK_COUNT" -gt 0 ]; then
    echo -e "${GREEN}Cleaned up $JUNK_COUNT junk file(s) locally${NC}"
else
    echo -e "${GREEN}No junk files found${NC}"
fi
echo ""

# Step 2: Generate metadata for originals only
echo -e "${YELLOW}Step 2: Generating metadata.json files (originals only)${NC}"
uv run python scripts/build_exif.py $DIR_ARG

# Pick a random image and display its metadata
echo ""
echo -e "${BLUE}Selecting random image to verify metadata...${NC}"

# Find all metadata.json files
METADATA_FILES=()
while IFS= read -r -d '' file; do
    METADATA_FILES+=("$file")
done < <(find "$LOCAL_ORIGINALS" -name "metadata.json" -print0)

if [ ${#METADATA_FILES[@]} -gt 0 ]; then
    # Pick a random metadata file
    RANDOM_INDEX=$((RANDOM % ${#METADATA_FILES[@]}))
    RANDOM_METADATA="${METADATA_FILES[$RANDOM_INDEX]}"
    
    # Get directory name
    METADATA_DIR=$(dirname "$RANDOM_METADATA")
    RELATIVE_DIR=$(echo "$METADATA_DIR" | sed "s|^$LOCAL_ORIGINALS/||")
    
    # Get first image key from metadata
    RANDOM_IMAGE=$(python3 -c "import json, sys; data=json.load(open('$RANDOM_METADATA')); print(list(data.keys())[0] if data else '')")
    
    if [ -n "$RANDOM_IMAGE" ]; then
        echo -e "${GREEN}Random sample: ${RELATIVE_DIR}/${RANDOM_IMAGE}${NC}"
        
        # Extract and display key metadata fields
        python3 -c "
import json
import sys

with open('$RANDOM_METADATA', 'r') as f:
    data = json.load(f)
    
if '$RANDOM_IMAGE' in data:
    img = data['$RANDOM_IMAGE']
    photo = img.get('photography', {})
    
    print('  Camera: {}'.format(photo.get('camera_make', '') + ' ' + photo.get('camera_model', '')))
    print('  Lens: {}'.format(photo.get('lens_model', 'N/A')))
    print('  Settings: {} | {} | ISO {}'.format(
        photo.get('aperture', 'N/A'),
        photo.get('shutter_speed', 'N/A'),
        photo.get('iso', 'N/A')
    ))
    if 'title' in photo:
        print('  Title: {}'.format(photo['title'][:60] + ('...' if len(photo.get('title', '')) > 60 else '')))
else:
    print('  Error: Image not found in metadata')
"
    fi
else
    echo -e "${YELLOW}No metadata files found${NC}"
fi

echo ""
echo -e "${YELLOW}Step 3: Syncing entire library to R2 (local is source of truth)${NC}"
echo -e "${BLUE}Note: Files not present locally will be deleted from R2${NC}"
echo ""

# Define rclone exclude filters for junk files
EXCLUDE_ARGS=""
for pattern in "${JUNK_PATTERNS[@]}"; do
    EXCLUDE_ARGS="$EXCLUDE_ARGS --exclude $pattern"
done

if [ -n "$1" ]; then
    # Sync specific originals directory
    UPLOAD_PATH="$LOCAL_ORIGINALS/$1"
    if [ ! -d "$UPLOAD_PATH" ]; then
        echo -e "${RED}Error: Directory $UPLOAD_PATH not found${NC}"
        exit 1
    fi
    echo -e "${GREEN}Syncing originals/$1/${NC}"
    # shellcheck disable=SC2086
    rclone sync "$UPLOAD_PATH" "$R2_REMOTE/originals/$1" --progress --delete-after $EXCLUDE_ARGS
else
    # Sync entire library directory
    echo -e "${GREEN}Syncing all of public/library/ to R2${NC}"
    # shellcheck disable=SC2086
    rclone sync "$LOCAL_LIBRARY" "$R2_REMOTE" --progress --delete-after $EXCLUDE_ARGS
fi

echo ""
echo -e "${GREEN}✅ Sync complete!${NC}"
echo ""
echo "Summary:"
echo "- Junk files cleaned up locally (.DS_Store, Thumbs.db, etc.)"
echo "- Metadata generated locally (originals only)"
echo "- Entire public/library/ synced to R2 (excluding junk files)"
echo "- Remote files not in local library were deleted"
echo "- Local remains single source of truth"
