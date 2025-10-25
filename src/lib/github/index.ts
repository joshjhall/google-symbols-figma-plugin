/**
 * @module @figma/github
 *
 * GitHub integration utilities for fetching Material Icons.
 */

export {
  generateFilename,
  generateGitHubUrl,
  generateAllVariants,
  generateCommonVariants,
  setGitHubRef,
  getGitHubRef,
  type IconStyle,
  type IconVariant,
} from './url-generator';

export {
  GitHubIconAPI,
  githubIconAPI,
  type IconMetadata,
  type CategoryMetadata,
  type GitHubAPIConfig,
} from './api';
