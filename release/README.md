# Release Directory

This directory contains pre-generated Figma files for releases. These files are **not version controlled** due to their size (~900MB total) but are uploaded as GitHub Release assets.

## File Naming Convention

Files should be named to match the category sets:
```
Set_01_10k-air.fig
Set_02_ala-arr.fig
...
Set_26_web-zoo.fig
```

## Release Process

### 1. After Icon Updates Are Merged

When a PR with icon updates is merged to main:

```bash
# Pull latest changes
git pull origin main

# Verify icon metadata
cat src/lib/icons/icon-list-metadata.json
```

### 2. Generate Figma Files

1. Open Figma Desktop
2. Run the plugin: **Plugins → Material Icons Generator**
3. Generate all 26 category sets (this takes 10-15 minutes with delta updates)
4. For each generated page/set:
   - Right-click the page
   - Select "Save as .fig file"
   - Save to this `release/` directory
   - Use naming convention above

### 3. Create Release

```bash
# Ensure all 26 .fig files are in release/
ls -1 release/*.fig | wc -l  # Should output: 26

# Create release with auto-generated notes
./scripts/create-release.sh --version v1.0.0

# Or preview without making changes
./scripts/create-release.sh --version v1.0.0 --dry-run
```

The script will:
- Create and push a git tag
- Create a GitHub Release
- Upload all .fig files as release assets
- Generate release notes with icon metadata

### 4. Verify Release

1. Visit: https://github.com/joshjhall/google-symbols-figma-plugin/releases
2. Check that all 26 .fig files are attached
3. Test downloading and importing one file into Figma
4. Verify icons load correctly

## Directory Structure

```
release/
├── README.md          (this file - version controlled)
└── *.fig             (not version controlled, uploaded to GitHub Releases)
```

## Cleanup

After creating a release, you can optionally clean up old .fig files:

```bash
# Move to archived location
mkdir -p ~/.local/share/figma-releases/v1.0.0/
mv release/*.fig ~/.local/share/figma-releases/v1.0.0/

# Or simply delete (they're on GitHub Releases)
rm release/*.fig
```

## Notes

- Each .fig file is 28-44MB (total ~900MB for all 26)
- .fig files are gitignored to prevent bloating the repository
- GitHub Release assets have no size limit for free accounts
- Users can download individual sets or all sets as needed
