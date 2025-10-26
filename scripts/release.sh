#!/bin/bash
set -euo pipefail

# Complete release automation script
# Usage: ./scripts/release.sh [patch|minor|major]
#
# This script handles the complete release workflow:
# 1. Runs tests, lint, type checking, and build
# 2. Bumps version in package.json and manifest.json
# 3. Updates CHANGELOG.md with conventional commit entries
# 4. Commits all changes
# 5. Creates and pushes git tag
# 6. Pushes to GitHub
# 7. Creates GitHub Release with .fig files from /release

VERSION_TYPE=${1:-patch}
RELEASE_DIR="release"

# Validate version type
if [[ ! "$VERSION_TYPE" =~ ^(patch|minor|major)$ ]]; then
  echo "❌ Error: Invalid version type '$VERSION_TYPE'"
  echo "Usage: ./scripts/release.sh [patch|minor|major]"
  exit 1
fi

echo "🚀 Creating $VERSION_TYPE release..."

# Ensure we're on main branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "❌ Error: Must be on main branch to release"
  echo "Current branch: $CURRENT_BRANCH"
  exit 1
fi

# Ensure clean working directory (ignore submodule changes)
if [ -n "$(git status --porcelain | grep -v '^ M')" ]; then
  echo "❌ Error: Working directory is not clean"
  echo "Please commit or stash your changes first"
  git status --short | grep -v '^ M'
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
VERSION_NUM="${NEW_VERSION#v}"  # Remove 'v' prefix

# Update manifest.json version
echo "📝 Updating manifest.json..."
node -e "
const fs = require('fs');
const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
manifest.version = '$VERSION_NUM';
fs.writeFileSync('manifest.json', JSON.stringify(manifest, null, 2) + '\n');
"

# Update CHANGELOG.md
echo "📝 Updating CHANGELOG.md..."
PREV_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
CURRENT_DATE=$(date +%Y-%m-%d)

if [[ -n "$PREV_TAG" ]]; then
  # Parse conventional commits since last tag
  COMMITS=$(git log "$PREV_TAG"..HEAD --pretty=format:"%s" --no-merges)

  # Categorize commits
  FEATURES=""
  FIXES=""
  DOCS=""
  CHORES=""
  OTHERS=""

  while IFS= read -r commit; do
    # Skip empty lines
    [[ -z "$commit" ]] && continue

    # Parse conventional commit format (simplified regex for bash compatibility)
    if [[ "$commit" =~ ^feat ]]; then
      desc="${commit#*: }"
      FEATURES+="- $desc"$'\n'
    elif [[ "$commit" =~ ^fix ]]; then
      desc="${commit#*: }"
      FIXES+="- $desc"$'\n'
    elif [[ "$commit" =~ ^docs ]]; then
      desc="${commit#*: }"
      DOCS+="- $desc"$'\n'
    elif [[ "$commit" =~ ^chore ]]; then
      desc="${commit#*: }"
      CHORES+="- $desc"$'\n'
    elif [[ ! "$commit" =~ ^(test|style|refactor|perf|ci|build) ]]; then
      # Include non-conventional commits that aren't internal changes
      OTHERS+="- $commit"$'\n'
    fi
  done <<< "$COMMITS"

  # Build changelog entry
  CHANGELOG_ENTRY="## [$VERSION_NUM](https://github.com/joshjhall/google-symbols-figma-plugin/compare/$PREV_TAG...$NEW_VERSION) ($CURRENT_DATE)"$'\n\n'

  if [[ -n "$FEATURES" ]]; then
    CHANGELOG_ENTRY+="### Features"$'\n\n'
    CHANGELOG_ENTRY+="$FEATURES"$'\n'
  fi

  if [[ -n "$FIXES" ]]; then
    CHANGELOG_ENTRY+="### Bug Fixes"$'\n\n'
    CHANGELOG_ENTRY+="$FIXES"$'\n'
  fi

  if [[ -n "$DOCS" ]]; then
    CHANGELOG_ENTRY+="### Documentation"$'\n\n'
    CHANGELOG_ENTRY+="$DOCS"$'\n'
  fi

  if [[ -n "$CHORES" ]]; then
    CHANGELOG_ENTRY+="### Maintenance"$'\n\n'
    CHANGELOG_ENTRY+="$CHORES"$'\n'
  fi

  if [[ -n "$OTHERS" ]]; then
    CHANGELOG_ENTRY+="### Other Changes"$'\n\n'
    CHANGELOG_ENTRY+="$OTHERS"$'\n'
  fi
else
  # First release
  CHANGELOG_ENTRY="## [$VERSION_NUM] ($CURRENT_DATE)"$'\n\n'
  CHANGELOG_ENTRY+="### Features"$'\n\n'
  CHANGELOG_ENTRY+="- Initial release"$'\n\n'
fi

# Prepend to CHANGELOG.md (after any existing header)
if [[ -f "CHANGELOG.md" ]]; then
  # Create temp file with new entry at the top
  {
    echo "$CHANGELOG_ENTRY"
    cat CHANGELOG.md
  } > CHANGELOG.md.tmp
  mv CHANGELOG.md.tmp CHANGELOG.md
else
  # Create new CHANGELOG
  {
    echo "# Changelog"
    echo ""
    echo "All notable changes to this project will be documented in this file."
    echo ""
    echo "The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),"
    echo "and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)."
    echo ""
    echo "$CHANGELOG_ENTRY"
  } > CHANGELOG.md
fi

# Stage changes
git add package.json manifest.json CHANGELOG.md

# Commit
echo "💾 Creating release commit..."
git commit -m "chore(release): $VERSION_NUM

- Updated package.json and manifest.json to $VERSION_NUM
- Updated CHANGELOG.md with release notes
- Rebuilt plugin artifacts"

# Tag
echo "🏷️  Creating git tag..."
git tag -a "$NEW_VERSION" -m "Release $NEW_VERSION"

# Push changes and tag
echo "📤 Pushing to remote..."
git push origin main
git push origin "$NEW_VERSION"

# Check for .fig files
FIG_COUNT=0
FIG_FILES=()
if [[ -d "$RELEASE_DIR" ]]; then
  while IFS= read -r -d '' file; do
    FIG_FILES+=("$file")
  done < <(find "$RELEASE_DIR" -name "*.fig" -print0 2>/dev/null)
  FIG_COUNT=${#FIG_FILES[@]}
fi

# Get icon metadata for release notes
ICON_SHA=$(jq -r '.commitSha // "unknown"' src/lib/icons/icon-list-metadata.json 2>/dev/null || echo "unknown")
ICON_COUNT=$(jq -r '.iconCount // 0' src/lib/icons/icon-list-metadata.json 2>/dev/null || echo "0")

# Extract changelog for this version from CHANGELOG.md
CHANGELOG_SECTION=$(awk "/^## \[$VERSION_NUM\]/,/^## \[/" CHANGELOG.md | sed '$d' | tail -n +2)

# Generate GitHub Release notes
if [[ $FIG_COUNT -gt 0 ]]; then
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

$CHANGELOG_SECTION

---

**Icon Data Commit:** [\`${ICON_SHA:0:7}\`](https://github.com/google/material-design-icons/commit/$ICON_SHA)
EOF
)
else
  RELEASE_NOTES=$(cat <<EOF
# Google Material Symbols Figma Plugin $NEW_VERSION

This release includes **$ICON_COUNT Material Symbols** icons.

⚠️ **Note:** This release does not include pre-generated .fig files. You can generate icons using the plugin in Figma Desktop.

## 🚀 Quick Start

**Install the Plugin:**
1. Install from Figma Community (coming soon)
2. Or: Import manifest.json in Figma Desktop
3. Generate icons on-demand in your workspace

## 🔄 Changes

$CHANGELOG_SECTION

---

**Icon Data Commit:** [\`${ICON_SHA:0:7}\`](https://github.com/google/material-design-icons/commit/$ICON_SHA)
EOF
)
fi

# Create GitHub Release
echo ""
echo "📝 Creating GitHub Release..."

if [[ $FIG_COUNT -gt 0 ]]; then
  echo "📦 Uploading $FIG_COUNT .fig files..."
  gh release create "$NEW_VERSION" \
    --title "Google Material Symbols $NEW_VERSION" \
    --notes "$RELEASE_NOTES" \
    "${FIG_FILES[@]}"
  echo "✅ GitHub Release created with $FIG_COUNT .fig files"
else
  gh release create "$NEW_VERSION" \
    --title "Google Material Symbols $NEW_VERSION" \
    --notes "$RELEASE_NOTES"
  echo "✅ GitHub Release created (no .fig files)"
  echo ""
  echo "💡 To add .fig files later:"
  echo "   1. Generate .fig files in Figma Desktop"
  echo "   2. Save to $RELEASE_DIR/"
  echo "   3. Run: gh release upload $NEW_VERSION $RELEASE_DIR/*.fig"
fi

echo ""
echo "🎉 Release $NEW_VERSION complete!"
echo "🔗 https://github.com/joshjhall/google-symbols-figma-plugin/releases/tag/$NEW_VERSION"
echo ""
