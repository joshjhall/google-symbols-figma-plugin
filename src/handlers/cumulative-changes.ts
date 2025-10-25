/**
 * Cumulative change tracking utilities
 *
 * Handles tracking icon changes across multiple commits, supporting:
 * - Set name transitions (Cat → Set)
 * - Set boundary shifts (icon range changes)
 * - Cumulative change detection across commit ranges
 */

import { logger } from '@lib/utils';

/**
 * Cumulative change data structure for tracking changes across multiple commits
 *
 * This data structure supports version-skipping scenarios where we need to track
 * what changed between non-consecutive commits (e.g., updating from v1.0 to v3.0
 * without processing v2.0).
 *
 * @interface CumulativeChangeData
 * @property {Record<string, object>} [direct] - Direct commit-to-commit change mappings
 *   Key format: "fromSHA->toSHA"
 *   Value: { changedIcons: string[], newIcons?: string[] }
 * @property {Record<string, Array>} [setRenames] - Set name changes across commits
 *   Key format: "fromSHA->toSHA"
 *   Value: Array of {setNumber, oldName, newName}
 *
 * @example
 * ```typescript
 * const cumulativeData: CumulativeChangeData = {
 *   direct: {
 *     "abc123->def456": {
 *       changedIcons: ["home", "search"],
 *       newIcons: ["new_icon"]
 *     }
 *   },
 *   setRenames: {
 *     "abc123->def456": [{
 *       setNumber: 1,
 *       oldName: "Set 1: aaa-bbb",
 *       newName: "Set 1: aaa-ccc"
 *     }]
 *   }
 * };
 * ```
 */
export interface CumulativeChangeData {
  direct?: Record<
    string,
    {
      changedIcons: string[];
      newIcons?: string[];
    }
  >;
  setRenames?: Record<
    string,
    Array<{
      setNumber: number;
      oldName: string;
      newName: string;
    }>
  >;
}

/**
 * Get the final set name for a given set number across multiple commits
 * Handles cumulative renames: Set 26: xxx-yyy → Set 26: xxx-zzz → Set 26: xxx-aaa
 *
 * @param setNumber - The set number to track
 * @param oldSetName - The starting set name
 * @param fromCommit - The starting commit SHA
 * @param toCommit - The target commit SHA
 * @param cumulativeData - The cumulative change tracking data
 * @returns The final set name after all renames
 */
export function getFinalSetName(
  setNumber: number,
  oldSetName: string,
  fromCommit: string,
  toCommit: string,
  cumulativeData: CumulativeChangeData | null
): string {
  if (!cumulativeData || !cumulativeData.setRenames) {
    return oldSetName; // No rename data
  }

  // Find path from fromCommit to toCommit using BFS
  const visited = new Set<string>([fromCommit]);
  const queue: { commit: string; currentName: string }[] = [
    { commit: fromCommit, currentName: oldSetName },
  ];

  while (queue.length > 0) {
    const item = queue.shift();
    if (!item) break;

    const { commit, currentName } = item;

    if (commit === toCommit) {
      // Found path - return the final name
      return currentName;
    }

    // Find all commits reachable from current commit
    for (const key in cumulativeData.setRenames) {
      const [from, to] = key.split('->');
      if (from === commit && !visited.has(to)) {
        visited.add(to);

        // Check if this set was renamed in this transition
        const renames = cumulativeData.setRenames[key];
        const rename = renames.find((r) => r.setNumber === setNumber && r.oldName === currentName);

        const nextName = rename ? rename.newName : currentName;
        queue.push({ commit: to, currentName: nextName });
      }
    }
  }

  // No path found - return original name
  return oldSetName;
}

/**
 * Check if an icon has changed between two commits using cumulative data
 * Supports both direct comparisons and paths through intermediate commits
 *
 * @param iconName - The icon to check
 * @param fromCommit - The starting commit SHA
 * @param toCommit - The target commit SHA
 * @param iconChangesData - Direct change data (single commit transition)
 * @param cumulativeData - Cumulative change data (multi-commit transitions)
 * @returns true if the icon has changed, false if unchanged
 */
export function hasIconChangedCumulatively(
  iconName: string,
  fromCommit: string,
  toCommit: string,
  iconChangesData: { changedIcons?: string[]; newIcons?: string[] } | null,
  cumulativeData: CumulativeChangeData | null
): boolean {
  // If no cumulative data, fall back to direct comparison
  if (!cumulativeData || !cumulativeData.direct) {
    if (iconChangesData && iconChangesData.changedIcons) {
      return iconChangesData.changedIcons.includes(iconName);
    }
    return true; // Unknown - assume changed
  }

  // Check direct path first
  const directKey = `${fromCommit}->${toCommit}`;
  if (cumulativeData.direct[directKey]) {
    return cumulativeData.direct[directKey].changedIcons.includes(iconName);
  }

  // Find path through cumulative data using BFS
  const visited = new Set<string>([fromCommit]);
  const queue: { commit: string; changedInPath: Set<string> }[] = [
    { commit: fromCommit, changedInPath: new Set<string>() },
  ];

  while (queue.length > 0) {
    const item = queue.shift();
    if (!item) break;

    const { commit, changedInPath } = item;

    if (commit === toCommit) {
      // Found path - check if icon changed along the way
      return changedInPath.has(iconName);
    }

    // Find all commits reachable from current commit
    for (const key in cumulativeData.direct) {
      const [from, to] = key.split('->');
      if (from === commit && !visited.has(to)) {
        visited.add(to);
        const delta = cumulativeData.direct[key];
        const newChangedInPath = new Set(changedInPath);
        delta.changedIcons.forEach((icon: string) => newChangedInPath.add(icon));
        queue.push({ commit: to, changedInPath: newChangedInPath });
      }
    }
  }

  // No path found - assume changed to be safe
  return true;
}

/**
 * Log cumulative change tracking status
 */
export function logCumulativeChangeStatus(
  iconChangesData: {
    changedIcons?: string[];
    newIcons?: string[];
    oldCommit?: string;
    newCommit?: string;
    totalIcons?: number;
  } | null,
  iconChangesCumulative: CumulativeChangeData | null
): void {
  if (iconChangesData && iconChangesData.changedIcons) {
    logger.info(
      `Icon changes detected: ${iconChangesData.changedIcons.length} changed, ${iconChangesData.newIcons?.length || 0} new`
    );
    const totalIcons = (iconChangesData as { totalIcons?: number }).totalIcons || 0;
    const unchangedCount = totalIcons - iconChangesData.changedIcons.length;
    if (unchangedCount > 0) {
      logger.info(
        `Optimization: Will only update changed icons, update commit SHA for ${unchangedCount} unchanged icons`
      );
    }
  }

  if (iconChangesCumulative) {
    const directComparisons = Object.keys(iconChangesCumulative.direct || {}).length;
    logger.info(`Cumulative change tracking enabled: ${directComparisons} comparisons available`);
  }
}
