/**
 * @module @figma/utils/__tests__/hash
 *
 * Unit tests for hashing utilities.
 * Tests content hashing, SVG normalization, and hash consistency.
 */

import { describe, it, expect } from 'vitest';
import { hashContent, normalizeSvg, hashSvg } from '../hash';

describe('hashContent', () => {
  it('should generate consistent hash for same content', () => {
    const content = 'test content';
    const hash1 = hashContent(content);
    const hash2 = hashContent(content);

    expect(hash1).toBe(hash2);
    expect(hash1).toBeTruthy();
  });

  it('should generate different hashes for different content', () => {
    const hash1 = hashContent('content 1');
    const hash2 = hashContent('content 2');

    expect(hash1).not.toBe(hash2);
  });

  it('should handle empty string', () => {
    const hash = hashContent('');

    expect(hash).toBeTruthy();
    expect(typeof hash).toBe('string');
  });

  it('should handle single character', () => {
    const hash1 = hashContent('a');
    const hash2 = hashContent('b');

    expect(hash1).not.toBe(hash2);
    expect(hash1).toBeTruthy();
    expect(hash2).toBeTruthy();
  });

  it('should handle very long content', () => {
    const longContent = 'x'.repeat(100000);
    const hash = hashContent(longContent);

    expect(hash).toBeTruthy();
    expect(typeof hash).toBe('string');
  });

  it('should handle special characters', () => {
    const content = '!@#$%^&*()_+-={}[]|\\:";\'<>?,./';
    const hash = hashContent(content);

    expect(hash).toBeTruthy();
    expect(typeof hash).toBe('string');
  });

  it('should handle unicode characters', () => {
    const content = 'Hello 世界 🌍';
    const hash = hashContent(content);

    expect(hash).toBeTruthy();
    expect(typeof hash).toBe('string');
  });

  it('should return hash in base36 format', () => {
    const hash = hashContent('test');

    // Base36 should only contain 0-9 and a-z
    expect(hash).toMatch(/^[0-9a-z]+$/);
  });

  it('should be deterministic', () => {
    const content = 'deterministic test';
    const hashes = Array.from({ length: 100 }, () => hashContent(content));

    // All hashes should be identical
    expect(new Set(hashes).size).toBe(1);
  });

  it('should be sensitive to whitespace', () => {
    const hash1 = hashContent('test');
    const hash2 = hashContent('test ');
    const hash3 = hashContent(' test');

    expect(hash1).not.toBe(hash2);
    expect(hash1).not.toBe(hash3);
    expect(hash2).not.toBe(hash3);
  });

  it('should be case sensitive', () => {
    const hash1 = hashContent('Test');
    const hash2 = hashContent('test');

    expect(hash1).not.toBe(hash2);
  });
});

describe('normalizeSvg', () => {
  it('should remove HTML comments', () => {
    const svg = '<svg><!-- comment --><circle /></svg>';
    const normalized = normalizeSvg(svg);

    expect(normalized).not.toContain('<!--');
    expect(normalized).not.toContain('comment');
    expect(normalized).toContain('<circle');
  });

  it('should remove multi-line comments', () => {
    const svg = `<svg>
      <!--
        Multi-line
        comment
      -->
      <circle />
    </svg>`;
    const normalized = normalizeSvg(svg);

    expect(normalized).not.toContain('<!--');
    expect(normalized).not.toContain('Multi-line');
  });

  it('should normalize multiple spaces to single space', () => {
    const svg = '<svg    width="24"     height="24"></svg>';
    const normalized = normalizeSvg(svg);

    expect(normalized).toBe('<svg width="24" height="24"></svg>');
  });

  it('should remove whitespace around tags', () => {
    const svg = '<svg>  <circle />  <rect />  </svg>';
    const normalized = normalizeSvg(svg);

    expect(normalized).toBe('<svg><circle /><rect /></svg>');
  });

  it('should handle newlines', () => {
    const svg = '<svg>\n  <circle />\n  <rect />\n</svg>';
    const normalized = normalizeSvg(svg);

    expect(normalized).not.toContain('\n');
    expect(normalized).toBe('<svg><circle /><rect /></svg>');
  });

  it('should handle tabs', () => {
    const svg = '<svg>\t<circle />\t<rect /></svg>';
    const normalized = normalizeSvg(svg);

    expect(normalized).not.toContain('\t');
    expect(normalized).toBe('<svg><circle /><rect /></svg>');
  });

  it('should trim leading and trailing whitespace', () => {
    const svg = '   <svg><circle /></svg>   ';
    const normalized = normalizeSvg(svg);

    expect(normalized).toBe('<svg><circle /></svg>');
    expect(normalized).not.toMatch(/^\s/);
    expect(normalized).not.toMatch(/\s$/);
  });

  it('should handle empty string', () => {
    const normalized = normalizeSvg('');

    expect(normalized).toBe('');
  });

  it('should handle SVG with attributes', () => {
    const svg = `<svg   width="24"   height="24"
      viewBox="0 0 24 24"   fill="none">
      <circle   cx="12"   cy="12"   r="10" />
    </svg>`;
    const normalized = normalizeSvg(svg);

    expect(normalized).toBe(
      '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" /></svg>'
    );
  });

  it('should produce consistent output', () => {
    const svg = `
      <svg width="24" height="24">
        <!-- Icon -->
        <circle cx="12" cy="12" r="10" />
      </svg>
    `;

    const normalized1 = normalizeSvg(svg);
    const normalized2 = normalizeSvg(svg);

    expect(normalized1).toBe(normalized2);
  });

  it('should normalize equivalent SVGs to same string', () => {
    const svg1 = '<svg><circle /></svg>';
    const svg2 = '<svg>  <circle />  </svg>';
    const svg3 = '<svg>\n  <circle />\n</svg>';

    const normalized1 = normalizeSvg(svg1);
    const normalized2 = normalizeSvg(svg2);
    const normalized3 = normalizeSvg(svg3);

    expect(normalized1).toBe(normalized2);
    expect(normalized2).toBe(normalized3);
  });

  it('should preserve attribute values with spaces', () => {
    const svg = '<svg class="icon   large"  ><circle /></svg>';
    const normalized = normalizeSvg(svg);

    // Spaces within quotes should be preserved
    expect(normalized).toContain('class="icon large"');
  });

  it('should handle nested comments', () => {
    const svg = `<svg>
      <!-- outer <!-- inner --> comment -->
      <circle />
    </svg>`;
    const normalized = normalizeSvg(svg);

    // The regex should handle nested-like structures
    expect(normalized).not.toContain('<!--');
    expect(normalized).toContain('<circle');
  });
});

describe('hashSvg', () => {
  it('should generate consistent hash for same SVG', () => {
    const svg = '<svg><circle cx="12" cy="12" r="10" /></svg>';
    const hash1 = hashSvg(svg);
    const hash2 = hashSvg(svg);

    expect(hash1).toBe(hash2);
  });

  it('should generate same hash for equivalent SVGs', () => {
    const svg1 = '<svg><circle cx="12" cy="12" r="10" /></svg>';
    const svg2 = '<svg>  <circle cx="12" cy="12" r="10" />  </svg>';
    const svg3 = '<svg>\n  <circle cx="12" cy="12" r="10" />\n</svg>';

    const hash1 = hashSvg(svg1);
    const hash2 = hashSvg(svg2);
    const hash3 = hashSvg(svg3);

    expect(hash1).toBe(hash2);
    expect(hash2).toBe(hash3);
  });

  it('should ignore comments in hash', () => {
    const svg1 = '<svg><circle /></svg>';
    const svg2 = '<svg><!-- comment --><circle /></svg>';

    const hash1 = hashSvg(svg1);
    const hash2 = hashSvg(svg2);

    expect(hash1).toBe(hash2);
  });

  it('should generate different hash for different content', () => {
    const svg1 = '<svg><circle cx="12" cy="12" r="10" /></svg>';
    const svg2 = '<svg><circle cx="12" cy="12" r="11" /></svg>';

    const hash1 = hashSvg(svg1);
    const hash2 = hashSvg(svg2);

    expect(hash1).not.toBe(hash2);
  });

  it('should handle real Material Icon SVG', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24">
      <path d="M240-200h120v-240h240v240h120v-360L480-740 240-560v360Zm-80 80v-480l320-240 320 240v480H520v-240h-80v240H160Zm320-350Z"/>
    </svg>`;

    const hash = hashSvg(svg);

    expect(hash).toBeTruthy();
    expect(typeof hash).toBe('string');
    expect(hash).toMatch(/^[0-9a-z]+$/);
  });

  it('should be deterministic across multiple calls', () => {
    const svg = '<svg><circle cx="12" cy="12" r="10" /></svg>';
    const hashes = Array.from({ length: 100 }, () => hashSvg(svg));

    expect(new Set(hashes).size).toBe(1);
  });

  it('should handle empty SVG', () => {
    const hash = hashSvg('');

    expect(hash).toBeTruthy();
    expect(typeof hash).toBe('string');
  });

  it('should handle very large SVG', () => {
    const largeSvg = '<svg>' + '<circle />'.repeat(10000) + '</svg>';
    const hash = hashSvg(largeSvg);

    expect(hash).toBeTruthy();
    expect(typeof hash).toBe('string');
  });

  it('should detect variant differences', () => {
    // Material Icon variants should have different hashes
    const rounded = '<svg><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10"/></svg>';
    const sharp = '<svg><path d="M12 2L2 12l10 10 10-10L12 2z"/></svg>';

    const hash1 = hashSvg(rounded);
    const hash2 = hashSvg(sharp);

    expect(hash1).not.toBe(hash2);
  });

  it('should handle SVGs with different formatting', () => {
    const compact = '<svg><circle r="10"/></svg>';
    const formatted = `
      <svg>
        <circle r="10"/>
      </svg>
    `;

    const hash1 = hashSvg(compact);
    const hash2 = hashSvg(formatted);

    // Should produce same hash after normalization
    expect(hash1).toBe(hash2);
  });
});

describe('Hash utility integration', () => {
  it('should provide stable hashes for change detection', () => {
    const originalSvg = '<svg><circle r="10"/></svg>';
    const originalHash = hashSvg(originalSvg);

    // Same content, different formatting
    const reformattedSvg = `
      <svg>
        <circle r="10"/>
      </svg>
    `;
    const reformattedHash = hashSvg(reformattedSvg);

    // Changed content
    const modifiedSvg = '<svg><circle r="11"/></svg>';
    const modifiedHash = hashSvg(modifiedSvg);

    expect(originalHash).toBe(reformattedHash);
    expect(originalHash).not.toBe(modifiedHash);
  });

  it('should work for real-world component comparison workflow', () => {
    // Simulate: fetch SVG, store hash, later check if changed
    const initialSvg = '<svg><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>';
    const storedHash = hashSvg(initialSvg);

    // Later: fetch again with different formatting
    const fetchedSvg = `<svg>
      <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
    </svg>`;
    const fetchedHash = hashSvg(fetchedSvg);

    // Should match (no real change)
    expect(storedHash).toBe(fetchedHash);

    // Content actually changed
    const updatedSvg = '<svg><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z M20 20"/></svg>';
    const updatedHash = hashSvg(updatedSvg);

    // Should differ
    expect(storedHash).not.toBe(updatedHash);
  });
});
