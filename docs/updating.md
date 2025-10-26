# Updating Material Icons from Google

This document explains how to update the Material Icons when Google releases new versions.

## Overview

Google's Material Icons repo is updated periodically with:

- New icons added
- Existing icons modified (design changes)
- Bug fixes to SVG paths

Typically, only a small percentage of icons change in any given update (often <5%). This workflow optimizes updates by:

1. **Detecting exactly which icons changed** between commits
2. **Only re-downloading changed icons**
3. **Fast-forwarding unchanged icons** by just updating their commit SHA

## Full Update Workflow

### Step 1: Update Icon List

This fetches the latest commit SHA and icon list from Google's repo:

```bash
cd packages/figma
tsx scripts/update-icon-list.ts
```

**Output:**

- `src/lib/all-icons-data.json` - Updated with new commit SHA and icon list
- `icon-list-metadata.json` - Metadata including commit SHA
- Console shows: added icons, deprecated icons, total count

### Step 2: Compare & Generate (AUTOMATED)

**This single command does everything:**

- Auto-detects if commit SHA changed
- Generates comparison delta (cumulative tracking)
- Updates categories
- Skips if no changes detected

```bash
tsx scripts/compare-and-generate.ts
```

**What it does:**

1. **Checks commit SHA**: Compares previous (from git) vs current
2. **If unchanged**: Exits early - nothing to do
3. **If changed**:
   - Fetches icon changes from GitHub API
   - Updates cumulative change tracking
   - Generates `icon-changes.json`
   - Generates `icon-changes-cumulative.json`
   - Regenerates categories

**Output:**

```text
═══════════════════════════════════════
COMPARE & GENERATE CATEGORIES
═══════════════════════════════════════

Previous commit: abc123a
Current commit:  def456b

🔄 Commits differ - generating comparison delta...

🔍 Fetching changes: abc123a → def456b
   ✓ Found 127 changed icons (5 new)
✅ Saved cumulative changes to icon-changes-cumulative.json
✅ Saved current comparison to icon-changes.json

💡 Optimization Impact:
   Total icons: 3933
   Changed: 127 (3.2%)
   Unchanged: 3806 (96.8%)
   Variants to skip: 1,918,224
   Estimated time saved: ~127 minutes

📊 Cumulative Change Tracking:
   Tracked commits: 3
   Direct comparisons: 2
   Available paths: 2/6

═══════════════════════════════════════
GENERATING CATEGORIES
═══════════════════════════════════════
[Category generation output...]

✅ Complete! Plugin is ready to use.

Next step: pnpm build
```

**Files generated:**

- `icon-changes.json` - Current comparison
- `icon-changes-cumulative.json` - All comparisons (cumulative tracking)
- `category-mapping.json` - Updated categories
- `categories-summary.json` - Category metadata

### Step 3: Rebuild Plugin

```bash
pnpm build        # Builds plugin code
pnpm build:ui     # Builds UI
```

This embeds the new icon list, commit SHA, and icon-changes.json (if present) into the plugin bundle.

### Step 4: Run Plugin in Figma

1. Open Figma file with Material Icons
2. Run plugin: Plugins → Development → Material Icons Generator
3. Select the set(s) you want to update
4. Click "Start Import"

**What happens with cumulative tracking:**

The plugin is smart about version skips! It uses cumulative change data to handle cases where you skip versions.

**Example scenario:**

- Figma icon built against: `SHA-A` (2 months ago)
- Plugin updated to: `SHA-B` (1 month ago) - but you didn't run plugin
- Plugin now at: `SHA-C` (today)

Traditional approach would re-download everything because SHA-A ≠ SHA-C.

**With cumulative tracking:**

- Plugin checks: Did `alarm` icon change from `SHA-A` → `SHA-C`?
- Looks up path: `SHA-A → SHA-B → SHA-C` in cumulative data
- Combines changes: `SHA-A→SHA-B` (no change) + `SHA-B→SHA-C` (no change) = **no change**
- Result: Fast-forwards `alarm` by updating SHA only, no download!

**Performance:**

- Unchanged icons: Updates commit SHA only (~2ms each)
  Message: `✓ alarm unchanged (abc123a→def456c) - updated commit SHA only`
- Changed icons: Full re-download (~2-4 sec each)
  Message: `Updating alarm (abc123a→def456c)...`
- New icons: Full download
- **Total time:** ~10-15 minutes for typical update

**WITHOUT cumulative data:**

- All icons with SHA mismatch: Re-downloads all variants
- **Total time:** ~1-2 hours (smart skip still helps)

## CI/CD Integration

The cumulative tracking system enables fully automated plugin updates:

```yaml
# .github/workflows/update-icons.yml
name: Update Material Icons

on:
  schedule:
    - cron: '0 0 * * 0' # Weekly on Sunday
  workflow_dispatch: # Manual trigger

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: pnpm install

      - name: Update icon list
        run: cd packages/figma && tsx scripts/update-icon-list.ts

      - name: Compare and generate
        run: cd packages/figma && tsx scripts/compare-and-generate.ts

      - name: Build plugin
        run: cd packages/figma && pnpm build

      - name: Commit changes
        run: |
          git config user.name "Bot"
          git config user.email "bot@example.com"
          git add .
          git commit -m "chore: update material icons" || echo "No changes"
          git push
```

**Benefits:**

- ✅ Runs automatically every week
- ✅ Only updates if Google pushed new commits
- ✅ Cumulative tracking handles multiple updates
- ✅ Users can skip plugin runs without losing optimization

## Quick Update (No Changes Detection)

If you skip Step 2, the plugin will still work but will:

- Re-check all icons (still fast due to smart skip)
- Re-download any icon where commit SHA doesn't match
- Take longer (1-2 hours vs 10-15 minutes)

## When to Skip icon-changes.json

**Skip the optimization if:**

- First time importing (no existing icons)
- Major refactor/rebuild needed
- Debugging issues with selective updates

**Use the optimization if:**

- Regular updates (Google releases new commit)
- Most icons haven't changed
- You want faster updates

## Troubleshooting

### "All variants failed" errors

**Cause:** GitHub rate limiting

**Solution:**

- Plugin automatically retries with exponential backoff (1min → 2min → 4min → 8min → 10min)
- If still failing after 4 retries, icon is skipped
- Re-run the plugin later to pick up skipped icons

### Incomplete icons

**Cause:** Aggressive rate limiting even after retries

**Solution:**

- Plugin now skips incomplete icons (won't create them)
- Re-run later when rate limits reset
- Icons with wrong commit SHA will be updated on next run

### icon-changes.json not found

**Not an error!** Plugin will work fine, just slower. It will:

- Check all icons for updates
- Skip icons that are already up-to-date
- Download only icons that need updates

## Performance Comparison

**Scenario: Google adds 5 new icons, modifies 122 existing**

| Method                        | Icons Processed | Variants Downloaded | Time           |
| ----------------------------- | --------------- | ------------------- | -------------- |
| **With icon-changes.json**    | 127 changed     | ~64,000             | ~10-15 min     |
| **Without icon-changes.json** | 3933 all        | ~2,000,000          | ~3-4 hours     |
| **Savings**                   | **97% fewer**   | **97% fewer**       | **92% faster** |

## Files Generated

| File                          | Purpose                           | When Generated              |
| ----------------------------- | --------------------------------- | --------------------------- |
| `icon-list-metadata.json`     | Commit SHA, icon count, timestamp | Step 1: update-icon-list    |
| `src/lib/all-icons-data.json` | Complete icon list                | Step 1: update-icon-list    |
| `icon-changes.json`           | Changed icons delta               | Step 2: check-icon-changes  |
| `category-mapping.json`       | Icon → Set mapping                | Step 3: generate-categories |
| `categories-summary.json`     | Set metadata                      | Step 3: generate-categories |

## Git Workflow

```bash
# After completing update
git add packages/figma/
git commit -m "feat(figma): update icons to commit abc123

- Added 5 new icons
- Updated 122 changed icons
- Total icons: 3933"

git push
```

## GitHub API Rate Limits

The `check-icon-changes.ts` script uses GitHub's API:

- **Unauthenticated:** 60 requests/hour
- **Authenticated:** 5000 requests/hour

To use authenticated API (recommended):

```bash
# Set GitHub token
export GITHUB_TOKEN=your_token_here

# Then run check-icon-changes
tsx scripts/check-icon-changes.ts $OLD_COMMIT $NEW_COMMIT
```

The compare endpoint only counts as 1 API call, so even unauthenticated should work fine.
