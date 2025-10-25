# DevContainer Setup

This development container provides a consistent development environment for the Google Material Symbols Figma Plugin.

## Prerequisites

1. **Install Docker Desktop** (or Docker Engine + Docker Compose)
2. **Install VS Code** with the "Dev Containers" extension
3. **Clone the containers submodule** (if using submodule approach):
   ```bash
   git submodule update --init --recursive
   ```

## Quick Start

1. Open this repository in VS Code
2. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
3. Select "Dev Containers: Reopen in Container"
4. Wait for the container to build and start
5. Dependencies will be installed automatically via `pnpm install`

## Container Features

- **Node.js 18+** with pnpm package manager
- **Git** pre-configured
- **GitHub CLI** for interacting with GitHub
- **VS Code Extensions** automatically installed:
  - ESLint
  - Prettier
  - Figma VS Code extension
  - TypeScript support
  - Vitest test explorer

## Dockerfile Location

The Dockerfile is referenced from the `containers` submodule (or local path).

**To use a submodule:**
1. Add the containers repo as a submodule:
   ```bash
   git submodule add https://github.com/your-org/containers.git containers
   ```

2. Update the `docker-compose.yml` to point to the correct Dockerfile:
   ```yaml
   build:
     context: ../containers
     dockerfile: Dockerfile
   ```

**To use a local Dockerfile:**
1. Create `Dockerfile` in `.devcontainer/`
2. Update `docker-compose.yml`:
   ```yaml
   build:
     context: .
     dockerfile: Dockerfile
   ```

## Customization

Edit `.devcontainer/devcontainer.json` to:
- Add more VS Code extensions
- Modify settings
- Change post-create commands
- Add additional features

## Troubleshooting

### Container won't build
- Check Docker is running
- Verify the Dockerfile path in `docker-compose.yml`
- Try rebuilding: `Dev Containers: Rebuild Container`

### Dependencies not installing
- Check pnpm version compatibility
- Manually run `pnpm install` in the terminal

### Git/SSH issues
- Ensure your SSH keys are in `~/.ssh/`
- Check the volume mounts in `docker-compose.yml`
