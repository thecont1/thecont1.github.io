#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Upload Images to R2 ===${NC}"
echo ""

# Configuration
R2_REMOTE="myR2:thecontrarian-library"
LOCAL_ORIGINALS="public/library/originals"

# Check if directory argument is provided
DIR_ARG=""
if [ $# -gt 0 ]; then
    DIR_ARG="--dir $1"
    echo -e "${YELLOW}Processing directory: $1${NC}"
else
    echo -e "${YELLOW}Processing all directories${NC}"
fi

# Check if originals directory exists
if [ ! -d "$LOCAL_ORIGINALS" ]; then
    echo -e "${RED}Error: $LOCAL_ORIGINALS directory not found${NC}"
    echo "Please add images to $LOCAL_ORIGINALS first"
    exit 1
fi

# Check if there are any images
IMAGE_COUNT=$(find "$LOCAL_ORIGINALS" -type f \( -iname "*.jpg" -o -iname "*.jpeg" \) | wc -l | tr -d ' ')
if [ "$IMAGE_COUNT" -eq 0 ]; then
    echo -e "${RED}No images found in $LOCAL_ORIGINALS${NC}"
    exit 1
fi

echo -e "${GREEN}Found $IMAGE_COUNT image(s)${NC}"
echo ""

# Step 1: Generate metadata
echo -e "${YELLOW}Step 1: Generating metadata.json files${NC}"
uv run python scripts/build_exif.py $DIR_ARG

echo ""
echo -e "${YELLOW}Step 2: Uploading images and metadata to R2${NC}"

if [ -n "$1" ]; then
    # Upload specific directory
    UPLOAD_PATH="$LOCAL_ORIGINALS/$1"
    if [ ! -d "$UPLOAD_PATH" ]; then
        echo -e "${RED}Error: Directory $UPLOAD_PATH not found${NC}"
        exit 1
    fi
    echo -e "${GREEN}Uploading: $1/${NC}"
    rclone sync "$UPLOAD_PATH" "$R2_REMOTE/originals/$1" --progress
else
    # Upload all directories
    for dir in "$LOCAL_ORIGINALS"/*/ ; do
        if [ -d "$dir" ]; then
            dirname=$(basename "$dir")
            echo -e "${GREEN}Uploading: $dirname/${NC}"
            rclone sync "$dir" "$R2_REMOTE/originals/$dirname" --progress
        fi
    done
fi

echo ""
echo -e "${GREEN}✅ Upload complete!${NC}"
echo ""
echo "Summary:"
echo "- Metadata generated locally"
echo "- Images and metadata uploaded to R2"
echo "- Files remain in $LOCAL_ORIGINALS for local C2PA processing"
echo ""
echo -e "${BLUE}Next step: Commit metadata.json files to Git if new${NC}"
echo "  git add public/library/originals"
echo "  git commit -m \"Add/update images and metadata\""
