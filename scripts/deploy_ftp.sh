#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Load environment variables
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Configuration
FTP_HOST="ftp.thecontrarian.in"
FTP_USER="thecont1@thecontrarian.in"
FTP_PASS="${THECONT1_FTP_PASSWORD}"
LOCAL_CLIENT="dist/client"
LOCAL_SERVER="dist/server"
REMOTE_CLIENT="public_html"
REMOTE_SERVER="server"

# By default, run in dry-run mode (preview changes without uploading/deleting).
# Set DRY_RUN=0 to perform the actual deployment.
DRY_RUN="${DRY_RUN:-0}"
MIRROR_DRYRUN_FLAG=""
MODE_LABEL="LIVE"
if [ "${DRY_RUN}" != "0" ]; then
  MIRROR_DRYRUN_FLAG="--dry-run"
  MODE_LABEL="DRY-RUN"
fi

# lftp mirror behavior:
# - FTP timestamps can be unreliable; by default we compare by size only (ignore time).
# - Set PRINT_ACTIONS=1 to show each transfer/delete action.
PRINT_ACTIONS="${PRINT_ACTIONS:-0}"
MIRROR_VERBOSITY_FLAG=""
if [ "${PRINT_ACTIONS}" = "1" ]; then
  MIRROR_VERBOSITY_FLAG="--verbose"
fi

echo "=== Starting FTP Deployment (${MODE_LABEL}) ==="
echo ""

# Test FTP connection first
echo "Testing FTP connection to ${FTP_HOST}..."
lftp -c "
set ssl:verify-certificate no
set net:timeout 10
open -u ${FTP_USER},${FTP_PASS} ${FTP_HOST}
bye
" || { echo "✗ FTP connection failed"; exit 1; }
echo -e "${GREEN}✓ FTP connection successful${NC}"
echo ""

# Step 1: Delete local /dist/client/library (CDN files, not needed on server)
echo "Step 1: Deleting local ${LOCAL_CLIENT}/library..."
if [ -d "${LOCAL_CLIENT}/library" ]; then
  rm -rf "${LOCAL_CLIENT}/library"
  echo -e "${GREEN}✓ Local library directory deleted${NC}"
else
  echo -e "${GREEN}✓ Local library directory not found (already clean)${NC}"
fi
echo ""

# Step 2: Mirror client directory
echo "Step 2: Mirroring ${LOCAL_CLIENT} to remote ${REMOTE_CLIENT}..."
lftp -c "
set ssl:verify-certificate no
set net:timeout 30
set net:max-retries 3
set net:reconnect-interval-base 5
set ftp:passive-mode on
open -u ${FTP_USER},${FTP_PASS} ${FTP_HOST}
mirror ${MIRROR_DRYRUN_FLAG} ${MIRROR_VERBOSITY_FLAG} --reverse --delete --ignore-time --parallel=3 --no-perms ${LOCAL_CLIENT} ${REMOTE_CLIENT}
bye
"
echo -e "${GREEN}✓ Client directory mirrored${NC}"
echo ""

# Step 3: Mirror server directory
echo "Step 3: Mirroring ${LOCAL_SERVER} to remote ${REMOTE_SERVER}..."
lftp -c "
set ssl:verify-certificate no
set net:timeout 30
set net:max-retries 3
set net:reconnect-interval-base 5
set ftp:passive-mode on
open -u ${FTP_USER},${FTP_PASS} ${FTP_HOST}
mirror ${MIRROR_DRYRUN_FLAG} ${MIRROR_VERBOSITY_FLAG} --reverse --delete --ignore-time --parallel=3 --no-perms ${LOCAL_SERVER} ${REMOTE_SERVER}
bye
"
echo -e "${GREEN}✓ Server directory mirrored${NC}"
echo ""

echo "=== FTP Deployment Complete (${MODE_LABEL}) ==="
