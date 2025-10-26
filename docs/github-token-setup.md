# GitHub Token Setup

This guide explains how to set up GitHub tokens for the Figma plugin using 1Password for secure storage.

## Overview

The plugin uses **two separate GitHub tokens** for security and least-privilege access:

| Token                   | Purpose                        | Required Scopes     | 1Password Item Name                   |
| ----------------------- | ------------------------------ | ------------------- | ------------------------------------- |
| **Release Token**       | Create releases, upload assets | `repo` (read/write) | `GitHub (Figma icon plugin releases)` |
| **Version Check Token** | Read public repo data          | (public read)       | `GitHub (Version check)`              |

---

## Step 1: Create GitHub Tokens

### Release Token

1. Go to: https://github.com/settings/personal-access-tokens/new
2. Configure:
   - **Token name**: `Figma Plugin Releases`
   - **Expiration**: 90 days (recommended)
   - **Description**: `Release automation for google-symbols-figma-plugin`
3. **Repository access**:
   - Select: **Only select repositories**
   - Choose: `joshjhall/google-symbols-figma-plugin`
4. **Repository permissions**:
   - **Contents**: `Read and write` ✅
   - **Metadata**: `Read` ✅ (auto-selected)
   - All others: Leave as "No access"
5. Click **Generate token**
6. **Copy the token immediately** (you won't see it again)

### Version Check Token

1. Go to: https://github.com/settings/personal-access-tokens/new
2. Configure:
   - **Token name**: `Figma Plugin Version Check`
   - **Expiration**: 90 days (recommended)
   - **Description**: `Read public repo data for icon version checking`
3. **Repository access**:
   - Select: **Only select repositories**
   - Choose: `google/material-design-icons` (or select "Public Repositories (read-only)")
4. **Repository permissions**:
   - **Contents**: `Read` ✅
   - **Metadata**: `Read` ✅ (auto-selected)
   - All others: Leave as "No access"
5. Click **Generate token**
6. **Copy the token immediately**

---

## Step 2: Store Tokens in 1Password

### Using 1Password Desktop

#### Release Token

1. Create new item: **Login** or **API Credential**
2. Fill in:
   - **Title**: `GitHub (Figma icon plugin releases)`
   - **Username**: `joshjhall` (your GitHub username)
   - **Credential/Password**: `ghp_your_release_token_here`
   - **Website**: `https://github.com`
3. Add to **Notes** section:

   ```
   Repository: joshjhall/google-symbols-figma-plugin
   Permissions: Contents (read/write), Metadata (read)
   Created: 2025-10-26
   Expires: [expiration-date]
   Purpose: Create releases and upload .fig files

   Used by: scripts/release.sh via gh CLI
   ```

4. Save to **Private** vault

#### Version Check Token

1. Create new item: **Login** or **API Credential**
2. Fill in:
   - **Title**: `GitHub (Version check)`
   - **Username**: `joshjhall`
   - **Credential/Password**: `ghp_your_version_check_token_here`
   - **Website**: `https://github.com`
3. Add to **Notes** section:

   ```
   Repository: google/material-design-icons (public read)
   Permissions: Contents (read), Metadata (read)
   Created: 2025-10-26
   Expires: [expiration-date]
   Purpose: Read icon list from Google's Material Design repo

   Used by: src/lib/icons/icon-list-fetcher.ts
   ```

4. Save to **Private** vault

---

## Step 3: Install 1Password CLI

### macOS

```bash
brew install --cask 1password-cli
```

### Linux

```bash
curl -sSO https://downloads.1password.com/linux/debian/amd64/stable/1password-cli-amd64-latest.deb
sudo dpkg -i 1password-cli-amd64-latest.deb
```

### Verify Installation

```bash
op --version
```

Expected output: `2.x.x` or higher

---

## Step 4: Authenticate 1Password CLI

### One-Time Setup

```bash
# Sign in to your 1Password account
op signin

# Verify you can access items
op item list --vault Private
```

### Enable Touch ID / Biometric (Recommended)

```bash
# Enable Touch ID for op CLI
op signin --raw

# Now op commands will use Touch ID for authentication
```

---

## Step 5: Test Token Access

Run the diagnostic script to verify everything is set up correctly:

```bash
pnpm tsx scripts/diagnose-tokens.ts
```

Expected output:

```
🔍 GitHub Token Diagnostic

============================================================

1️⃣  Checking 1Password CLI...
   ✓ 1Password CLI (op) is available

2️⃣  Checking tokens...

   Release Token:
   Purpose: Token for creating releases and uploading assets
   ✓ Found via: 1password
   Token: ghp_abcd...xyz
   Validating token...
   ✓ Token is valid
   Scopes: (none - fine-grained)

   Version Check Token:
   Purpose: Token for reading public repos to check icon versions
   ✓ Found via: 1password
   Token: ghp_1234...789
   Validating token...
   ✓ Token is valid
   Scopes: (none - fine-grained)

============================================================
```

---

## How It Works

### Token Priority (Automatic Fallback)

The plugin tries to load tokens in this order:

1. **1Password CLI** (Recommended)

   ```bash
   op read "op://Private/GitHub (Figma icon plugin releases)/credential"
   ```

2. **Environment Variables**

   ```bash
   export GITHUB_RELEASE_TOKEN=ghp_...
   export GITHUB_VERSION_CHECK_TOKEN=ghp_...
   ```

3. **.env File**
   ```bash
   echo "GITHUB_RELEASE_TOKEN=ghp_..." >> .env
   echo "GITHUB_VERSION_CHECK_TOKEN=ghp_..." >> .env
   ```

### Code Example

```typescript
import { TokenManager } from './config/token-manager';

// Automatically fetches from 1Password → env → .env
const releaseToken = await TokenManager.getReleaseToken();

// Validates token has correct scopes
const versionToken = await TokenManager.getVersionCheckToken();
```

---

## Usage Examples

### Creating a Release

```bash
# Token automatically loaded from 1Password
./scripts/release.sh minor
```

The release script:

1. Loads `GITHUB_RELEASE_TOKEN` from 1Password
2. Authenticates `gh` CLI
3. Creates release and uploads `.fig` files

### Checking for Icon Updates

```bash
# Token automatically loaded from 1Password
pnpm icons:update --ref=master
```

The update script:

1. Loads `GITHUB_VERSION_CHECK_TOKEN` from 1Password
2. Fetches latest icon list from Google's repo
3. Compares with current version

---

## Troubleshooting

### "op: command not found"

Install 1Password CLI (see Step 3 above).

### "Authentication required"

```bash
# Re-authenticate
op signin

# Or use service account token
export OP_SERVICE_ACCOUNT_TOKEN=ops_your_token_here
```

### "Token not found"

Check the exact item name in 1Password:

```bash
# List all items in Private vault
op item list --vault Private

# Get specific item
op item get "GitHub (Figma icon plugin releases)"
```

Make sure the item names match **exactly**:

- `GitHub (Figma icon plugin releases)` (for release token)
- `GitHub (Version check)` (for version check token)

### "Token validation failed"

The token may have expired or been revoked. Create a new token and update 1Password.

### Fallback to Environment Variables

If 1Password isn't available, you can use environment variables:

```bash
# Add to ~/.zshrc or ~/.bashrc
export GITHUB_RELEASE_TOKEN=ghp_your_release_token
export GITHUB_VERSION_CHECK_TOKEN=ghp_your_version_check_token
```

### Fallback to .env File

```bash
# Create .env file (gitignored)
cp .env.example .env

# Edit and add tokens
nano .env
```

---

## Security Best Practices

### ✅ Do

- Use fine-grained tokens (not classic PATs)
- Set expiration dates (90 days recommended)
- Store in 1Password with clear descriptions
- Use minimum required scopes
- Rotate tokens regularly
- Keep token names consistent

### ❌ Don't

- Commit tokens to git
- Share tokens via chat/email
- Use tokens with more permissions than needed
- Store tokens in plain text files
- Use the same token for multiple purposes

---

## Token Rotation

When tokens expire:

1. **Create new token** (same process as Step 1)
2. **Update 1Password item**:
   ```bash
   # Using op CLI
   op item edit "GitHub (Figma icon plugin releases)" \
     --credential=ghp_new_token_here
   ```
3. **Test new token**:
   ```bash
   # Clear cache and test
   pnpm tsx scripts/diagnose-tokens.ts
   ```
4. **Delete old token** from GitHub:
   - https://github.com/settings/tokens
   - Find old token → Delete

No code changes needed! The plugin automatically uses the updated token from 1Password.

---

## Advanced: Service Account Token

For CI/CD or shared environments, use a 1Password service account:

```bash
# Set service account token
export OP_SERVICE_ACCOUNT_TOKEN=ops_your_service_account_token

# Now op commands work without interactive login
op read "op://Private/GitHub (Figma icon plugin releases)/credential"
```

Create service account:

1. Go to: https://my.1password.com/
2. Settings → Service Accounts → New Service Account
3. Grant access to "Private" vault
4. Copy service account token

---

## Questions?

- **1Password CLI Docs**: https://developer.1password.com/docs/cli/
- **GitHub Token Docs**: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens
- **Plugin Issues**: https://github.com/joshjhall/google-symbols-figma-plugin/issues
