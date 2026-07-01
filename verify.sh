#!/bin/bash

# ECWID DASHBOARD - LOCAL VERIFICATION SCRIPT
# Run this before deploying to Render to catch errors early

echo "🔍 Ecwid Dashboard Setup Verification"
echo "======================================"
echo ""

# Check Node.js
echo "✓ Checking Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo "  ✅ Node.js found: $NODE_VERSION"
else
    echo "  ❌ Node.js not found. Install from https://nodejs.org"
    exit 1
fi

# Check npm
echo ""
echo "✓ Checking npm..."
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    echo "  ✅ npm found: $NPM_VERSION"
else
    echo "  ❌ npm not found"
    exit 1
fi

# Check required files
echo ""
echo "✓ Checking required files..."
REQUIRED_FILES=("server.js" "package.json" ".gitignore" "README.md")
MISSING_FILES=0

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✅ $file found"
    else
        echo "  ❌ $file NOT found"
        MISSING_FILES=$((MISSING_FILES + 1))
    fi
done

if [ $MISSING_FILES -gt 0 ]; then
    echo ""
    echo "❌ Missing $MISSING_FILES required file(s). Cannot proceed."
    exit 1
fi

# Check environment variables
echo ""
echo "✓ Checking environment variables..."
if [ -z "$ECWID_STORE_ID" ]; then
    echo "  ⚠️  ECWID_STORE_ID not set (will be set in Render)"
else
    echo "  ✅ ECWID_STORE_ID is set"
fi

if [ -z "$ECWID_API_TOKEN" ]; then
    echo "  ⚠️  ECWID_API_TOKEN not set (will be set in Render)"
else
    echo "  ✅ ECWID_API_TOKEN is set"
fi

# Check for .env file
echo ""
if [ -f ".env" ]; then
    echo "⚠️  .env file found - make sure it's in .gitignore!"
    grep -q ".env" .gitignore && echo "  ✅ .env is in .gitignore" || echo "  ❌ .env is NOT in .gitignore!"
fi

# Install dependencies
echo ""
echo "✓ Installing dependencies..."
if npm install; then
    echo "  ✅ Dependencies installed successfully"
else
    echo "  ❌ Failed to install dependencies"
    exit 1
fi

# Check syntax
echo ""
echo "✓ Checking JavaScript syntax..."
if node -c server.js 2>/dev/null; then
    echo "  ✅ server.js syntax is valid"
else
    echo "  ❌ server.js has syntax errors"
    exit 1
fi

# Summary
echo ""
echo "======================================"
echo "✅ All checks passed!"
echo ""
echo "Next steps:"
echo "1. Set ECWID_STORE_ID and ECWID_API_TOKEN in Render environment"
echo "2. Push to GitHub: git add . && git commit && git push"
echo "3. Deploy to Render using GitHub integration"
echo "4. Test: curl https://your-domain.onrender.com/health"
echo ""
echo "To run locally:"
echo "  npm start"
echo "Then visit: http://localhost:3000/api/dashboard"
echo ""
