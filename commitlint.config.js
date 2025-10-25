/**
 * Commitlint configuration for conventional commits
 *
 * Enforces commit message format:
 * type(scope?): subject
 *
 * Examples:
 * - feat: add icon search functionality
 * - fix(icons): correct variant generation
 * - docs: update README with installation steps
 * - chore(deps): update dependencies
 */

export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // New feature
        'fix',      // Bug fix
        'docs',     // Documentation changes
        'style',    // Code style changes (formatting, etc.)
        'refactor', // Code refactoring
        'perf',     // Performance improvements
        'test',     // Test changes
        'build',    // Build system changes
        'ci',       // CI/CD changes
        'chore',    // Other changes (deps, config, etc.)
        'revert',   // Revert a previous commit
      ],
    ],
    'subject-case': [2, 'never', ['upper-case']],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'type-case': [2, 'always', 'lower-case'],
    'type-empty': [2, 'never'],
  },
};
