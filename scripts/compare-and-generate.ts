#!/usr/bin/env tsx
/**
 * COMBINED: Compare Icon Changes + Generate Categories
 *
 * This script combines the comparison and category generation into one step:
 * 1. Detects if commit SHA changed
 * 2. If changed, generates comparison delta (cumulative)
 * 3. Generates/updates categories
 *
 * This enables CI/CD automation and handles skipped versions.
 *
 * Usage:
 *   tsx scripts/compare-and-generate.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface IconChangeDelta {
  oldCommit: string;
  newCommit: string;
  changedIcons: string[];
  newIcons: string[];
  deletedIcons: string[];
  timestamp: string;
}

interface SetRename {
  oldName: string;
  newName: string;
  setNumber: number; // e.g., 26 from "Set 26: ..."
}

interface CumulativeChanges {
  // Direct comparisons: "sha1->sha2"
  direct: Record<string, IconChangeDelta>;

  // All commits we've seen (for path finding)
  commits: string[];

  // Set renames: "sha1->sha2" -> list of renames
  setRenames: Record<string, SetRename[]>;

  // Last updated timestamp
  lastUpdated: string;
}

async function getCommitFromGitHistory(): Promise<string | null> {
  try {
    // Get the commit SHA from the last committed version of icon-list-metadata.json
    const result = execSync('git show HEAD:packages/figma/icon-list-metadata.json', {
      encoding: 'utf-8',
      cwd: path.join(__dirname, '../../..'),
    });
    const metadata = JSON.parse(result);
    return metadata.commitSha;
  } catch {
    // File doesn't exist in git history (first commit)
    return null;
  }
}

async function getCurrentCommit(): Promise<string> {
  const metadataPath = path.join(__dirname, '..', 'src', 'lib', 'icons', 'icon-list-metadata.json');
  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
  return metadata.commitSha;
}

async function fetchIconChanges(oldCommit: string, newCommit: string): Promise<IconChangeDelta> {
  console.log(`\n🔍 Fetching changes: ${oldCommit.substring(0, 7)} → ${newCommit.substring(0, 7)}`);

  const owner = 'google';
  const repo = 'material-design-icons';
  const compareUrl = `https://api.github.com/repos/${owner}/${repo}/compare/${oldCommit}...${newCommit}`;

  const response = await fetch(compareUrl, {
    headers: {
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  // Extract icon names from changed files
  const changedIconsSet = new Set<string>();
  const newIconsSet = new Set<string>();

  for (const file of data.files || []) {
    const match = file.filename.match(/symbols\/src\/[^/]+\/([^/]+)\//);
    if (match) {
      const iconName = match[1];
      changedIconsSet.add(iconName);

      if (file.status === 'added') {
        newIconsSet.add(iconName);
      }
    }
  }

  const changedIcons = Array.from(changedIconsSet).sort();
  const newIcons = Array.from(newIconsSet).sort();

  console.log(`   ✓ Found ${changedIcons.length} changed icons (${newIcons.length} new)`);

  return {
    oldCommit,
    newCommit,
    changedIcons,
    newIcons,
    deletedIcons: [], // Hard to detect without full tree comparison
    timestamp: new Date().toISOString(),
  };
}

function loadCumulativeChanges(): CumulativeChanges {
  const cumulativePath = path.join(__dirname, '..', 'icon-changes-cumulative.json');

  if (fs.existsSync(cumulativePath)) {
    return JSON.parse(fs.readFileSync(cumulativePath, 'utf-8'));
  }

  return {
    direct: {},
    commits: [],
    setRenames: {},
    lastUpdated: new Date().toISOString(),
  };
}

function saveCumulativeChanges(cumulative: CumulativeChanges) {
  const cumulativePath = path.join(__dirname, '..', 'icon-changes-cumulative.json');
  fs.writeFileSync(cumulativePath, JSON.stringify(cumulative, null, 2));
  console.log(`✅ Saved cumulative changes to icon-changes-cumulative.json`);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getCumulativeChanges(
  cumulative: CumulativeChanges,
  fromCommit: string,
  toCommit: string
): { changedIcons: string[]; newIcons: string[] } | null {
  // Check for direct path
  const directKey = `${fromCommit}->${toCommit}`;
  if (cumulative.direct[directKey]) {
    const delta = cumulative.direct[directKey];
    return {
      changedIcons: delta.changedIcons,
      newIcons: delta.newIcons,
    };
  }

  // Try to find path through intermediate commits using BFS
  const path = findCommitPath(cumulative, fromCommit, toCommit);
  if (!path) {
    return null;
  }

  // Combine all changes along the path
  const allChangedIcons = new Set<string>();
  const allNewIcons = new Set<string>();

  for (let i = 0; i < path.length - 1; i++) {
    const key = `${path[i]}->${path[i + 1]}`;
    const delta = cumulative.direct[key];
    if (delta) {
      delta.changedIcons.forEach((icon) => allChangedIcons.add(icon));
      delta.newIcons.forEach((icon) => allNewIcons.add(icon));
    }
  }

  return {
    changedIcons: Array.from(allChangedIcons).sort(),
    newIcons: Array.from(allNewIcons).sort(),
  };
}

function findCommitPath(
  cumulative: CumulativeChanges,
  fromCommit: string,
  toCommit: string
): string[] | null {
  // BFS to find path from fromCommit to toCommit
  const queue: { commit: string; path: string[] }[] = [{ commit: fromCommit, path: [fromCommit] }];
  const visited = new Set<string>([fromCommit]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      break;
    }
    const { commit, path } = current;

    if (commit === toCommit) {
      return path;
    }

    // Find all commits reachable from current commit
    for (const key in cumulative.direct) {
      const [from, to] = key.split('->');
      if (from === commit && !visited.has(to)) {
        visited.add(to);
        queue.push({ commit: to, path: [...path, to] });
      }
    }
  }

  return null;
}

function detectSetRenames(_previousCommit: string, _currentCommit: string): SetRename[] {
  // Load previous and current category summaries from git history and current file
  const renames: SetRename[] = [];

  try {
    // Get previous categories from git
    const previousCategoriesJson = execSync(
      'git show HEAD:packages/figma/categories-summary.json',
      { encoding: 'utf-8', cwd: path.join(__dirname, '../../..') }
    );
    const previousCategories = JSON.parse(previousCategoriesJson);

    // Get current categories
    const currentCategoriesPath = path.join(__dirname, '..', 'categories-summary.json');
    const currentCategories = JSON.parse(fs.readFileSync(currentCategoriesPath, 'utf-8'));

    // Build maps by set number
    const previousByNumber = new Map<number, string>();
    const currentByNumber = new Map<number, string>();

    for (const cat of previousCategories) {
      const match = cat.name.match(/^Set (\d+):/);
      if (match) {
        previousByNumber.set(parseInt(match[1]), cat.name);
      }
    }

    for (const cat of currentCategories) {
      const match = cat.name.match(/^Set (\d+):/);
      if (match) {
        currentByNumber.set(parseInt(match[1]), cat.name);
      }
    }

    // Find renames (set number same, name different)
    for (const [setNumber, oldName] of previousByNumber.entries()) {
      const newName = currentByNumber.get(setNumber);
      if (newName && newName !== oldName) {
        renames.push({ oldName, newName, setNumber });
      }
    }

    return renames;
  } catch {
    // No previous categories or error reading - no renames
    return [];
  }
}

async function main() {
  console.log('═══════════════════════════════════════');
  console.log('COMPARE & GENERATE CATEGORIES');
  console.log('═══════════════════════════════════════\n');

  // Get previous and current commit SHAs
  const previousCommit = await getCommitFromGitHistory();
  const currentCommit = await getCurrentCommit();

  console.log(`Previous commit: ${previousCommit ? previousCommit.substring(0, 7) : 'none'}`);
  console.log(`Current commit:  ${currentCommit.substring(0, 7)}`);

  if (!previousCommit) {
    console.log('\n⚠️  No previous commit found (first run)');
    console.log('   Skipping comparison - will process all icons\n');
  } else if (previousCommit === currentCommit) {
    console.log('\n✓ Commits match - no changes detected');
    console.log('  Skipping comparison and category regeneration\n');
    return;
  } else {
    console.log('\n🔄 Commits differ - generating comparison delta...\n');

    // Load cumulative changes
    const cumulative = loadCumulativeChanges();

    // Check if we already have this comparison
    const directKey = `${previousCommit}->${currentCommit}`;
    if (cumulative.direct[directKey]) {
      console.log('✓ Comparison already exists in cumulative data');
    } else {
      // Fetch new comparison
      const delta = await fetchIconChanges(previousCommit, currentCommit);

      // Add to cumulative data
      cumulative.direct[directKey] = delta;

      // Update commits list
      if (!cumulative.commits.includes(previousCommit)) {
        cumulative.commits.push(previousCommit);
      }
      if (!cumulative.commits.includes(currentCommit)) {
        cumulative.commits.push(currentCommit);
      }

      cumulative.lastUpdated = new Date().toISOString();

      // Save cumulative data
      saveCumulativeChanges(cumulative);

      // Also save as icon-changes.json for backward compatibility
      const singleChangePath = path.join(__dirname, '..', 'icon-changes.json');
      fs.writeFileSync(
        singleChangePath,
        JSON.stringify(
          {
            oldCommit: delta.oldCommit,
            newCommit: delta.newCommit,
            changedIcons: delta.changedIcons,
            newIcons: delta.newIcons,
            deletedIcons: delta.deletedIcons,
            totalChanged: delta.changedIcons.length,
            totalIcons: JSON.parse(
              fs.readFileSync(
                path.join(__dirname, '..', 'src', 'lib', 'all-icons-data.json'),
                'utf-8'
              )
            ).length,
            timestamp: delta.timestamp,
          },
          null,
          2
        )
      );
      console.log(`✅ Saved current comparison to icon-changes.json\n`);

      // Show optimization impact
      const allIcons = JSON.parse(
        fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'all-icons-data.json'), 'utf-8')
      );
      const unchangedIcons = allIcons.length - delta.changedIcons.length;
      const variantsSkipped = unchangedIcons * 504;

      console.log('💡 Optimization Impact:');
      console.log(`   Total icons: ${allIcons.length}`);
      console.log(
        `   Changed: ${delta.changedIcons.length} (${((delta.changedIcons.length / allIcons.length) * 100).toFixed(1)}%)`
      );
      console.log(
        `   Unchanged: ${unchangedIcons} (${((unchangedIcons / allIcons.length) * 100).toFixed(1)}%)`
      );
      console.log(`   Variants to skip: ${variantsSkipped.toLocaleString()}`);
      console.log(`   Estimated time saved: ~${Math.round((unchangedIcons * 2) / 60)} minutes\n`);
    }

    // Show cumulative paths available
    console.log('📊 Cumulative Change Tracking:');
    console.log(`   Tracked commits: ${cumulative.commits.length}`);
    console.log(`   Direct comparisons: ${Object.keys(cumulative.direct).length}`);

    // Calculate total possible paths (any commit to any other commit)
    const possiblePaths = cumulative.commits.length * (cumulative.commits.length - 1);
    const availablePaths = Object.keys(cumulative.direct).length;
    console.log(`   Available paths: ${availablePaths}/${possiblePaths}\n`);
  }

  // Now run category generation
  console.log('═══════════════════════════════════════');
  console.log('GENERATING CATEGORIES');
  console.log('═══════════════════════════════════════\n');

  // Run generate-categories.ts script
  try {
    execSync('tsx scripts/generate-categories.ts', {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
    });
  } catch (error) {
    console.error('Failed to generate categories:', error);
    process.exit(1);
  }

  // Detect set renames after category generation
  if (previousCommit && previousCommit !== currentCommit) {
    console.log('\n═══════════════════════════════════════');
    console.log('DETECTING SET RENAMES');
    console.log('═══════════════════════════════════════\n');

    const renames = detectSetRenames(previousCommit, currentCommit);

    if (renames.length > 0) {
      console.log(`Found ${renames.length} set renames:\n`);
      renames.forEach((rename) => {
        console.log(`  Set ${rename.setNumber}:`);
        console.log(`    Old: ${rename.oldName}`);
        console.log(`    New: ${rename.newName}`);
      });

      // Load cumulative data (reload in case it was updated)
      const cumulative = loadCumulativeChanges();

      // Store renames
      const directKey = `${previousCommit}->${currentCommit}`;
      cumulative.setRenames[directKey] = renames;
      cumulative.lastUpdated = new Date().toISOString();

      // Save updated cumulative data
      saveCumulativeChanges(cumulative);

      console.log('\n✅ Set renames tracked in cumulative data');
      console.log('   Plugin will automatically rename pages/frames/files\n');
    } else {
      console.log('✓ No set renames detected\n');
    }
  }

  console.log('\n✅ Complete! Plugin is ready to use.\n');
  console.log('Next step: pnpm build');
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
