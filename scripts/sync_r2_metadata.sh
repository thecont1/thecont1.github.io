#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== R2 Metadata Sync Script ===${NC}"
echo ""

# Configuration
R2_REMOTE="myR2:thecontrarian-library"
LOCAL_ORIGINALS="public/library/originals"
TEMP_DIR=$(mktemp -d)

echo -e "${YELLOW}Step 1: Downloading images from R2 to temporary location${NC}"
echo "Temp directory: $TEMP_DIR"
echo ""

# Download all images from R2 to temp directory
rclone sync "$R2_REMOTE/originals/" "$TEMP_DIR/originals/" \
  --include "*.jpg" \
  --include "*.jpeg" \
  --include "*.JPG" \
  --include "*.JPEG" \
  --progress

echo ""
echo -e "${YELLOW}Step 2: Creating local originals directory${NC}"
mkdir -p "$LOCAL_ORIGINALS"

# Move downloaded images to project location
mv "$TEMP_DIR/originals/"* "$LOCAL_ORIGINALS/"

echo ""
echo -e "${YELLOW}Step 3: Generating metadata.json files${NC}"
# Run the EXIF extraction script
uv run python scripts/build_exif.py

echo ""
echo -e "${YELLOW}Step 4: Uploading metadata.json files to R2${NC}"
# Upload only metadata.json files back to R2
find "$LOCAL_ORIGINALS" -name "metadata.json" -type f | while read -r metadata_file; do
    # Get the relative path from originals/
    rel_path="${metadata_file#$LOCAL_ORIGINALS/}"
    r2_path="$R2_REMOTE/originals/$rel_path"
    
    echo -e "${GREEN}Uploading: $rel_path${NC}"
    rclone copyto "$metadata_file" "$r2_path"
done

echo ""
echo -e "${YELLOW}Step 5: Cleanup - Removing downloaded images${NC}"
# Remove the images but keep metadata.json files
find "$LOCAL_ORIGINALS" -type f ! -name "metadata.json" -delete
echo "Removed image files, kept metadata.json files locally"

echo ""
echo -e "${GREEN}✅ Metadata sync complete!${NC}"
echo ""
echo "Summary:"
echo "- Images downloaded from R2 temporarily"
echo "- Metadata extracted and generated"
echo "- metadata.json files uploaded to R2"
echo "- Local images cleaned up (only metadata.json kept)"

# Cleanup temp directory
rm -rf "$TEMP_DIR"
