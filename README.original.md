# Material Icons Figma Plugin

A Figma plugin for generating and maintaining a complete Material Icons component library using Google's variable fonts.

## Features

- 🎨 **4000+ Icons**: Complete Material Symbols library
- 🔤 **Variable Fonts**: Efficient icon rendering using font ligatures
- 🎛️ **Full Customization**: Weight, Grade, Optical Size, and Fill variants
- 📁 **Smart Organization**: Category-based page structure
- 🔄 **Easy Updates**: Intelligent diffing preserves customizations
- ⚡ **Performance Optimized**: Handles hundreds of thousands of variants

## Architecture

The plugin generates icon components from Material Symbols variable fonts, creating a comprehensive component library with the following variant dimensions:

- **Style**: Rounded, Sharp, or Outlined (separate files)
- **Weight**: 100-700 (user selectable)
- **Grade**: -25 (dark theme), 0 (normal), 200 (high emphasis)
- **Optical Size**: 20, 24, 40, 48
- **Fill**: 0 (unfilled), 1 (filled)

## Installation

### Development Setup

```bash
# Install dependencies
pnpm install

# Build the plugin
pnpm build

# Watch mode for development
pnpm dev
```

### Loading in Figma

1. Open Figma Desktop
2. Go to Plugins → Development → Import plugin from manifest
3. Select the `manifest.json` file from this directory
4. The plugin will appear in your plugins menu

## Usage

1. **Initial Generation**
   - Run the plugin from Plugins menu
   - Select style (Rounded/Sharp/Outlined)
   - Choose font weights to include
   - Click Generate

2. **Updating Icons**
   - Run plugin on existing library file
   - Plugin detects existing components
   - New icons are added automatically
   - Deprecated icons are marked but preserved

## Project Structure

```text
packages/figma/
├── src/
│   ├── code.ts          # Main plugin code (runs in Figma)
│   ├── ui.tsx           # Plugin UI (runs in iframe)
│   ├── lib/
│   │   ├── font-parser.ts    # Parse ligatures from font files
│   │   ├── icon-generator.ts # Component creation logic
│   │   ├── page-organizer.ts # Page structure management
│   │   └── update-manager.ts # Library update logic
│   └── utils/
│       ├── performance.ts    # Performance monitoring
│       └── constants.ts      # Configuration values
├── tests/               # Test files
├── fonts/              # Material font files (gitignored)
├── manifest.json       # Figma plugin manifest
└── tsconfig.json      # TypeScript configuration
```

## Configuration

Default configuration can be adjusted in `src/utils/constants.ts`:

```typescript
export const DEFAULT_CONFIG = {
  iconsPerPage: 200,
  defaultWeights: [400, 500, 700],
  pageStrategy: 'category', // 'category' | 'alphabetical'
  batchSize: 20, // Icons processed per batch
};
```

## Performance Considerations

- Each icon generates ~72 variants (with 3 weights)
- Files are split by style to stay under Figma limits
- Pages organize icons to prevent loading all at once
- Batch processing maintains UI responsiveness

## Development

### Running Tests

```bash
# Run all tests
pnpm test

# Watch mode
pnpm test:watch

# Type checking
pnpm typecheck
```

### Building for Production

```bash
pnpm build
```

## Troubleshooting

### Plugin crashes during generation

- Reduce batch size in configuration
- Generate fewer weight variants
- Split generation across multiple sessions

### Icons don't render correctly

- Ensure Material Symbols fonts are installed
- Check font variable axis support in Figma
- Verify ligature names match font version

## License

MIT - Part of the Terroir Core design system
