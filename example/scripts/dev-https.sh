#!/bin/bash

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get local IP
LOCAL_IP=$(ipconfig getifaddr en0 || echo "localhost")

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  AR Playground - HTTPS Dev Server         ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📍 Local Machine:${NC}       https://localhost:5173"
echo -e "${BLUE}📱 From Your Phone:${NC}     https://${LOCAL_IP}:5173"
echo ""
echo -e "${YELLOW}⚠️  HTTPS Certificate Warning:${NC}"
echo "   Your browser will warn about an untrusted certificate."
echo "   This is normal for self-signed certificates."
echo "   Click 'Accept' or 'Proceed' to continue."
echo ""
echo -e "${YELLOW}📋 Setup Steps:${NC}"
echo "   1. Open https://${LOCAL_IP}:5173 on your phone"
echo "   2. Accept the certificate warning"
echo "   3. React dev server will load"
echo "   4. Build for Android when ready: npm run build"
echo ""

# Check if certificates exist
if [ ! -f "localhost-key.pem" ] || [ ! -f "localhost-cert.pem" ]; then
  echo -e "${RED}❌ SSL certificates not found!${NC}"
  echo "   Run: openssl req -x509 -newkey rsa:4096 -keyout localhost-key.pem -out localhost-cert.pem -days 365 -nodes -subj \"/CN=localhost\""
  exit 1
fi

npm run dev
