## [1.2.1](https://github.com/joshjhall/google-symbols-figma-plugin/compare/v1.2.0...v1.2.1) (2025-10-26)

### Bug Fixes

- add workflow_dispatch trigger to release.yml

### Maintenance

- update containers submodule to v4.3.1
- update containers submodule to v4.3.0
- update containers submodule to v4.2.0

## [1.2.0](https://github.com/joshjhall/google-symbols-figma-plugin/compare/v1.1.0...v1.2.0) (2025-10-26)

### Features

- add 1Password token integration to release script
- add secure token management with 1Password integration

### Bug Fixes

- remove TokenManager from plugin runtime code
- support fine-grained tokens and multiple vaults in TokenManager

### Documentation

- add comprehensive project analysis

### Maintenance

- update icon list metadata and verified icon list

## [1.1.0](https://github.com/joshjhall/google-symbols-figma-plugin/compare/v1.0.1...v1.1.0) (2025-10-26)

### Features

- make release.sh fully automated with CHANGELOG management

### Bug Fixes

- simplify regex patterns for bash compatibility
- correct grep pattern for submodule detection
- ignore submodule changes in clean directory check

### Documentation

- clarify manual release process and Pushover setup

## [1.0.1](https://github.com/joshjhall/google-symbols-figma-plugin/compare/v1.0.0...v1.0.1) (2025-10-26)

### Bug Fixes

- **ci:** correct Pushover notification secret checks in workflow ([4393784](https://github.com/joshjhall/google-symbols-figma-plugin/commit/4393784aa591ec226d0b1a9cd0f91277699fdd5a))

# 1.0.0 (2025-10-26)

### Bug Fixes

- **ci:** disable body-max-line-length in commitlint ([ae89d70](https://github.com/joshjhall/google-symbols-figma-plugin/commit/ae89d7043d2a479642d30fd0b92ea357eaba4d95))
- **deps:** upgrade vitest to v3.2.4 to match coverage package ([a521b18](https://github.com/joshjhall/google-symbols-figma-plugin/commit/a521b18815d6bbfb260dd213220893d74af25e04))
- remove deprecated Husky v9 initialization lines ([e8c13af](https://github.com/joshjhall/google-symbols-figma-plugin/commit/e8c13afb63fd1255a767741e859ea7ab849548df))
- remove unused existingCategories variable ([e6f43cb](https://github.com/joshjhall/google-symbols-figma-plugin/commit/e6f43cb16a7531b5b076d752381af56267a478c8))
- resolve TypeScript errors and improve type safety ([588a868](https://github.com/joshjhall/google-symbols-figma-plugin/commit/588a868837bfd517a356c3c90828abd68bb1370d))
- **security:** remove hardcoded GitHub token from source code ([7a5efb7](https://github.com/joshjhall/google-symbols-figma-plugin/commit/7a5efb7ba1e8bd9c9265cc9e8fec4a6c9b98b598))
- **test:** adjust coverage exclusions to focus on unit-testable code ([e911035](https://github.com/joshjhall/google-symbols-figma-plugin/commit/e9110357f62bc381830a1209f9fc00fc9bf11591))
- **test:** make elapsed time test more resilient to CI timing ([e9e50c9](https://github.com/joshjhall/google-symbols-figma-plugin/commit/e9e50c93126ef677c8f899b80c360ae03a746f66))

### Features

- add Figma plugin source code ([fcda211](https://github.com/joshjhall/google-symbols-figma-plugin/commit/fcda2113dc830b946a7fa2b35484ca1bab9f98e4))
- **devcontainer:** add 1Password integration support ([84b246d](https://github.com/joshjhall/google-symbols-figma-plugin/commit/84b246db62ee9c0c8275561e4f1d5c7d756d4dba))

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - TBD

### Added

- Initial release of Google Material Symbols Figma Plugin
- Support for 4000+ Material Symbol icons
- Variable font rendering with ligatures
- Full customization: Weight, Grade, Optical Size, Fill
- Smart category-based organization
- Incremental update system with cumulative change tracking
- Automated weekly icon updates via GitHub Actions
- Comprehensive test suite
- CI/CD pipeline with semantic versioning
- Development environment with DevContainer support

### Features

- Icon generation from Google's Material Design Icons repository
- Intelligent diffing preserves user customizations
- Batch processing for performance optimization
- Rate limiting with automatic retry logic
- GitHub API integration for icon metadata
- Category mapping for better organization

### Documentation

- Complete installation and usage guides
- Architecture overview
- Contributing guidelines
- Development setup instructions

---

**Note:** This changelog will be automatically updated by semantic-release based on conventional commits.
