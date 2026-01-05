#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Generate Metadata for R2 Images ===${NC}"
echo ""

# Configuration
R2_REMOTE="myR2:thecontrarian-library"
LOCAL_ORIGINALS="public/library/originals"

# Check if directory argument is provided
if [ $# -eq 0 ]; then
    echo -e "${RED}Error: Directory name required${NC}"
    echo "Usage: $0 DIRECTORY_NAME"
    echo ""
    echo "Example: $0 NEW_SERIES"
    echo "This will process: originals/NEW_SERIES/ on R2"
    exit 1
fi

DIRECTORY=$1
R2_PATH="$R2_REMOTE/originals/$DIRECTORY"
LOCAL_PATH="$LOCAL_ORIGINALS/$DIRECTORY"

echo -e "${YELLOW}Processing directory: $DIRECTORY${NC}"
echo ""

# Check if directory exists on R2
echo -e "${BLUE}Checking R2...${NC}"
if ! rclone lsd "$R2_PATH" &>/dev/null; then
    echo -e "${RED}Error: Directory 'originals/$DIRECTORY/' not found on R2${NC}"
    echo "Please upload images to R2 first:"
    echo "  rclone sync local_folder/ $R2_PATH/"
    exit 1
fi

# Count images on R2
IMAGE_COUNT=$(rclone ls "$R2_PATH" --include "*.jpg" --include "*.jpeg" --include "*.JPG" --include "*.JPEG" 2>/dev/null | wc -l | tr -d ' ')
if [ "$IMAGE_COUNT" -eq 0 ]; then
    echo -e "${RED}No images found in R2 directory: $DIRECTORY${NC}"
    exit 1
fi

echo -e "${GREEN}Found $IMAGE_COUNT image(s) on R2${NC}"
echo ""

# Create temp directory for download
TEMP_DIR=$(mktemp -d)
echo -e "${YELLOW}Step 1: Downloading images from R2 to temporary location${NC}"
echo "Temp directory: $TEMP_DIR"

# Download images to temp
rclone sync "$R2_PATH" "$TEMP_DIR" \
  --include "*.jpg" \
  --include "*.jpeg" \
  --include "*.JPG" \
  --include "*.JPEG" \
  --progress

# Create local directory structure
mkdir -p "$LOCAL_PATH"

# Move images to local path for processing
mv "$TEMP_DIR"/* "$LOCAL_PATH/" 2>/dev/null || true

echo ""
echo -e "${YELLOW}Step 2: Generating metadata.json${NC}"
# Generate metadata
uv run python scripts/build_exif.py --dir "$DIRECTORY"

# Check if metadata was created
if [ ! -f "$LOCAL_PATH/metadata.json" ]; then
    echo -e "${RED}Error: metadata.json was not generated${NC}"
    rm -rf "$TEMP_DIR"
    exit 1
fi

echo ""
echo -e "${YELLOW}Step 3: Uploading metadata.json to R2${NC}"
# Upload metadata to R2
rclone copyto "$LOCAL_PATH/metadata.json" "$R2_PATH/metadata.json"
echo -e "${GREEN}✓ Uploaded metadata.json${NC}"

echo ""
echo -e "${YELLOW}Step 4: Cleanup - Removing downloaded images${NC}"
# Keep metadata.json but remove images locally
find "$LOCAL_PATH" -type f ! -name "metadata.json" -delete
echo "Removed image files, kept metadata.json locally"

echo ""
echo -e "${GREEN}✅ Metadata generation complete!${NC}"
echo ""
echo "Summary:"
echo "- Downloaded $IMAGE_COUNT images from R2"
echo "- Generated metadata.json with EXIF data"
echo "- Uploaded metadata.json to R2"
echo "- Kept metadata.json locally at: $LOCAL_PATH/metadata.json"
echo ""
echo -e "${BLUE}Next step: Commit metadata.json to Git${NC}"
echo "  git add public/library/originals/$DIRECTORY/metadata.json"
echo "  git commit -m \"Add metadata for $DIRECTORY\""
echo "  git push"

# Cleanup temp directory
rm -rf "$TEMP_DIR"
