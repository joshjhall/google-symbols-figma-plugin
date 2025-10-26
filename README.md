# Google Material Symbols Figma Plugin

[![CI](https://github.com/joshjhall/google-symbols-figma-plugin/actions/workflows/ci.yml/badge.svg)](https://github.com/joshjhall/google-symbols-figma-plugin/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

A Figma plugin for generating and maintaining a complete Google Material Symbols library. Automatically syncs with Google's official Material Design Icons repository and generates SVG-based Figma components with comprehensive variant support.

## ✨ Features

- 🎨 **4000+ Icons**: Complete Material Symbols library
- 🎨 **SVG Components**: High-quality vector components with proper Figma structure
- 🎛️ **504 Variants per Icon**: 7 styles × 6 weights × 2 fills × 3 grades × 4 optical sizes
- 📁 **Smart Organization**: Automatic category-based page structure (alphabetical sets)
- 🔄 **Incremental Updates**: Intelligent content hash comparison preserves customizations
- ⚡ **Performance Optimized**: Batch processing with rate limiting for GitHub API
- 🤖 **Auto-Updates**: Weekly automated checks for new icons from Google
- 🎯 **Commit-Based Versioning**: Pins to specific commit SHA for consistency

## 🚀 Quick Start

### Installation

1. Download the latest release from [Releases](https://github.com/joshjhall/google-symbols-figma-plugin/releases)
2. Open Figma Desktop
3. Go to **Plugins → Development → Import plugin from manifest**
4. Select the `manifest.json` file
5. The plugin appears in your plugins menu

### Usage

1. **Generate Initial Library**
   - Run the plugin: **Plugins → Google Material Symbols**
   - Select icon style (Rounded/Sharp/Outlined)
   - Choose font weights to include
   - Click **Start Import**

2. **Update Existing Library**
   - Run plugin on existing library file
   - Plugin detects and updates changed icons
   - New icons added automatically
   - Deprecated icons preserved

## 📖 Documentation

- [Installation Guide](docs/installation.md)
- [Usage Guide](docs/usage.md)
- [Development Setup](docs/development.md)
- [Updating Icons](docs/UPDATING.md)
- [Architecture Overview](docs/architecture.md)
- [Scripts Reference](docs/scripts.md)

## 🛠️ Development

### Prerequisites

- Node.js 18+
- pnpm 8+
- Figma Desktop

### Setup

```bash
# Clone the repository
git clone https://github.com/joshjhall/google-symbols-figma-plugin.git
cd google-symbols-figma-plugin

# Install dependencies
pnpm install

# Build the plugin
pnpm build

# Watch mode for development
pnpm dev
```

### Available Scripts

```bash
pnpm build          # Production build
pnpm dev            # Development watch mode
pnpm test           # Run tests
pnpm test:coverage  # Generate coverage report
pnpm lint           # Lint code
pnpm lint:fix       # Fix linting issues
pnpm format         # Format code
pnpm typecheck      # Type check
pnpm icons:update   # Update icon list from Google
pnpm icons:compare  # Generate comparison delta
```

## 🏗️ Architecture

```
google-symbols-figma-plugin/
├── src/
│   ├── code.ts              # Main plugin code (Figma API)
│   ├── ui.tsx               # Plugin UI (React)
│   ├── lib/
│   │   ├── icons/           # Icon fetching and management
│   │   ├── github/          # GitHub API integration
│   │   ├── pages/           # Page organization
│   │   ├── tokens/          # Token system
│   │   └── utils/           # Utilities
│   └── handlers/            # Message handlers
├── scripts/
│   ├── update-icon-list.ts  # Fetch latest icons from Google
│   ├── compare-and-generate.ts  # Generate update delta
│   └── build-html.js        # UI build script
├── dist/                    # Built plugin files
└── docs/                    # Documentation
```

## 🔄 Icon Updates

The plugin automatically tracks changes from [Google's Material Design Icons repository](https://github.com/google/material-design-icons).

**Manual Update:**

```bash
pnpm icons:update    # Fetch latest icon list
pnpm icons:compare   # Generate comparison
pnpm build           # Rebuild plugin
```

**Automated:**

- GitHub Actions checks for updates weekly
- Creates PR automatically when updates found
- Includes delta of changes

See [Updating Icons Documentation](docs/UPDATING.md) for details.

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Quick Contribution Steps

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Add tests if applicable
5. Ensure tests pass: `pnpm test`
6. Commit using conventional commits: `git commit -m "feat: add amazing feature"`
7. Push to your fork: `git push origin feature/amazing-feature`
8. Open a Pull Request

### Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `chore:` Maintenance tasks
- `test:` Test changes
- `refactor:` Code refactoring

## 📊 Performance

| Metric                   | Value                                                     |
| ------------------------ | --------------------------------------------------------- |
| Total Icons              | 4000+                                                     |
| Variants per Icon        | 504 (7 styles × 6 weights × 2 fills × 3 grades × 4 sizes) |
| Generation Time (full)   | Varies by category and API rate limits                    |
| Update Time (with delta) | Faster - only changed icons                               |
| Rate Limiting            | Exponential backoff (1m → 2m → 4m → 8m → 10m max)         |

## 🐛 Troubleshooting

### Plugin crashes during generation

- Reduce batch size in configuration
- Generate fewer weight variants
- Split generation across multiple sessions

### Icons don't render correctly

- Check SVG content is being fetched from GitHub
- Verify commit SHA in icon-list-metadata.json is valid
- Ensure network connectivity to raw.githubusercontent.com

### Rate limiting errors

- Plugin auto-retries with exponential backoff
- Re-run plugin later if limits exceeded
- Consider GitHub token for higher limits

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Google Material Design team for the [Material Symbols](https://fonts.google.com/icons)
- [Material Design Icons Repository](https://github.com/google/material-design-icons)
- Figma Plugin API

## 📞 Support

- 🐛 [Report a Bug](https://github.com/joshjhall/google-symbols-figma-plugin/issues/new?template=bug_report.md)
- 💡 [Request a Feature](https://github.com/joshjhall/google-symbols-figma-plugin/issues/new?template=feature_request.md)
- 💬 [Discussions](https://github.com/joshjhall/google-symbols-figma-plugin/discussions)

---

Made with ❤️ for the design community
