#!/bin/bash
set -e

# Manual release script for local releases
# Usage: ./scripts/release.sh [patch|minor|major]

VERSION_TYPE=${1:-patch}

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

echo ""
echo "✅ Release $NEW_VERSION created successfully!"
echo ""
echo "To publish this release, run:"
echo "  git push origin main"
echo "  git push origin $NEW_VERSION"
echo ""
echo "Or push everything at once:"
echo "  git push origin main --tags"
