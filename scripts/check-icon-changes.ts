#!/usr/bin/env tsx
/**
 * PHASE 1.5: Check Icon Changes Between Commits
 *
 * Compares two git commits to identify which icons actually changed.
 * This avoids re-downloading all icons when only a subset changed.
 *
 * Usage:
 *   tsx scripts/check-icon-changes.ts <old-commit> <new-commit>
 *   tsx scripts/check-icon-changes.ts HEAD~1 HEAD
 *
 * Output: icon-changes.json
 * {
 *   "oldCommit": "abc123...",
 *   "newCommit": "def456...",
 *   "changedIcons": ["alarm", "home", ...],
 *   "newIcons": ["new_icon_name"],
 *   "deletedIcons": ["old_icon_name"],
 *   "totalChanged": 150,
 *   "totalIcons": 3933
 * }
 */

import * as fs from 'fs';
import * as path from 'path';

interface IconChanges {
  oldCommit: string;
  newCommit: string;
  changedIcons: string[];
  newIcons: string[];
  deletedIcons: string[];
  totalChanged: number;
  totalIcons: number;
  timestamp: string;
}

async function checkIconChanges(oldCommit: string, newCommit: string): Promise<IconChanges> {
  console.log('🔍 Checking for icon changes between commits...\n');
  console.log(`Old commit: ${oldCommit}`);
  console.log(`New commit: ${newCommit}\n`);

  // GitHub API endpoint for comparing commits
  const owner = 'google';
  const repo = 'material-design-icons';
  const compareUrl = `https://api.github.com/repos/${owner}/${repo}/compare/${oldCommit}...${newCommit}`;

  console.log(`Fetching changes from GitHub API...`);
  console.log(`URL: ${compareUrl}\n`);

  try {
    const response = await fetch(compareUrl, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        // Optional: Add GitHub token for higher rate limits
        // 'Authorization': `token ${process.env.GITHUB_TOKEN}`
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    console.log(`✓ Found ${data.files?.length || 0} changed files\n`);

    // Extract icon names from changed file paths
    const changedIconsSet = new Set<string>();
    const filesByStatus = {
      added: [] as string[],
      modified: [] as string[],
      removed: [] as string[]
    };

    for (const file of data.files || []) {
      // File paths look like: symbols/src/rounded/alarm/materialsymbolsrounded-alarm-20px.svg
      // We want to extract the icon name (e.g., "alarm")
      const match = file.filename.match(/symbols\/src\/[^/]+\/([^/]+)\//);
      if (match) {
        const iconName = match[1];
        changedIconsSet.add(iconName);

        if (file.status === 'added') {
          filesByStatus.added.push(file.filename);
        } else if (file.status === 'modified') {
          filesByStatus.modified.push(file.filename);
        } else if (file.status === 'removed') {
          filesByStatus.removed.push(file.filename);
        }
      }
    }

    const changedIcons = Array.from(changedIconsSet).sort();

    // Load current icon list to determine new/deleted icons
    const allIconsPath = path.join(__dirname, '..', 'src', 'lib', 'all-icons-data.json');
    const allIcons: string[] = JSON.parse(fs.readFileSync(allIconsPath, 'utf-8'));

    // Determine which are truly new icons (not in current list)
    const newIcons = changedIcons.filter(icon => !allIcons.includes(icon));

    // Note: We can't easily detect deleted icons from GitHub compare alone
    // since they won't show up in the new commit's file tree
    // Would need to compare full file trees between commits
    const deletedIcons: string[] = [];

    const result: IconChanges = {
      oldCommit,
      newCommit,
      changedIcons,
      newIcons,
      deletedIcons,
      totalChanged: changedIcons.length,
      totalIcons: allIcons.length,
      timestamp: new Date().toISOString()
    };

    // Display summary
    console.log('═══════════════════════════════════════');
    console.log('ICON CHANGE SUMMARY');
    console.log('═══════════════════════════════════════');
    console.log(`Total icons in repo: ${allIcons.length}`);
    console.log(`Changed icons: ${changedIcons.length} (${((changedIcons.length / allIcons.length) * 100).toFixed(1)}%)`);
    console.log(`New icons: ${newIcons.length}`);
    console.log(`Files changed: ${data.files?.length || 0}`);
    console.log(`  - Added: ${filesByStatus.added.length}`);
    console.log(`  - Modified: ${filesByStatus.modified.length}`);
    console.log(`  - Removed: ${filesByStatus.removed.length}`);
    console.log('═══════════════════════════════════════\n');

    if (changedIcons.length > 0) {
      console.log('Changed icons:');
      changedIcons.slice(0, 20).forEach(icon => console.log(`  - ${icon}`));
      if (changedIcons.length > 20) {
        console.log(`  ... and ${changedIcons.length - 20} more\n`);
      }
    }

    if (newIcons.length > 0) {
      console.log('\nNew icons:');
      newIcons.forEach(icon => console.log(`  + ${icon}`));
    }

    // Save to file
    const outputPath = path.join(__dirname, '..', 'icon-changes.json');
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(`\n✅ Icon changes saved to icon-changes.json`);

    // Calculate potential time savings
    const unchangedIcons = allIcons.length - changedIcons.length;
    const variantsSkipped = unchangedIcons * 504;
    console.log('\n💡 Optimization Impact:');
    console.log(`   Unchanged icons: ${unchangedIcons}`);
    console.log(`   Variants to skip: ${variantsSkipped.toLocaleString()}`);
    console.log(`   Estimated time saved: ~${Math.round(unchangedIcons * 2 / 60)} minutes`);

    return result;

  } catch (error) {
    console.error('Error checking icon changes:', error);
    throw error;
  }
}

// CLI usage
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: tsx scripts/check-icon-changes.ts <old-commit> <new-commit>');
  console.error('Example: tsx scripts/check-icon-changes.ts abc123 def456');
  process.exit(1);
}

const [oldCommit, newCommit] = args;
checkIconChanges(oldCommit, newCommit).catch(error => {
  console.error('Failed:', error);
  process.exit(1);
});
