# Release Process

This document describes the complete release workflow for the Google Material Symbols Figma Plugin, including automated icon updates and manual release creation with .fig files.

## Overview

The release process is split into two phases:

1. **Automated (CI/CD)**: Detect icon updates from Google, run tests, create PR
2. **Manual (You)**: Review changes, generate .fig files, create release

## Important: Manual Releases Required

**Why manual?** The automated semantic-release workflow has been **disabled** because:

- .fig files are ~900MB and cannot be packaged automatically
- .fig files must be generated locally in Figma Desktop
- Manual process ensures .fig files match the icon data

**What's automated:** Icon update detection and PR creation
**What's manual:** .fig generation and GitHub Release creation with `scripts/release.sh`

## Phase 1: Automated Icon Updates (CI/CD)

### Workflow

```yaml
# Suggested GitHub Actions workflow (.github/workflows/icon-update.yml)
name: Check for Icon Updates

on:
  schedule:
    - cron: '0 0 * * *' # Daily at midnight
  workflow_dispatch: # Manual trigger

jobs:
  check-updates:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 10

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Check for updates
        id: update
        run: |
          # Fetch latest icon list from Google
          pnpm icons:update --ref=master

          # Check if anything changed
          if git diff --quiet src/lib/icons/; then
            echo "changed=false" >> $GITHUB_OUTPUT
          else
            echo "changed=true" >> $GITHUB_OUTPUT
            # Get new commit SHA
            NEW_SHA=$(jq -r '.commitSha' src/lib/icons/icon-list-metadata.json)
            echo "sha=$NEW_SHA" >> $GITHUB_OUTPUT
          fi

      - name: Generate delta
        if: steps.update.outputs.changed == 'true'
        run: pnpm icons:compare

      - name: Run tests
        if: steps.update.outputs.changed == 'true'
        id: test
        run: |
          pnpm test:run && echo "passed=true" >> $GITHUB_OUTPUT || echo "passed=false" >> $GITHUB_OUTPUT

      - name: Create PR (if tests pass)
        if: steps.update.outputs.changed == 'true' && steps.test.outputs.passed == 'true'
        uses: peter-evans/create-pull-request@v5
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          commit-message: 'chore: update icons to ${{ steps.update.outputs.sha }}'
          title: 'Update Material Icons to ${{ steps.update.outputs.sha }}'
          body: |
            ## Icon Update Available

            New icons detected from Google Material Design Icons repository.

            **Commit:** [`${{ steps.update.outputs.sha }}`](https://github.com/google/material-design-icons/commit/${{ steps.update.outputs.sha }})

            ### Changes
            See `icon-changes.json` for detailed changes.

            ### Next Steps
            1. Review this PR
            2. Merge if acceptable
            3. Generate .fig files in Figma
            4. Run `./scripts/release.sh` to create release
          branch: icon-update-${{ steps.update.outputs.sha }}
          delete-branch: true

      - name: Notify (Pushover)
        if: steps.update.outputs.changed == 'true'
        run: |
          STATUS="${{ steps.test.outputs.passed }}"
          SHA="${{ steps.update.outputs.sha }}"

          if [ "$STATUS" == "true" ]; then
            MESSAGE="✅ Icon update PR created for commit ${SHA:0:7}"
            PRIORITY=0
          else
            MESSAGE="❌ Icon update failed tests for commit ${SHA:0:7}"
            PRIORITY=1
          fi

          curl -s \
            --form-string "token=${{ secrets.PUSHOVER_TOKEN }}" \
            --form-string "user=${{ secrets.PUSHOVER_USER }}" \
            --form-string "message=$MESSAGE" \
            --form-string "priority=$PRIORITY" \
            --form-string "url=https://github.com/${{ github.repository }}/pulls" \
            https://api.pushover.net/1/messages.json
```

### Required Secrets

Add these to your repository secrets:

- `PUSHOVER_TOKEN` - Your Pushover application token
- `PUSHOVER_USER` - Your Pushover user key

## Phase 2: Manual Release Creation

### Prerequisites

1. Icon update PR has been merged to main
2. You have `gh` CLI installed and authenticated
3. (Optional) Figma Desktop installed if including .fig files

### One-Command Release

The `scripts/release.sh` script handles the complete release workflow:

```bash
# Create a patch release (1.0.0 → 1.0.1)
./scripts/release.sh patch

# Or create a minor release (1.0.0 → 1.1.0)
./scripts/release.sh minor

# Or create a major release (1.0.0 → 2.0.0)
./scripts/release.sh major
```

**What the script does automatically:**

1. ✅ Runs tests, lint, and type checking
2. ✅ Builds the plugin
3. ✅ Bumps version in `package.json` and `manifest.json`
4. ✅ Updates `CHANGELOG.md` with conventional commit entries
5. ✅ Commits all changes
6. ✅ Creates and pushes git tag
7. ✅ Pushes to GitHub
8. ✅ Creates GitHub Release
9. ✅ Uploads all `.fig` files from `release/` directory (if present)

### Including .fig Files (Optional)

If you want to include pre-generated Figma files in the release:

#### 1. Generate Figma Files (Before Running Release Script)

1. Pull latest changes: `git pull origin main`
2. Open Figma Desktop
3. Run: **Plugins → Material Icons Generator**
4. Click "Generate All Categories"
5. Wait for generation (~10-15 minutes with delta updates)
6. For each of the 26 generated pages:
   - Right-click the page tab
   - Select "Save as .fig file"
   - Save to `release/` directory
   - Use naming: `Set_01_10k-air.fig`, etc.

#### 2. Verify Files

```bash
# Check file count (should be 26)
ls -1 release/*.fig | wc -l

# Check total size (should be ~900MB)
du -sh release/
```

#### 3. Run Release Script

Now run the release script as shown above. It will automatically detect and upload all `.fig` files.

### Without .fig Files

The release script works fine without .fig files:

- It will create the release successfully
- Release notes will indicate no .fig files are included
- You can add them later with: `gh release upload vX.X.X release/*.fig`

### Verify Release

1. Visit: https://github.com/joshjhall/google-symbols-figma-plugin/releases
2. Check that all .fig files are attached (if you included them)
3. Verify CHANGELOG.md was updated
4. Test downloading and importing a .fig file to Figma

### Cleanup (Optional)

```bash
# Remove local .fig files (they're on GitHub now)
rm release/*.fig

# Or archive them
mkdir -p ~/.figma-releases/vX.X.X/
mv release/*.fig ~/.figma-releases/vX.X.X/
```

## Versioning Strategy

### Semantic Versioning

- **Major (2.0.0)**: Breaking changes to plugin API or icon structure
- **Minor (1.1.0)**: New icons added, significant icon updates, new features
- **Patch (1.0.1)**: Bug fixes, small improvements, minor icon corrections

### When to Release

**Suggested cadence:**

- **Automatic icon updates**: Check daily via CI/CD
- **Plugin releases**:
  - Immediately for critical bugs (patch)
  - Monthly for accumulated icon updates (minor)
  - As needed for breaking changes (major)

## Troubleshooting

### Tests Fail in CI

1. Check the PR for test output
2. Pull the PR branch locally: `gh pr checkout <number>`
3. Run tests: `pnpm test`
4. Fix issues and push

### .fig File Generation Takes Too Long

- First time: 3-4 hours (generating all 504 variants × 4000 icons)
- With delta updates: 10-15 minutes (only changed icons)
- Make sure icon changes are properly detected

### Release Script Fails

**Check prerequisites:**

```bash
# Ensure gh CLI is authenticated
gh auth status

# Ensure working directory is clean
git status

# Ensure you're on main branch
git branch --show-current
```

**If release was partially created:**

```bash
# Delete the tag locally and remotely
git tag -d vX.X.X
git push origin :refs/tags/vX.X.X

# Delete the GitHub Release
gh release delete vX.X.X

# Reset the version bump
git reset --hard HEAD~1

# Try again
./scripts/release.sh patch
```

### Rate Limiting

The plugin has built-in rate limiting for GitHub API. If you hit limits:

- Wait for the automatic retry (exponential backoff)
- Or use a GitHub token with higher rate limits

## Directory Structure

```
google-symbols-figma-plugin/
├── release/                    # .fig files (gitignored)
│   ├── README.md              # Documentation
│   └── *.fig                  # Not in git, uploaded to releases
├── scripts/
│   ├── release.sh             # Main release script
│   ├── update-icon-list.ts    # Fetch icons from Google
│   └── compare-and-generate.ts # Generate delta
└── src/lib/icons/
    ├── all-icons-data.json    # Complete icon list
    ├── icon-list-metadata.json # Commit SHA and metadata
    └── icon-changes*.json     # Delta files (optional)
```

## Notes

- **Storage**: .fig files are ~900MB total, too large for git
- **GitHub Releases**: No size limit on release assets for free accounts
- **Icon data**: Always committed to repo for plugin functionality
- **Version tags**: Created during manual release process
- **.fig files**: Optional but highly recommended for users
