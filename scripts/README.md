# Figma Plugin Build Scripts

## Architecture: Single Source of Truth

This plugin follows a **strict single-source-of-truth architecture** to avoid data conflicts:

```text
┌──────────────────────────────────────────────────────────────┐
│ PHASE 1: Fetch Icon List (SINGLE SOURCE OF TRUTH)           │
│ Script: scripts/update-icon-list.ts                         │
│                                                              │
│ GitHub Material Design Icons Repo (symbols/web)             │
│         ↓                                                    │
│ ✅ all-icons.txt (human-readable reference)                 │
│ ✅ src/lib/all-icons-data.json (runtime data)               │
└──────────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ PHASE 2: Generate Categories                                 │
│ Script: scripts/generate-categories.ts                       │
│                                                              │
│ READ src/lib/all-icons-data.json                            │
│         ↓                                                    │
│ ✅ category-mapping.json (icon → category map)              │
│ ✅ categories-summary.json (UI dropdown data)               │
└──────────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ RUNTIME: Figma Plugin                                        │
│                                                              │
│ READ src/lib/all-icons-data.json (getIconRange)             │
│ READ categories-summary.json (UI dropdown)                  │
│         ↓                                                    │
│ ✅ All data consistent - same source!                       │
└──────────────────────────────────────────────────────────────┘
```

**Key Principle:** Only `update-icon-list.ts` should ever fetch from GitHub. All other scripts read from local files.

---

## Scripts Overview

### `update-icon-list.ts` (PHASE 1)

**Purpose:** Fetch the icon list from GitHub and establish the single source of truth.

**What it does:**

1. Fetches ALL icon directory names from Material Design Icons repo (symbols/web)
2. Optionally validates that each icon has SVG files
3. Writes validated icon list to:
   - `all-icons.txt` (human-readable reference)
   - `src/lib/all-icons-data.json` (runtime data - **SOURCE OF TRUTH**)
4. Writes metadata to `icon-list-metadata.json`

**Usage:**

```bash
cd packages/figma

# Use master branch (default)
tsx scripts/update-icon-list.ts

# Use a specific release tag (recommended for stability)
tsx scripts/update-icon-list.ts --ref=4.0.0

# Skip verification (faster, but may include invalid icons)
tsx scripts/update-icon-list.ts --skip-verify
```

**Output files:**

- `all-icons.txt` - List of valid icons (one per line)
- `src/lib/all-icons-data.json` - **Runtime source of truth**
- `icon-list-metadata.json` - Generation metadata
- `invalid-icons.txt` - Invalid icons, if any (with verification)

**Rate limiting:** Uses batches of 50 icons with 1-second delays. Full validation of ~4000 icons takes 5-10 minutes.

---

### `generate-categories.ts` (PHASE 2)

**Purpose:** Generate category boundaries from the validated icon list.

**What it does:**

1. READS from `src/lib/all-icons-data.json` (NO GitHub fetching!)
2. Creates ~26 categories with smart 3-char prefix boundaries
3. Ensures NO ambiguous boundaries (icons with same prefix stay together)
4. Writes category definitions to:
   - `category-mapping.json` (icon → category map)
   - `categories-summary.json` (metadata for UI dropdown)

**Usage:**

```bash
cd packages/figma
tsx scripts/generate-categories.ts
```

**Output files:**

- `category-mapping.json` - Maps each icon to its category
- `categories-summary.json` - Category metadata for UI

**Category Boundaries:**

- Uses 3-character prefixes to group related icons
- NEVER splits icons with the same 3-char prefix across categories
- Balances category sizes (~150 icons each)
- Last category uses special `__END__` marker

---

### `build-html.js`

**Purpose:** Build the plugin UI with embedded JavaScript.

**What it does:**

1. Reads the HTML template (`ui.html`)
2. Reads the compiled UI JavaScript (`dist/ui.js`)
3. Base64-encodes the JavaScript as a data URI
4. Embeds it in the HTML as `<script src="data:text/javascript;base64,...">`
5. Writes the final HTML to `dist/ui.html`

**Why data URI?** Figma's plugin security model uses `document.write()` internally, which breaks when trying to inline large JavaScript with complex escaping. Data URIs bypass this issue entirely.

**Usage:**

```bash
cd packages/figma
pnpm build  # Automatically runs this script
```

---

## Development Workflow

### Initial Setup

```bash
cd packages/figma

# 1. Fetch icon list from GitHub (PHASE 1)
tsx scripts/update-icon-list.ts --ref=master --skip-verify

# 2. Generate categories (PHASE 2)
tsx scripts/generate-categories.ts

# 3. Build plugin
pnpm build
pnpm build:ui
```

### Regular Development

```bash
# Just rebuild the plugin code
cd packages/figma
pnpm build
pnpm build:ui
```

### Updating Icon List

**When to update:**

- Material Symbols adds new icons
- You want to use a different version/tag
- Icon list seems out of sync

**How to update:**

```bash
cd packages/figma

# PHASE 1: Fetch from GitHub (SINGLE SOURCE OF TRUTH)
tsx scripts/update-icon-list.ts --ref=master --skip-verify

# PHASE 2: Regenerate categories from updated list
tsx scripts/generate-categories.ts

# Rebuild plugin
pnpm build
pnpm build:ui

# Commit the updated data
git add all-icons.txt src/lib/all-icons-data.json category-mapping.json categories-summary.json
git commit -m "chore: update icon list from Material Symbols"
```

**IMPORTANT:** Always run BOTH scripts in order. Never run `generate-categories.ts` without first updating `all-icons-data.json`.

---

## Testing in Figma

1. Build the plugin: `pnpm build && pnpm build:ui`
2. In Figma: Plugins → Development → Import plugin from manifest
3. Select `/packages/figma/manifest.json`
4. Open the plugin to test

---

## Configuration

### GitHub Reference (Branch/Tag)

The icon list updater uses a configurable reference (branch or tag) for fetching icons.

**Current default:** `master` branch

**Recommended:** Use the latest stable release tag (currently `4.0.0`) for stability.

**Why use tags instead of branches?**

- **Stability:** Tagged releases don't change
- **Predictability:** You know exactly which icon set you're using
- **Reproducibility:** Others can use the same icon set

---

## Troubleshooting

### "No valid SVGs fetched for [icon-name]"

This means all 504 variant URLs returned 404s. The icon either:

1. Doesn't exist in the current branch/tag
2. Was removed from Material Symbols
3. Was never added (listed in codepoints only)

**Solution:** Run `update-icon-list.ts` to refresh the icon list and exclude missing icons.

### UI Not Loading (Blank Box)

If the plugin loads but shows a blank UI box:

1. Check browser console for errors
2. Verify `dist/ui.html` contains a data URI (not `<script src="ui.js">`)
3. Rebuild: `pnpm build && pnpm build:ui`

### Rate Limit Errors

If you get rate limit errors from GitHub:

1. Wait an hour for the rate limit to reset
2. Use `--skip-verify` to skip SVG validation
3. Authenticate with GitHub CLI: `gh auth login` (increases limit to 5000/hour)

### Data Inconsistency (Icons Missing/Wrong Count)

This happens when files get out of sync. **Always run both phases:**

```bash
# PHASE 1: Update source of truth
tsx scripts/update-icon-list.ts --skip-verify

# PHASE 2: Regenerate categories
tsx scripts/generate-categories.ts

# Rebuild plugin
pnpm build && pnpm build:ui
```

**Never:**

- Edit `all-icons-data.json` manually
- Mix data from different update runs
- Run `generate-categories.ts` without first updating `all-icons-data.json`

---

## File Responsibilities

### Source of Truth

- `src/lib/all-icons-data.json` - **THE SINGLE SOURCE OF TRUTH** for runtime
- Generated by: `scripts/update-icon-list.ts`
- Read by: `scripts/generate-categories.ts`, `src/lib/all-icons.ts`

### Generated Data

- `category-mapping.json` - Icon → category map
- `categories-summary.json` - Category metadata for UI
- Generated by: `scripts/generate-categories.ts`
- Read by: `src/ui.tsx`

### Reference Files

- `all-icons.txt` - Human-readable icon list
- `icon-list-metadata.json` - Generation metadata
- `invalid-icons.txt` - Invalid icons (if any)

### Build Artifacts (Ignored by Git)

- `dist/code.js` - Compiled plugin code
- `dist/ui.js` - Compiled UI code
- `dist/ui.html` - Final UI with embedded JavaScript

---

## Architecture Principles

1. **Single Source of Truth:** Only `update-icon-list.ts` fetches from GitHub
2. **Layered Generation:** PHASE 1 → PHASE 2 → RUNTIME (never skip phases)
3. **Immutable Data:** Generated files are overwritten completely, never patched
4. **Explicit Dependencies:** Each script documents what it reads and writes
5. **Version Control:** All source-of-truth files are committed to git

---

## Future Enhancements

- [ ] Add CI job to check for new icons weekly
- [ ] Add GitHub token support for higher rate limits
- [ ] Add progress bars for long-running operations
- [ ] Validate category boundaries automatically
- [ ] Add icon diff tool (compare old vs new icon lists)
