# Installation Guide

This guide will help you install and set up the Google Material Symbols Figma Plugin.

## Prerequisites

- **Figma Desktop** application (plugin does not work in browser)
- **Material Symbols font** (optional, but recommended for preview)

## Installation Methods

### Method 1: From Release (Recommended)

1. **Download the latest release:**
   - Visit the [Releases page](https://github.com/your-org/google-symbols-figma-plugin/releases)
   - Download the latest `.zip` file

2. **Extract the files:**

   ```bash
   unzip google-symbols-figma-plugin-v1.0.0.zip
   cd google-symbols-figma-plugin
   ```

3. **Load in Figma:**
   - Open **Figma Desktop**
   - Go to **Plugins → Development → Import plugin from manifest...**
   - Navigate to the extracted folder
   - Select `manifest.json`

4. **Verify installation:**
   - The plugin should now appear in **Plugins → Development**
   - Look for "Google Material Symbols"

### Method 2: From Source

For development or contributing:

1. **Clone the repository:**

   ```bash
   git clone https://github.com/your-org/google-symbols-figma-plugin.git
   cd google-symbols-figma-plugin
   ```

2. **Install dependencies:**

   ```bash
   pnpm install
   ```

3. **Build the plugin:**

   ```bash
   pnpm build
   ```

4. **Load in Figma:**
   - Follow steps 3-4 from Method 1

## Verification

After installation, verify the plugin is working:

1. Open any Figma file
2. Go to **Plugins → Development → Google Material Symbols**
3. The plugin UI should appear

## Troubleshooting

### Plugin doesn't appear in menu

- Ensure you're using **Figma Desktop** (not browser)
- Check that `manifest.json` is in the root directory
- Try restarting Figma

### "Failed to load plugin" error

- Verify `dist/code.js` exists and is not empty
- Check Figma's Developer Console: **Plugins → Development → Show/Hide Console**
- Rebuild the plugin: `pnpm build`

### Icons don't render properly

- Install Material Symbols font:
  - Visit [Google Fonts](https://fonts.google.com/icons)
  - Download and install Material Symbols Rounded/Sharp/Outlined

## Updating

### From Release

1. Download the latest release
2. Extract to the same location (or new location)
3. Reload in Figma (or point to new location)

### From Source

```bash
git pull origin main
pnpm install
pnpm build
```

Then reload the plugin in Figma:

- **Plugins → Development → Hot reload plugin** (if supported)
- Or re-import the manifest

## Uninstallation

1. Open Figma Desktop
2. Go to **Plugins → Development**
3. Right-click "Google Material Symbols"
4. Select **Remove**

Or manually:

- Delete the plugin directory from your system

## Next Steps

- [Usage Guide](usage.md) - Learn how to use the plugin
- [Development Setup](development.md) - Set up for contributing

## Getting Help

- 📖 [Documentation](../README.md)
- 🐛 [Report Issues](https://github.com/your-org/google-symbols-figma-plugin/issues)
- 💬 [Discussions](https://github.com/your-org/google-symbols-figma-plugin/discussions)
