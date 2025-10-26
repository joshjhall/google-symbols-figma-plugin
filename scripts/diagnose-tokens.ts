#!/usr/bin/env tsx
/**
 * Diagnostic script to check token configuration
 *
 * Usage:
 *   pnpm tsx scripts/diagnose-tokens.ts
 */

import { TokenManager, TOKEN_CONFIGS } from '../src/lib/config/token-manager';

async function main() {
  console.log('🔍 GitHub Token Diagnostic\n');
  console.log('='.repeat(60));

  // Check 1Password availability
  console.log('\n1️⃣  Checking 1Password CLI...');
  const opAvailable = await TokenManager.checkOnePasswordAvailable();

  if (opAvailable) {
    console.log('   ✓ 1Password CLI (op) is available');
  } else {
    console.log('   ✗ 1Password CLI (op) not found');
    console.log('   Install: https://developer.1password.com/docs/cli/get-started/');
  }

  // Check each token
  console.log('\n2️⃣  Checking tokens...\n');

  for (const [type, config] of Object.entries(TOKEN_CONFIGS)) {
    console.log(`   ${config.name}:`);
    console.log(`   Purpose: ${config.description}`);

    try {
      const result = await TokenManager.getToken(type as keyof typeof TOKEN_CONFIGS);
      console.log(`   ✓ Found via: ${result.source}`);
      console.log(`   Token: ${result.token.slice(0, 8)}...${result.token.slice(-4)}`);

      // Validate token
      console.log(`   Validating token...`);
      const validation = await TokenManager.validateToken(result.token, []);

      if (validation.valid) {
        console.log(`   ✓ Token is valid`);
        console.log(`   Scopes: ${validation.scopes.join(', ') || '(none - fine-grained)'}`);
      } else {
        console.log(`   ✗ Token validation failed: ${validation.error}`);
      }
    } catch (error) {
      console.log(`   ✗ Not found`);
      console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
    }

    console.log();
  }

  // Summary
  console.log('='.repeat(60));
  console.log('\n3️⃣  Configuration Priority:\n');
  console.log('   1. 1Password: op://Private/<item-name>/credential');
  console.log('   2. Environment: $GITHUB_RELEASE_TOKEN, $GITHUB_VERSION_CHECK_TOKEN');
  console.log('   3. .env file: GITHUB_RELEASE_TOKEN=..., GITHUB_VERSION_CHECK_TOKEN=...');

  console.log('\n4️⃣  1Password Vault Items:\n');
  console.log('   Release Token:');
  console.log('     Item: "GitHub (Figma icon plugin releases)"');
  console.log('     Path: op://Private/GitHub (Figma icon plugin releases)/credential');
  console.log('     Scopes: repo (read/write)');
  console.log();
  console.log('   Version Check Token:');
  console.log('     Item: "GitHub (Version check)"');
  console.log('     Path: op://Private/GitHub (Version check)/credential');
  console.log('     Scopes: (public read)');

  console.log('\n✓ Diagnostic complete\n');
}

main().catch((error) => {
  console.error('\n❌ Diagnostic failed:', error);
  process.exit(1);
});
