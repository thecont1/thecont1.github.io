#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║        Master Deployment Script                            ║"
echo "║        thecontrarian.in                                    ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Load environment variables
if [ -f .env ]; then
    set -a
    # shellcheck disable=SC1091
    source .env
    set +a
    echo -e "${GREEN}✓ Environment variables loaded${NC}"
else
    echo -e "${YELLOW}⚠ No .env file found - using existing environment${NC}"
fi
echo ""

# Check required commands
REQUIRED_COMMANDS=("uv" "npm" "lftp" "rclone")
for cmd in "${REQUIRED_COMMANDS[@]}"; do
    if ! command -v "$cmd" &> /dev/null; then
        echo -e "${RED}✗ Required command not found: $cmd${NC}"
        exit 1
    fi
done
echo -e "${GREEN}✓ All required commands available${NC}"
echo ""

# Parse arguments
SKIP_R2=false
SKIP_BUILD=false
SKIP_FTP=false
R2_DIR=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-r2)
            SKIP_R2=true
            shift
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --skip-ftp)
            SKIP_FTP=true
            shift
            ;;
        --r2-dir)
            R2_DIR="$2"
            shift 2
            ;;
        --help)
            echo "Usage: ./deploy.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --skip-r2        Skip R2 sync (metadata extraction and upload)"
            echo "  --skip-build     Skip Astro build"
            echo "  --skip-ftp       Skip FTP deployment"
            echo "  --r2-dir DIR     Only sync specific directory under originals/"
            echo "  --help           Show this help message"
            echo ""
            echo "Example:"
            echo "  ./deploy.sh                    # Full deployment"
            echo "  ./deploy.sh --skip-r2          # Skip R2 sync"
            echo "  ./deploy.sh --r2-dir AFRICA    # Only sync AFRICA directory to R2"
            echo "  ./deploy.sh --skip-build       # Only deploy existing build"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Run with --help for usage information"
            exit 1
            ;;
    esac
done

# ==============================================================================
# STEP 1: R2 Sync (EXIF extraction + upload)
# ==============================================================================
if [ "$SKIP_R2" = true ]; then
    echo -e "${YELLOW}⏭  Skipping R2 sync (--skip-r2)${NC}"
    echo ""
else
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}STEP 1: R2 Sync (EXIF + Upload)${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    
    if [ -n "$R2_DIR" ]; then
        echo -e "${YELLOW}Syncing only: originals/$R2_DIR${NC}"
        bash scripts/upload_to_r2.sh "$R2_DIR"
    else
        echo -e "${YELLOW}Syncing all originals${NC}"
        bash scripts/upload_to_r2.sh
    fi
    
    echo -e "${GREEN}✓ R2 sync complete${NC}"
    echo ""
fi

# ==============================================================================
# STEP 2: Astro Build
# ==============================================================================
if [ "$SKIP_BUILD" = true ]; then
    echo -e "${YELLOW}⏭  Skipping Astro build (--skip-build)${NC}"
    echo ""
else
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}STEP 2: Astro Build${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    
    echo -e "${YELLOW}Building site with Astro...${NC}"
    npm run build
    
    echo -e "${GREEN}✓ Build complete${NC}"
    echo ""
fi

# ==============================================================================
# STEP 3: Delete dist/client/library (CDN files not needed on server)
# ==============================================================================
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}STEP 3: Clean Build Output${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

if [ -d "dist/client/library" ]; then
    echo -e "${YELLOW}Deleting dist/client/library (served from R2 CDN)...${NC}"
    rm -rf dist/client/library
    echo -e "${GREEN}✓ Deleted dist/client/library${NC}"
else
    echo -e "${GREEN}✓ dist/client/library not found (already clean)${NC}"
fi
echo ""

# ==============================================================================
# STEP 4: FTP Deployment
# ==============================================================================
if [ "$SKIP_FTP" = true ]; then
    echo -e "${YELLOW}⏭  Skipping FTP deployment (--skip-ftp)${NC}"
    echo ""
else
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}STEP 4: FTP Deployment${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    
    bash scripts/deploy_ftp.sh
    
    echo -e "${GREEN}✓ FTP deployment complete${NC}"
    echo ""
fi

# ==============================================================================
# DEPLOYMENT COMPLETE
# ==============================================================================
echo -e "${GREEN}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║        🎉 DEPLOYMENT COMPLETE 🎉                          ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo "Summary:"
if [ "$SKIP_R2" = false ]; then
    echo -e "${GREEN}  ✓${NC} EXIF metadata extracted"
    echo -e "${GREEN}  ✓${NC} Local junk files purged"
    echo -e "${GREEN}  ✓${NC} Library synced to R2 CDN"
fi
if [ "$SKIP_BUILD" = false ]; then
    echo -e "${GREEN}  ✓${NC} Astro site built"
fi
echo -e "${GREEN}  ✓${NC} dist/client/library removed"
if [ "$SKIP_FTP" = false ]; then
    echo -e "${GREEN}  ✓${NC} dist/client deployed to remote public_html"
    echo -e "${GREEN}  ✓${NC} dist/server deployed to remote server"
fi

echo ""
echo -e "${BLUE}Site URL:${NC} https://thecontrarian.in/"
echo ""
