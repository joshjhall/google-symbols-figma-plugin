#!/usr/bin/env tsx
/**
 * PHASE 1: Fetch Icon List (SINGLE SOURCE OF TRUTH)
 *
 * Updates the Material Symbols icon list based on what's actually in the GitHub repo.
 *
 * This script:
 * 1. Fetches ALL icon directory names from the Material Design Icons repo (symbols/web)
 * 2. Validates that each icon has at least one SVG file in the repo (optional)
 * 3. Writes the validated icon list to:
 *    - all-icons.txt (for reference)
 *    - src/lib/all-icons-data.json (for runtime usage)
 *
 * This is the ONLY script that should fetch icons from GitHub.
 * Other scripts should read from all-icons-data.json.
 *
 * Usage:
 *   tsx scripts/update-icon-list.ts [--ref=master|4.0.0] [--skip-verify]
 */

import * as fs from 'fs';
import * as path from 'path';
import { GitHubIconAPI } from '../src/lib/github/api';
import { setGitHubRef } from '../src/lib/github/url-generator';

// Configuration
const DEFAULT_REF = 'master'; // Could be 'master', 'main', or a tag like '4.0.0'

/**
 * Main execution
 */
async function main() {
  // Parse command line args
  const args = process.argv.slice(2);
  const refArg = args.find(arg => arg.startsWith('--ref='));
  const ref = refArg ? refArg.split('=')[1] : DEFAULT_REF;
  const skipVerify = args.includes('--skip-verify');

  console.log('=====================================');
  console.log('Material Symbols Icon List Updater');
  console.log('=====================================');
  console.log(`Using ref: ${ref}`);
  console.log(`Skip verification: ${skipVerify}`);
  console.log('');

  try {
    // Initialize API with the specified ref
    const api = new GitHubIconAPI({ ref });

    // Also update the URL generator to use this ref
    setGitHubRef(ref);

    // Fetch the current commit SHA for this ref
    console.log('Fetching commit SHA from GitHub...');
    const commitSha = await api.fetchCurrentCommitSha();
    console.log(`✅ Using commit: ${commitSha.substring(0, 7)} (${commitSha})\n`);

    // Step 1: Fetch ALL icons from the repo directly (symbols/web directories)
    console.log('Fetching icon list from GitHub repo (symbols/web directories)...');
    console.log('This is the source of truth for what actually exists.\n');

    const GITHUB_API = 'https://api.github.com/repos/google/material-design-icons';
    const treeResponse = await fetch(`${GITHUB_API}/git/trees/${ref}:symbols/web`);

    if (!treeResponse.ok) {
      throw new Error(`Failed to fetch tree: ${treeResponse.status} ${treeResponse.statusText}`);
    }

    interface GitTreeItem {
      path: string;
      type: 'blob' | 'tree';
    }

    interface GitTree {
      tree: GitTreeItem[];
      truncated: boolean;
    }

    const treeData: GitTree = await treeResponse.json();

    if (treeData.truncated) {
      console.warn('⚠️  WARNING: Tree was truncated by GitHub. Results may be incomplete.');
    }

    // Filter to only directories
    const allIcons = treeData.tree
      .filter(item => item.type === 'tree')
      .map(item => item.path)
      .sort();

    console.log(`✅ Found ${allIcons.length} icon directories in repo`);
    console.log(`   Truncated: ${treeData.truncated ? 'YES ⚠️' : 'NO'}\n`);

    let validIcons: string[] = [];
    let invalidIcons: string[] = [];

    if (skipVerify) {
      console.log('\n⚠️  Skipping SVG verification (--skip-verify flag)');
      console.log('Using all icons from codepoints without validation');
      validIcons = allIcons;
    } else {
      // Step 2: Verify each icon has at least one SVG
      console.log('\nVerifying icons against repo...');
      console.log('This will take several minutes for 3900+ icons...\n');

      const testResults = await api.batchTestIcons(allIcons, 'rounded');

      // Separate valid and invalid
      for (const [iconName, exists] of testResults) {
        if (exists) {
          validIcons.push(iconName);
        } else {
          invalidIcons.push(iconName);
        }
      }

      validIcons.sort();
      invalidIcons.sort();

      console.log(`\n✅ Verified: ${validIcons.length} icons have SVG files`);

      if (invalidIcons.length > 0) {
        console.log(`⚠️  Invalid: ${invalidIcons.length} icons have no SVG files`);
        console.log(`\nSample invalid icons (first 20):`);
        invalidIcons.slice(0, 20).forEach(icon => console.log(`  - ${icon}`));
        if (invalidIcons.length > 20) {
          console.log(`  ... and ${invalidIcons.length - 20} more`);
        }
      }
    }

    // Step 3: Write results to files
    const outputDir = process.cwd();

    // Write valid icons list (text file)
    const allIconsPath = path.join(outputDir, 'all-icons.txt');
    fs.writeFileSync(allIconsPath, validIcons.join('\n') + '\n');
    console.log(`\n✅ Written ${validIcons.length} icons to: all-icons.txt`);

    // Write valid icons list (JSON file for runtime usage)
    const allIconsJsonPath = path.join(outputDir, 'src', 'lib', 'icons', 'all-icons-data.json');
    fs.writeFileSync(allIconsJsonPath, JSON.stringify(validIcons, null, 2) + '\n');
    console.log(`✅ Written ${validIcons.length} icons to: src/lib/icons/all-icons-data.json`);

    // Write invalid icons list (if any)
    if (invalidIcons.length > 0) {
      const invalidIconsPath = path.join(outputDir, 'invalid-icons.txt');
      fs.writeFileSync(invalidIconsPath, invalidIcons.join('\n') + '\n');
      console.log(`✅ Written ${invalidIcons.length} invalid icons to: invalid-icons.txt`);
    }

    // Write metadata
    const metadataPath = path.join(outputDir, 'src', 'lib', 'icons', 'icon-list-metadata.json');
    const metadata = {
      generatedAt: new Date().toISOString(),
      ref: ref,
      commitSha: commitSha,
      source: 'repo-directories',  // Changed from codepoints
      totalIconDirectories: allIcons.length,
      validIcons: validIcons.length,
      invalidIcons: invalidIcons.length,
      skipVerify: skipVerify,
      successRate: skipVerify ? 'N/A' : `${Math.round((validIcons.length / allIcons.length) * 100)}%`
    };
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2) + '\n');
    console.log(`✅ Written metadata to: src/lib/icons/icon-list-metadata.json`);
    console.log(`   Commit SHA: ${commitSha.substring(0, 7)}`);

    console.log('\n✅ Icon list update complete!');

    if (!skipVerify) {
      console.log(`\nSuccess rate: ${metadata.successRate} of icon directories have SVG files`);
    }

    if (invalidIcons.length > 0) {
      console.log('\n⚠️  WARNING: Some icon directories have no valid SVG files.');
      console.log('These icons have been excluded from all-icons.txt.');
      console.log('See invalid-icons.txt for the complete list.');
      console.log('\nNext steps:');
      console.log('1. Review invalid-icons.txt to understand which icons have no SVGs');
      console.log('2. Update category-mapping.json to remove any invalid icons from categories');
      console.log('3. Commit the updated all-icons.txt and category-mapping.json');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    if (error instanceof Error) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

main();
