/**
 * @module @figma/utils/hash
 *
 * Simple hashing utilities for content comparison.
 * Uses a simple DJB2 hash since crypto is not available in Figma environment.
 */

/**
 * Generate a simple hash for SVG content comparison.
 * Uses DJB2 algorithm which is fast and sufficient for our needs.
 *
 * @param content - The content to hash
 * @returns Hash string
 */
export function hashContent(content: string): string {
  let hash = 5381;

  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) + hash + char; // hash * 33 + char
    hash = hash & hash; // Convert to 32bit integer
  }

  return Math.abs(hash).toString(36);
}

/**
 * Normalize SVG content for consistent hashing.
 * Removes whitespace variations and comments.
 *
 * @param svgContent - Raw SVG content
 * @returns Normalized SVG content
 */
export function normalizeSvg(svgContent: string): string {
  return (
    svgContent
      // Remove comments
      .replace(/<!--[\s\S]*?-->/g, '')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      // Remove whitespace around tags
      .replace(/>\s+</g, '><')
      // Trim
      .trim()
  );
}

/**
 * Generate a hash for SVG content.
 * Normalizes the SVG before hashing for consistent comparison.
 *
 * @param svgContent - SVG content to hash
 * @returns Hash string
 */
export function hashSvg(svgContent: string): string {
  const normalized = normalizeSvg(svgContent);
  return hashContent(normalized);
}
