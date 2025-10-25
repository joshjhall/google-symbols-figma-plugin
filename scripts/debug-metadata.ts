#!/usr/bin/env tsx
/**
 * Debug script to check what metadata is stored on existing components
 *
 * This helps diagnose issues with the metadata-driven skip/update logic
 */

// This would need to run inside Figma, but we can create a version
// that you can paste into the Figma plugin console

console.log(`
// Paste this into your Figma plugin code to debug metadata:

function debugComponentMetadata() {
  const page = figma.currentPage;
  const componentSets = page.children.filter(n => n.type === 'COMPONENT_SET');

  console.log('=== COMPONENT METADATA DEBUG ===');
  console.log(\`Total ComponentSets on page: \${componentSets.length}\`);
  console.log('');

  // Check first 10 components
  const samplesToCheck = Math.min(10, componentSets.length);

  for (let i = 0; i < samplesToCheck; i++) {
    const componentSet = componentSets[i] as ComponentSetNode;

    // Try to read commit SHA
    let commitSha = 'NOT FOUND';
    try {
      const sha = componentSet.getPluginData('git_commit_sha');
      commitSha = sha || 'EMPTY STRING';
    } catch (error) {
      commitSha = \`ERROR: \${error}\`;
    }

    // Get variant count
    const variantCount = componentSet.children.length;

    console.log(\`Component: \${componentSet.name}\`);
    console.log(\`  Variants: \${variantCount}/504\`);
    console.log(\`  Commit SHA: \${commitSha}\`);

    // Check a sample variant for SVG hash
    if (componentSet.children.length > 0) {
      const firstVariant = componentSet.children[0];
      if (firstVariant.type === 'COMPONENT') {
        let svgHash = 'NOT FOUND';
        try {
          const hash = firstVariant.getPluginData('svg_hash');
          svgHash = hash || 'EMPTY STRING';
        } catch (error) {
          svgHash = \`ERROR: \${error}\`;
        }
        console.log(\`  Sample variant SVG hash: \${svgHash}\`);
      }
    }
    console.log('');
  }

  console.log('=== END DEBUG ===');
}

debugComponentMetadata();
`);
