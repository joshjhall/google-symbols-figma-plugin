#!/bin/bash
set -euo pipefail

# Manual release script with .fig file upload support
# Usage: ./scripts/release.sh [patch|minor|major] [--skip-fig-check]
#
# This script:
# 1. Runs tests, lint, and build
# 2. Bumps version in package.json and manifest.json
# 3. Creates git tag
# 4. Pushes to remote
# 5. Creates GitHub Release with .fig files if available

VERSION_TYPE=${1:-patch}
SKIP_FIG_CHECK=false
RELEASE_DIR="release"

# Parse arguments
for arg in "$@"; do
  case $arg in
    --skip-fig-check)
      SKIP_FIG_CHECK=true
      shift
      ;;
  esac
done

echo "🚀 Creating $VERSION_TYPE release..."

# Ensure we're on main branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "❌ Error: Must be on main branch to release"
  echo "Current branch: $CURRENT_BRANCH"
  exit 1
fi

# Ensure clean working directory
if [ -n "$(git status --porcelain)" ]; then
  echo "❌ Error: Working directory is not clean"
  echo "Please commit or stash your changes first"
  git status --short
  exit 1
fi

# Pull latest changes
echo "📥 Pulling latest changes..."
git pull origin main

# Run tests
echo "🧪 Running tests..."
pnpm test:run

# Type check
echo "🔍 Type checking..."
pnpm typecheck

# Lint
echo "🧹 Linting..."
pnpm lint

# Build
echo "🏗️  Building..."
pnpm build

# Bump version
echo "📦 Bumping version ($VERSION_TYPE)..."
NEW_VERSION=$(npm version $VERSION_TYPE --no-git-tag-version)

# Update manifest.json version
echo "📝 Updating manifest.json..."
node -e "
const fs = require('fs');
const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
manifest.version = '$NEW_VERSION'.replace('v', '');
fs.writeFileSync('manifest.json', JSON.stringify(manifest, null, 2) + '\n');
"

# Stage changes
git add package.json manifest.json

# Commit
echo "💾 Creating release commit..."
git commit -m "chore(release): $NEW_VERSION

Release $NEW_VERSION includes:
- Updated package version
- Updated manifest version
- Built plugin artifacts
"

# Tag
echo "🏷️  Creating git tag..."
git tag -a "$NEW_VERSION" -m "Release $NEW_VERSION"

# Push changes
echo "📤 Pushing to remote..."
git push origin main
git push origin "$NEW_VERSION"

# Check for .fig files
FIG_COUNT=0
if [[ -d "$RELEASE_DIR" ]]; then
  FIG_COUNT=$(ls -1 "$RELEASE_DIR"/*.fig 2>/dev/null | wc -l)
fi

echo ""
echo "✅ Release $NEW_VERSION created successfully!"
echo ""

# Create GitHub Release with .fig files if available
if [[ $FIG_COUNT -gt 0 ]]; then
  echo "📦 Found $FIG_COUNT .fig files in $RELEASE_DIR/"
  echo "📝 Creating GitHub Release with .fig files..."

  # Get icon metadata for release notes
  ICON_SHA=$(jq -r '.commitSha // "unknown"' src/lib/icons/icon-list-metadata.json 2>/dev/null || echo "unknown")
  ICON_COUNT=$(jq -r '.iconCount // 0' src/lib/icons/icon-list-metadata.json 2>/dev/null || echo "0")

  # Generate release notes
  PREV_TAG=$(git describe --tags --abbrev=0 HEAD^ 2>/dev/null || echo "")
  if [[ -n "$PREV_TAG" ]]; then
    CHANGELOG=$(git log "$PREV_TAG"..HEAD --pretty=format:"- %s" --no-merges)
  else
    CHANGELOG="- Initial release"
  fi

  RELEASE_NOTES=$(cat <<EOF
# Google Material Symbols Figma Plugin $NEW_VERSION

This release includes **$ICON_COUNT Material Symbols** icons.

## 📦 What's Included

This release provides **26 pre-generated Figma files** containing all Material Symbols icons organized by category. Each file includes 504 variants per icon (7 styles × 6 weights × 4 fills × 3 grades × 4 sizes).

## 🚀 Quick Start

**Option 1: Import Pre-generated Files (Fastest ⚡)**
- Download the \`.fig\` files below
- Import into your Figma workspace
- Use immediately!

**Option 2: Use the Plugin**
- Install in Figma
- Generate icons on-demand
- Supports incremental updates

## 🔄 Changes

$CHANGELOG

---

**Icon Data Commit:** [\`${ICON_SHA:0:7}\`](https://github.com/google/material-design-icons/commit/$ICON_SHA)
EOF
)

  # Create release with .fig files
  gh release create "$NEW_VERSION" \
    --title "Google Material Symbols $NEW_VERSION" \
    --notes "$RELEASE_NOTES" \
    "$RELEASE_DIR"/*.fig

  echo "✅ GitHub Release created with $FIG_COUNT .fig files"
  echo "🔗 https://github.com/joshjhall/google-symbols-figma-plugin/releases/tag/$NEW_VERSION"

elif [[ "$SKIP_FIG_CHECK" == "false" ]]; then
  echo "⚠️  No .fig files found in $RELEASE_DIR/"
  echo ""
  echo "To include pre-generated Figma files in the release:"
  echo "  1. Run the plugin in Figma Desktop"
  echo "  2. Generate all 26 icon sets"
  echo "  3. Export each as .fig file to $RELEASE_DIR/"
  echo "  4. Run: gh release create $NEW_VERSION $RELEASE_DIR/*.fig"
  echo ""
  echo "Or create release without .fig files:"
  echo "  gh release create $NEW_VERSION"
else
  echo "ℹ️  Skipping .fig file check (--skip-fig-check specified)"
  echo ""
  echo "To create GitHub Release, run:"
  echo "  gh release create $NEW_VERSION"
fi
